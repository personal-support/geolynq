-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- ============================================================
-- Candidatos a revendedor: lista de exclusão (titular que pede para a empresa não aparecer)
--
-- Por quê: a página de privacidade promete que a empresa listada pode pedir para sair. Sem uma lista própria, o CNPJ voltaria na
-- próxima carga da Receita. Aqui a exclusão é pela RAIZ do CNPJ (8 caracteres): vale para matriz e filiais e para todos os clientes.
-- Como: ADITIVO. Tabela nova (só service_role) e panel_candidates passa a esconder essas raízes (CREATE OR REPLACE; mesma assinatura).
-- Para registrar um pedido (SQL Editor):  insert into public.candidate_optout (raiz) values ('11222333') on conflict do nothing;
-- Teste: supabase/tests/17_candidatos_a_revendedor.sql
-- ============================================================
create table if not exists public.candidate_optout (
  raiz      text primary key check (raiz ~ '^[0-9A-Z]{8}$'),
  criado_em timestamptz not null default now()
);
alter table public.candidate_optout enable row level security;
revoke all on public.candidate_optout from anon, authenticated;
grant all on public.candidate_optout to service_role;

-- o painel (usuário comum) não lê a tabela; pergunta por esta função, que devolve só "sim/não" para uma raiz
create or replace function public.candidato_optout(p_raiz text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.candidate_optout o where o.raiz = p_raiz);
$$;
revoke all on function public.candidato_optout(text) from public, anon;
grant execute on function public.candidato_optout(text) to authenticated, service_role;

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
  raizes as (
    select distinct left(public.cnpj_normalizar(r.cnpj), 8) as raiz
      from public.resellers r
     where r.tenant_id = p_tenant_id and r.cnpj is not null
  ),
  cand as (
    select p.uf as p_uf, p.cidade_norm, p.cidade as p_cidade, c.*
      from pedidas p
      join public.reseller_candidates c
        on c.tenant_id = p_tenant_id and c.uf = p.uf and public.norm_busca(c.municipio) = p.cidade_norm
     where left(c.cnpj, 8) not in (select raiz from raizes where raiz is not null)
       and not public.candidato_optout(left(c.cnpj, 8))
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
                          'bairro', bairro, 'cep', cep, 'score', score, 'status', status) order by rn) filter (where rn <= v_lim), '[]'::jsonb)
             ) as g
        from ranq
       group by p_uf, cidade_norm
    ) z;

  return v_out;
end;
$$;

revoke all on function public.panel_candidates(uuid, jsonb, integer) from public, anon;
grant execute on function public.panel_candidates(uuid, jsonb, integer) to authenticated, service_role;
