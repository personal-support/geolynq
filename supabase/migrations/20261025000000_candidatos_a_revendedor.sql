-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- ============================================================
-- Candidatos a revendedor (Marco 2) e CNAEs de canal medidos a partir da rede do próprio cliente
--
-- Por quê: a tela Lacunas mostra onde há busca e não há revendedor, mas não diz a quem a equipe comercial deve procurar.
-- Como: ADITIVO (3 tabelas e 5 funções novas; nada existente é alterado).
--   * reseller_receita      : situação e CNAEs (principal + secundários) de cada revendedor do cliente, pelo CNPJ da planilha.
--   * tenant_channel_cnaes  : CNAEs de canal do cliente. propose_channel_cnaes() PROPÕE os que aparecem em ao menos 5% da rede
--                             (e em 3+ revendedores); a pessoa confirma antes de qualquer carga.
--   * reseller_candidates   : empresas ativas desses CNAEs que NÃO constam na rede do cliente, só nas cidades com lacuna.
-- Privacidade: só dado cadastral de empresa (CNPJ, nome fantasia, CNAE, bairro, CEP, cidade). Sem telefone, e-mail, sócios ou
-- razão social. Texto do painel: "não constam na sua base" (não sabemos se vendem).
-- Quem escreve: tenant_channel_cnaes, reseller_receita e reseller_candidates só pelo service_role (n8n / script na VPS).
-- O painel lê pelas funções (panel_candidates) e muda o andamento de um candidato por panel_candidate_status (owner/admin;
-- o papel "viewer" só lê).
--
-- Como aplicar: SQL Editor (CREATE ... IF NOT EXISTS / CREATE OR REPLACE; sem DROP). Idempotente.
-- Testes: supabase/tests/17_candidatos_a_revendedor.sql
-- ============================================================

-- 1. CNAEs de canal por cliente ----------------------------------------------------------------
create table if not exists public.tenant_channel_cnaes (
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  cnae           text not null check (cnae ~ '^[0-9]{7}$'),
  peso           smallint not null default 1 check (peso between 1 and 3),
  ruidoso        boolean not null default false,       -- CNAE "guarda-chuva" (ex.: 4729699): entra, mas com score menor
  origem         text not null default 'medido' check (origem in ('segmento', 'medido', 'manual')),
  n_revendedores integer,
  status         text not null default 'proposto' check (status in ('proposto', 'confirmado', 'descartado')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (tenant_id, cnae)
);

-- 2. O que a Receita diz de cada revendedor do cliente -------------------------------------------
create table if not exists public.reseller_receita (
  reseller_id       uuid primary key references public.resellers(id) on delete cascade,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  cnpj              text not null,
  situacao          text,                                -- 'ATIVA', 'BAIXADA', 'SUSPENSA', 'INAPTA', 'NULA'
  cnae_principal    text check (cnae_principal ~ '^[0-9]{7}$'),
  cnaes_secundarios text[] not null default '{}',
  erro              text,                                -- 'nao_encontrado', 'consulta_falhou', ... (vazio = consulta ok)
  fonte             text not null default 'brasilapi' check (fonte in ('brasilapi', 'receita_dump', 'manual')),
  consultado_em     timestamptz not null default now()
);
create index if not exists reseller_receita_tenant_idx on public.reseller_receita (tenant_id);

-- 3. Candidatos a revendedor -------------------------------------------------------------------
create table if not exists public.reseller_candidates (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  cnpj          text not null check (public.is_valid_cnpj(cnpj)),
  nome_fantasia text,
  cnae          text not null check (cnae ~ '^[0-9]{7}$'),
  uf            text not null check (uf ~ '^[A-Z]{2}$'),
  municipio     text not null,
  bairro        text,
  cep           text check (cep is null or cep ~ '^[0-9]{8}$'),
  score         smallint not null default 0,
  status        text not null default 'novo' check (status in ('novo', 'contatado', 'vende', 'nao_vende', 'sem_interesse')),
  status_em     timestamptz,
  status_por    uuid,
  fonte_mes     text,                                    -- mês da base da Receita (AAAA-MM)
  created_at    timestamptz not null default now(),
  unique (tenant_id, cnpj)
);
create index if not exists reseller_candidates_cidade_idx on public.reseller_candidates (tenant_id, uf, municipio);

-- RLS: o cliente só enxerga o que é dele; ninguém escreve pelo painel (só service_role e as funções abaixo)
alter table public.tenant_channel_cnaes enable row level security;
alter table public.reseller_receita     enable row level security;
alter table public.reseller_candidates  enable row level security;

drop policy if exists members_read_channel_cnaes on public.tenant_channel_cnaes;
create policy members_read_channel_cnaes on public.tenant_channel_cnaes for select to authenticated
  using (public.is_tenant_member(tenant_id));
drop policy if exists members_read_candidates on public.reseller_candidates;
create policy members_read_candidates on public.reseller_candidates for select to authenticated
  using (public.is_tenant_member(tenant_id));

revoke all on public.tenant_channel_cnaes, public.reseller_receita, public.reseller_candidates from anon, authenticated;
grant select on public.tenant_channel_cnaes, public.reseller_candidates to authenticated;
grant all on public.tenant_channel_cnaes, public.reseller_receita, public.reseller_candidates to service_role;

-- 4. Propor os CNAEs de canal a partir da rede do cliente ---------------------------------------
-- Conta, por CNAE, quantos revendedores ATIVOS o têm (principal ou secundário; cada revendedor conta uma vez).
-- Entra quem aparece em >= p_min_count revendedores E em >= p_min_share da rede consultada. Não mexe no que a pessoa já
-- confirmou ou descartou.
create or replace function public.propose_channel_cnaes(
  p_tenant_id uuid,
  p_min_share numeric default 0.05,
  p_min_count integer default 3,
  p_ruido text[] default array['4729699']
)
returns table (cnae text, n_revendedores integer, participacao numeric, n_principal integer, peso smallint, ruidoso boolean, status text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  with base as (
    select r.reseller_id, r.cnae_principal, r.cnaes_secundarios
      from public.reseller_receita r
     where r.tenant_id = p_tenant_id and r.erro is null and upper(coalesce(r.situacao, '')) = 'ATIVA'
  ),
  tot as (select count(*)::numeric as n from base),
  pares as (
    select reseller_id, c, bool_or(principal) as principal
      from (
        select reseller_id, cnae_principal as c, true as principal from base where cnae_principal is not null
        union all
        select reseller_id, unnest(cnaes_secundarios), false from base
      ) x
     where c ~ '^[0-9]{7}$'
     group by reseller_id, c
  ),
  agg as (select c, count(*)::int as n, count(*) filter (where principal)::int as np from pares group by c)
  insert into public.tenant_channel_cnaes as t (tenant_id, cnae, peso, ruidoso, origem, n_revendedores, status)
  select p_tenant_id, a.c,
         (case when a.np * 2 >= a.n then 3 when a.np > 0 then 2 else 1 end)::smallint,
         a.c = any (p_ruido), 'medido', a.n, 'proposto'
    from agg a, tot
   where tot.n > 0 and a.n >= p_min_count and a.n / tot.n >= p_min_share
  on conflict (tenant_id, cnae) do update
    set peso = excluded.peso, ruidoso = excluded.ruidoso, n_revendedores = excluded.n_revendedores, updated_at = now()
    where t.status = 'proposto' and t.origem = 'medido';

  return query
    select t.cnae, t.n_revendedores,
           round(t.n_revendedores::numeric / nullif((select count(*) from public.reseller_receita r
                                                      where r.tenant_id = p_tenant_id and r.erro is null and upper(coalesce(r.situacao, '')) = 'ATIVA'), 0), 3),
           (select count(*)::int from public.reseller_receita r where r.tenant_id = p_tenant_id and r.cnae_principal = t.cnae and r.erro is null and upper(coalesce(r.situacao, '')) = 'ATIVA'),
           t.peso, t.ruidoso, t.status
      from public.tenant_channel_cnaes t
     where t.tenant_id = p_tenant_id and t.origem = 'medido'
     order by t.n_revendedores desc nulls last, t.cnae;
end;
$$;

-- 5. Relatório do que ficou de fora (para o cliente corrigir a planilha) -----------------------
create or replace function public.reseller_receita_resumo(p_tenant_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with r as (
    select s.id, s.cnpj as cnpj_planilha, public.cnpj_normalizar(s.cnpj) as cnpj,
           rr.situacao, rr.erro, (rr.reseller_id is not null) as consultado
      from public.resellers s
      left join public.reseller_receita rr on rr.reseller_id = s.id
     where s.tenant_id = p_tenant_id and s.status = 'active'
  )
  select jsonb_build_object(
    'revendedores', count(*),
    'sem_cnpj',       count(*) filter (where cnpj_planilha is null or btrim(cnpj_planilha) = ''),
    'cnpj_invalido',  count(*) filter (where cnpj_planilha is not null and btrim(cnpj_planilha) <> '' and not public.is_valid_cnpj(cnpj)),
    'pendentes',      count(*) filter (where cnpj is not null and public.is_valid_cnpj(cnpj) and not consultado),
    'nao_encontrados',count(*) filter (where consultado and erro = 'nao_encontrado'),
    'consulta_falhou',count(*) filter (where consultado and erro is not null and erro <> 'nao_encontrado'),
    'inativos',       count(*) filter (where consultado and erro is null and upper(coalesce(situacao, '')) <> 'ATIVA'),
    'usados',         count(*) filter (where consultado and erro is null and upper(coalesce(situacao, '')) = 'ATIVA')
  )
  from r;
$$;

-- 6. Painel: candidatos por cidade com lacuna ---------------------------------------------------
-- p_cidades = [{"uf":"SP","cidade":"Santos"}, ...] (até 100). Cidade comparada sem acento e sem diferença de caixa.
-- Não lista quem já é revendedor do cliente (mesmo CNPJ ou mesma raiz de 8 caracteres) nem quem a equipe marcou como
-- "não vende" ou "sem interesse" (esses ficam fora da contagem de abertos).
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

-- 7. Painel: andamento de um candidato (só owner/admin; "viewer" só lê) ---------------------------
create or replace function public.panel_candidate_status(p_tenant_id uuid, p_candidate_id uuid, p_status text)
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
    raise exception 'sem permissão para alterar candidatos' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('novo', 'contatado', 'vende', 'nao_vende', 'sem_interesse') then
    raise exception 'andamento inválido' using errcode = '22023';
  end if;
  update public.reseller_candidates
     set status = p_status, status_em = now(), status_por = v_uid
   where id = p_candidate_id and tenant_id = p_tenant_id;
  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

revoke all on function public.propose_channel_cnaes(uuid, numeric, integer, text[]) from public, anon, authenticated;
revoke all on function public.reseller_receita_resumo(uuid) from public, anon, authenticated;
revoke all on function public.panel_candidates(uuid, jsonb, integer) from public, anon;
revoke all on function public.panel_candidate_status(uuid, uuid, text) from public, anon;
grant execute on function public.propose_channel_cnaes(uuid, numeric, integer, text[]) to service_role;
grant execute on function public.reseller_receita_resumo(uuid) to service_role;
grant execute on function public.panel_candidates(uuid, jsonb, integer) to authenticated, service_role;
grant execute on function public.panel_candidate_status(uuid, uuid, text) to authenticated, service_role;
