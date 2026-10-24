-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- ============================================================
-- Candidatos a revendedor: ranking que aprende com a equipe e palavras do ramo por cliente
--
-- Por quê: o CNAE é amplo e deixa passar empresa fora do ramo. Dois ajustes legítimos, só com dado do próprio cliente:
--   (2) APRENDIZADO PELAS MARCAÇÕES: o que a equipe marca ("Vende", "Não vende", "Sem interesse") corrige o ranking:
--       * por ATIVIDADE (CNAE): com 5 ou mais marcações decididas, soma de -6 a +6 conforme a proporção de "Vende" menos "Não vende/Sem interesse";
--       * por REDE (mesma raiz de CNPJ): se outra empresa da mesma rede já "Vende" +6; se foi marcada "Não vende/Sem interesse" -10.
--   (3) PALAVRAS DO RAMO por cliente: termos que SOBEM (ex.: academia, nutrição) ou DESCEM (ex.: moda, bicicleta) o candidato quando
--       aparecem no nome fantasia (sem acento e sem diferença de caixa); vale o maior peso de cada tipo.
-- Como: ADITIVO. Nada é gravado no score: o ajuste é calculado na leitura (candidatos_ajuste), então desfazer uma marcação ou remover
-- uma palavra volta o ranking ao que era. panel_candidates e panel_candidates_list (CREATE OR REPLACE, mesma assinatura) passam a usar
-- score + ajuste e devolvem 'ajuste' e 'motivo' para a tela explicar. Palavras: só owner/admin mudam (viewer lê).
--
-- Como aplicar: SQL Editor ou conector (sem DROP). Idempotente. Teste: supabase/tests/18_candidatos_aprendizado_palavras.sql
-- ============================================================

create table if not exists public.tenant_candidate_terms (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  termo      text not null check (termo ~ '^[a-z0-9 ]{2,40}$'),
  tipo       text not null check (tipo in ('sobe', 'desce')),
  peso       smallint not null default 6 check (peso between 1 and 12),
  created_at timestamptz not null default now(),
  primary key (tenant_id, termo, tipo)
);
alter table public.tenant_candidate_terms enable row level security;
drop policy if exists members_read_terms on public.tenant_candidate_terms;
create policy members_read_terms on public.tenant_candidate_terms for select to authenticated using (public.is_tenant_member(tenant_id));
revoke all on public.tenant_candidate_terms from anon, authenticated;
grant select on public.tenant_candidate_terms to authenticated;
grant all on public.tenant_candidate_terms to service_role;

-- ajuste do ranking de cada candidato visível do cliente
create or replace function public.candidatos_ajuste(p_tenant_id uuid)
returns table (id uuid, ajuste integer, motivo text)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with v as (select c.id, c.cnpj, c.cnae, c.status, c.nome_fantasia from public.candidatos_visiveis(p_tenant_id) c),
  ativ as (
    select cnae,
           count(*) filter (where status in ('vende', 'nao_vende', 'sem_interesse')) as decididos,
           count(*) filter (where status = 'vende') as vende,
           count(*) filter (where status in ('nao_vende', 'sem_interesse')) as nao
      from v group by cnae
  ),
  rede as (
    select left(cnpj, 8) as raiz,
           count(*) filter (where status = 'vende') as vende,
           count(*) filter (where status in ('nao_vende', 'sem_interesse')) as nao
      from v group by 1
  ),
  base as (
    select v.id,
           case when a.decididos >= 5 then round(6.0 * (a.vende - a.nao) / a.decididos)::int else 0 end as a_adj,
           case when r.vende - (v.status = 'vende')::int > 0 then 6
                when r.nao - (v.status in ('nao_vende', 'sem_interesse'))::int > 0 then -10
                else 0 end as r_adj,
           coalesce((select max(t.peso) from public.tenant_candidate_terms t
                      where t.tenant_id = p_tenant_id and t.tipo = 'sobe'
                        and strpos(public.norm_busca(coalesce(v.nome_fantasia, '')), t.termo) > 0), 0)::int as t_up,
           coalesce((select max(t.peso) from public.tenant_candidate_terms t
                      where t.tenant_id = p_tenant_id and t.tipo = 'desce'
                        and strpos(public.norm_busca(coalesce(v.nome_fantasia, '')), t.termo) > 0), 0)::int as t_down
      from v
      join ativ a on a.cnae = v.cnae
      join rede r on r.raiz = left(v.cnpj, 8)
  )
  select b.id,
         b.a_adj + b.r_adj + b.t_up - b.t_down,
         nullif(concat_ws('; ',
           case when b.a_adj > 0 then 'atividade com bom retorno nas suas marcações' when b.a_adj < 0 then 'atividade com baixo retorno nas suas marcações' end,
           case when b.r_adj > 0 then 'outra empresa da mesma rede já vende' when b.r_adj < 0 then 'outra empresa da mesma rede foi marcada como não vende/sem interesse' end,
           case when b.t_up > 0 then 'nome com palavra do ramo' end,
           case when b.t_down > 0 then 'nome com palavra de fora do ramo' end), '')
    from base b;
$$;
revoke all on function public.candidatos_ajuste(uuid) from public, anon;
grant execute on function public.candidatos_ajuste(uuid) to authenticated, service_role;

-- cartão da tela Lacunas: ranking ajustado
create or replace function public.panel_candidates(p_tenant_id uuid, p_cidades jsonb, p_limit integer default 6)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_lim integer := least(greatest(coalesce(p_limit, 6), 1), 50);
  v_out jsonb;
begin
  if not public.is_tenant_member(p_tenant_id) then
    return null;
  end if;
  if p_cidades is null or jsonb_typeof(p_cidades) <> 'array' then
    return '[]'::jsonb;
  end if;

  with pedidas as (
    select distinct upper(btrim(x ->> 'uf')) as uf, public.norm_busca(x ->> 'cidade') as cidade_norm, x ->> 'cidade' as cidade
      from (select value as x from jsonb_array_elements(p_cidades) limit 100) j
     where nullif(btrim(x ->> 'cidade'), '') is not null
  ),
  cand as (
    select p.uf as p_uf, p.cidade_norm, p.cidade as p_cidade, c.*, (c.score + a.ajuste) as score_aj, a.ajuste, a.motivo
      from pedidas p
      join public.candidatos_visiveis(p_tenant_id) c
        on c.uf = p.uf and public.norm_busca(c.municipio) = p.cidade_norm
      join public.candidatos_ajuste(p_tenant_id) a on a.id = c.id
  ),
  ranq as (
    select cand.*, row_number() over (partition by p_uf, cidade_norm
                                      order by (status in ('novo', 'contatado')) desc, score_aj desc, nome_fantasia nulls last, cnpj) as rn
      from cand
  )
  select coalesce(jsonb_agg(g order by g ->> 'uf', g ->> 'cidade'), '[]'::jsonb) into v_out
    from (
      select jsonb_build_object(
               'uf', p_uf, 'cidade', max(p_cidade),
               'abertos', count(*) filter (where status not in ('nao_vende', 'sem_interesse')),
               'por_status', jsonb_build_object(
                 'novo', count(*) filter (where status = 'novo'), 'contatado', count(*) filter (where status = 'contatado'),
                 'vende', count(*) filter (where status = 'vende'), 'nao_vende', count(*) filter (where status = 'nao_vende'),
                 'sem_interesse', count(*) filter (where status = 'sem_interesse')),
               'itens', coalesce(jsonb_agg(jsonb_build_object(
                          'id', id, 'cnpj', cnpj, 'nome', nome_fantasia, 'cnae', cnae,
                          'cnae_desc', (select d.descricao from public.cnae_catalog d where d.cnae = ranq.cnae),
                          'logradouro', logradouro, 'numero', numero, 'complemento', complemento,
                          'bairro', bairro, 'cep', cep, 'municipio', municipio, 'uf', uf, 'telefone', telefone, 'email', email,
                          'score', score_aj, 'ajuste', ajuste, 'motivo', motivo, 'status', status) order by rn) filter (where rn <= v_lim), '[]'::jsonb)
             ) as g
        from ranq
       group by p_uf, cidade_norm
    ) z;

  return v_out;
end;
$$;
revoke all on function public.panel_candidates(uuid, jsonb, integer) from public, anon;
grant execute on function public.panel_candidates(uuid, jsonb, integer) to authenticated, service_role;

-- página "Candidatos": lista, filtros e exportação, com ranking ajustado
create or replace function public.panel_candidates_list(
  p_tenant_id uuid,
  p_uf text default null,
  p_cidade text default null,
  p_cnae text default null,
  p_status text default null,
  p_q text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_lim integer := least(greatest(coalesce(p_limit, 50), 1), 5000);
  v_off integer := greatest(coalesce(p_offset, 0), 0);
  v_uf text := nullif(upper(btrim(coalesce(p_uf, ''))), '');
  v_cid text := nullif(public.norm_busca(btrim(coalesce(p_cidade, ''))), '');
  v_cnae text := nullif(regexp_replace(coalesce(p_cnae, ''), '\D', '', 'g'), '');
  v_st text := nullif(btrim(coalesce(p_status, '')), '');
  v_q text := nullif(public.norm_busca(btrim(coalesce(p_q, ''))), '');
  v_qid text := nullif(upper(regexp_replace(coalesce(p_q, ''), '[^0-9A-Za-z]', '', 'g')), '');
  v_out jsonb;
begin
  if not public.is_tenant_member(p_tenant_id) then
    return null;
  end if;
  if v_st is not null and v_st not in ('abertos', 'novo', 'contatado', 'vende', 'nao_vende', 'sem_interesse') then
    raise exception 'andamento inválido' using errcode = '22023';
  end if;
  if v_qid is not null and length(v_qid) < 4 then v_qid := null; end if;

  with todos as (
    select c.*, (c.score + a.ajuste) as score_aj, a.ajuste, a.motivo
      from public.candidatos_visiveis(p_tenant_id) c
      join public.candidatos_ajuste(p_tenant_id) a on a.id = c.id
  ),
  filtrados as (
    select t.* from todos t
     where (v_uf is null or t.uf = v_uf)
       and (v_cid is null or public.norm_busca(t.municipio) = v_cid)
       and (v_cnae is null or t.cnae = v_cnae)
       and (v_st is null or (v_st = 'abertos' and t.status in ('novo', 'contatado')) or t.status = v_st)
       and (v_q is null or strpos(public.norm_busca(coalesce(t.nome_fantasia, '')), v_q) > 0 or (v_qid is not null and strpos(t.cnpj, v_qid) > 0))
  ),
  pagina as (
    select f.*, (select d.descricao from public.cnae_catalog d where d.cnae = f.cnae) as cnae_desc
      from filtrados f
     order by (f.status in ('novo', 'contatado')) desc, f.score_aj desc, f.nome_fantasia nulls last, f.cnpj
     limit v_lim offset v_off
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrados),
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'cnpj', cnpj, 'nome', nome_fantasia, 'cnae', cnae, 'cnae_desc', cnae_desc,
        'logradouro', logradouro, 'numero', numero, 'complemento', complemento, 'bairro', bairro, 'cep', cep,
        'municipio', municipio, 'uf', uf, 'telefone', telefone, 'email', email, 'cnaes_secundarios', to_jsonb(cnaes_secundarios),
        'score', score_aj, 'ajuste', ajuste, 'motivo', motivo, 'status', status, 'status_em', status_em)
        order by (status in ('novo', 'contatado')) desc, score_aj desc, nome_fantasia nulls last, cnpj) from pagina), '[]'::jsonb),
    'filtros', jsonb_build_object(
      'ufs', coalesce((select jsonb_agg(u order by u) from (select distinct uf as u from todos) x), '[]'::jsonb),
      'cidades', coalesce((select jsonb_agg(jsonb_build_object('uf', uf, 'cidade', municipio, 'n', n) order by uf, municipio)
                             from (select uf, municipio, count(*) as n from todos group by uf, municipio) x), '[]'::jsonb),
      'cnaes', coalesce((select jsonb_agg(jsonb_build_object('cnae', cnae, 'descricao', (select d.descricao from public.cnae_catalog d where d.cnae = x.cnae), 'n', n) order by n desc, cnae)
                           from (select cnae, count(*) as n from todos group by cnae) x), '[]'::jsonb),
      'por_status', jsonb_build_object(
        'novo', (select count(*) from todos where status = 'novo'), 'contatado', (select count(*) from todos where status = 'contatado'),
        'vende', (select count(*) from todos where status = 'vende'), 'nao_vende', (select count(*) from todos where status = 'nao_vende'),
        'sem_interesse', (select count(*) from todos where status = 'sem_interesse')))
  ) into v_out;

  return v_out;
end;
$$;
revoke all on function public.panel_candidates_list(uuid, text, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.panel_candidates_list(uuid, text, text, text, text, text, integer, integer) to authenticated, service_role;

-- palavras do ramo: ler (membros) e mudar (owner/admin)
create or replace function public.panel_terms(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if not public.is_tenant_member(p_tenant_id) then
    return null;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('termo', t.termo, 'tipo', t.tipo, 'peso', t.peso) order by t.tipo desc, t.termo)
                     from public.tenant_candidate_terms t where t.tenant_id = p_tenant_id), '[]'::jsonb);
end;
$$;

create or replace function public.panel_term_set(p_tenant_id uuid, p_termo text, p_tipo text, p_peso integer default 6)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_termo text := btrim(regexp_replace(public.norm_busca(coalesce(p_termo, '')), '[^a-z0-9 ]', ' ', 'g'));
begin
  v_termo := regexp_replace(v_termo, ' +', ' ', 'g');
  if v_uid is null or not exists (select 1 from public.tenant_users tu where tu.tenant_id = p_tenant_id and tu.user_id = v_uid) then
    return null;
  end if;
  if not exists (select 1 from public.tenant_users tu where tu.tenant_id = p_tenant_id and tu.user_id = v_uid and tu.role in ('owner', 'admin')) then
    raise exception 'sem permissão para alterar as palavras do ramo' using errcode = '42501';
  end if;
  if p_tipo not in ('sobe', 'desce') or length(v_termo) < 2 or length(v_termo) > 40 or p_peso is null or p_peso < 1 or p_peso > 12 then
    raise exception 'palavra ou peso inválido' using errcode = '22023';
  end if;
  if (select count(*) from public.tenant_candidate_terms where tenant_id = p_tenant_id) >= 60
     and not exists (select 1 from public.tenant_candidate_terms where tenant_id = p_tenant_id and termo = v_termo and tipo = p_tipo) then
    raise exception 'limite de 60 palavras por cliente' using errcode = '54000';
  end if;
  insert into public.tenant_candidate_terms (tenant_id, termo, tipo, peso) values (p_tenant_id, v_termo, p_tipo, p_peso)
    on conflict (tenant_id, termo, tipo) do update set peso = excluded.peso;
  return true;
end;
$$;

create or replace function public.panel_term_remove(p_tenant_id uuid, p_termo text, p_tipo text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null or not exists (select 1 from public.tenant_users tu where tu.tenant_id = p_tenant_id and tu.user_id = v_uid) then
    return null;
  end if;
  if not exists (select 1 from public.tenant_users tu where tu.tenant_id = p_tenant_id and tu.user_id = v_uid and tu.role in ('owner', 'admin')) then
    raise exception 'sem permissão para alterar as palavras do ramo' using errcode = '42501';
  end if;
  delete from public.tenant_candidate_terms where tenant_id = p_tenant_id and termo = p_termo and tipo = p_tipo;
  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

revoke all on function public.panel_terms(uuid) from public, anon;
revoke all on function public.panel_term_set(uuid, text, text, integer) from public, anon;
revoke all on function public.panel_term_remove(uuid, text, text) from public, anon;
grant execute on function public.panel_terms(uuid) to authenticated, service_role;
grant execute on function public.panel_term_set(uuid, text, text, integer) to authenticated, service_role;
grant execute on function public.panel_term_remove(uuid, text, text) to authenticated, service_role;
