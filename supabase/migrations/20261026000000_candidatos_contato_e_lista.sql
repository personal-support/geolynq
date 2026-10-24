-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- ============================================================
-- Candidatos a revendedor: endereço completo, telefone, e-mail, CNAEs secundários, e a lista com filtros (para a página
-- "Candidatos" e a exportação em CSV).
--
-- Por quê: a primeira versão mostrava só nome, CNPJ, bairro e CEP. A equipe comercial precisa de endereço e contato, e de filtrar e
-- exportar a lista. Decisão do usuário (24/10): são dados cadastrais públicos da Receita Federal; basta constar na página de privacidade.
-- Como: ADITIVO. Colunas novas (todas opcionais), função auxiliar candidatos_visiveis(), panel_candidates() com os campos novos
-- (CREATE OR REPLACE, mesma assinatura) e panel_candidates_list(). Site não vem da Receita: o painel oferece links de pesquisa.
-- Privacidade: continua sem sócios e sem razão social. Telefone e e-mail são os cadastrais da Receita (muitos vêm vazios).
--
-- Como aplicar: SQL Editor ou conector (sem DROP). Idempotente. Teste: supabase/tests/17_candidatos_a_revendedor.sql
-- ============================================================

alter table public.reseller_candidates add column if not exists logradouro text;
alter table public.reseller_candidates add column if not exists numero text;
alter table public.reseller_candidates add column if not exists complemento text;
alter table public.reseller_candidates add column if not exists telefone text check (telefone is null or telefone ~ '^[0-9]{8,11}$');
alter table public.reseller_candidates add column if not exists email text check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$');
alter table public.reseller_candidates add column if not exists cnaes_secundarios text[] not null default '{}';

-- candidatos que o cliente pode ver: tira quem já é revendedor dele (mesma raiz de CNPJ) e quem pediu exclusão
create or replace function public.candidatos_visiveis(p_tenant_id uuid)
returns setof public.reseller_candidates
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select c.*
    from public.reseller_candidates c
   where c.tenant_id = p_tenant_id
     and left(c.cnpj, 8) not in (select left(public.cnpj_normalizar(r.cnpj), 8) from public.resellers r where r.tenant_id = p_tenant_id and r.cnpj is not null)
     and not public.candidato_optout(left(c.cnpj, 8));
$$;
revoke all on function public.candidatos_visiveis(uuid) from public, anon;
grant execute on function public.candidatos_visiveis(uuid) to authenticated, service_role;

-- cartão da tela Lacunas: agora com endereço e contato
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
    select p.uf as p_uf, p.cidade_norm, p.cidade as p_cidade, c.*
      from pedidas p
      join public.candidatos_visiveis(p_tenant_id) c
        on c.uf = p.uf and public.norm_busca(c.municipio) = p.cidade_norm
  ),
  ranq as (
    select cand.*, row_number() over (partition by p_uf, cidade_norm
                                      order by (status in ('novo', 'contatado')) desc, score desc, nome_fantasia nulls last, cnpj) as rn
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
                          'score', score, 'status', status) order by rn) filter (where rn <= v_lim), '[]'::jsonb)
             ) as g
        from ranq
       group by p_uf, cidade_norm
    ) z;

  return v_out;
end;
$$;
revoke all on function public.panel_candidates(uuid, jsonb, integer) from public, anon;
grant execute on function public.panel_candidates(uuid, jsonb, integer) to authenticated, service_role;

-- página "Candidatos": lista filtrada e paginada (e a exportação, com limite alto) + as opções dos filtros
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

  with todos as (select * from public.candidatos_visiveis(p_tenant_id)),
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
     order by (f.status in ('novo', 'contatado')) desc, f.score desc, f.nome_fantasia nulls last, f.cnpj
     limit v_lim offset v_off
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrados),
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'cnpj', cnpj, 'nome', nome_fantasia, 'cnae', cnae, 'cnae_desc', cnae_desc,
        'logradouro', logradouro, 'numero', numero, 'complemento', complemento, 'bairro', bairro, 'cep', cep,
        'municipio', municipio, 'uf', uf, 'telefone', telefone, 'email', email, 'cnaes_secundarios', to_jsonb(cnaes_secundarios),
        'score', score, 'status', status, 'status_em', status_em) order by (status in ('novo', 'contatado')) desc, score desc, nome_fantasia nulls last, cnpj) from pagina), '[]'::jsonb),
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
