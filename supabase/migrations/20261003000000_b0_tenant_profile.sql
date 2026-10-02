-- ============================================================
-- B0.1 — Cadastro do cliente por CNPJ e perfil de mercado (estrutura)
-- Desenho: docs/b0-cadastro-por-cnpj.md. Migration ADITIVA: nada existente é apagado nem alterado de forma incompatível.
--
-- Cliente = empresa (raiz do CNPJ, 8 dígitos). Revendedor = CNPJ de 14 dígitos por cliente (rede = mesma raiz).
-- Território 'brasil' = país inteiro. Só dados de pessoa jurídica: NÃO se guarda quadro societário (dado pessoal).
--
-- Aplicar em ETAPAS (conector MCP dá timeout em blocos longos): (1) função  (2) tabelas  (3) resellers  (4) RLS e permissões.
-- Idempotente.
-- ============================================================

-- ---------- Etapa 1: validação de CNPJ (dígito verificador) ----------
create or replace function public.is_valid_cnpj(p text)
returns boolean
language plpgsql
immutable
strict
parallel safe
set search_path = pg_catalog, pg_temp
as $$
declare
  d  text := regexp_replace(p, '\D', '', 'g');
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s  int;
  i  int;
  r  int;
begin
  if length(d) <> 14 or d ~ '^(.)\1{13}$' then return false; end if;
  s := 0;
  for i in 1..12 loop s := s + substr(d, i, 1)::int * w1[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  if r <> substr(d, 13, 1)::int then return false; end if;
  s := 0;
  for i in 1..13 loop s := s + substr(d, i, 1)::int * w2[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  return r = substr(d, 14, 1)::int;
end;
$$;

-- ---------- Etapa 2: tabelas ----------
create table if not exists public.tenant_profiles (
  tenant_id           uuid primary key references public.tenants(id) on delete cascade,
  cnpj_raiz           text not null unique check (cnpj_raiz ~ '^[0-9]{8}$'),
  cnpj_matriz         text not null check (cnpj_matriz ~ '^[0-9]{14}$' and public.is_valid_cnpj(cnpj_matriz) and substr(cnpj_matriz, 1, 8) = cnpj_raiz),
  razao_social        text not null check (char_length(razao_social) <= 200),
  nome_fantasia       text check (char_length(nome_fantasia) <= 200),
  situacao_cadastral  text check (situacao_cadastral in ('ativa','suspensa','inapta','baixada','nula')),
  data_abertura       date,
  porte               text,
  -- a API devolve o CNAE como NÚMERO (1099607): sempre normalizar com lpad(x::text, 7, '0')
  cnae_principal      text check (cnae_principal ~ '^[0-9]{7}$'),
  cnae_principal_desc text,
  cnaes_secundarios   text[] not null default '{}',
  uf                  text check (uf ~ '^[A-Z]{2}$'),
  municipio           text,
  municipio_ibge      integer,   -- código IBGE (7 dígitos), ex.: 3509205
  municipio_receita   integer,   -- código interno da Receita (o dump usa este), ex.: 6285
  cep                 text check (cep ~ '^[0-9]{8}$'),
  website             text,
  fonte               text not null default 'manual' check (fonte in ('brasilapi','receita_dump','manual')),
  consultado_em       timestamptz,
  created_at          timestamptz not null default now()
);

create table if not exists public.cnae_catalog (
  cnae      text primary key check (cnae ~ '^[0-9]{7}$'),
  descricao text not null
);

create table if not exists public.segments (
  id    text primary key check (id ~ '^[a-z0-9_]+$'),
  nome  text not null,
  ativo boolean not null default true
);

create table if not exists public.segment_channel_cnaes (
  segment_id text not null references public.segments(id) on delete cascade,
  cnae       text not null check (cnae ~ '^[0-9]{7}$'),
  tipo_canal text not null check (tipo_canal in ('varejo','atacado','representante','online','outro')),
  peso       smallint not null default 1,
  primary key (segment_id, cnae)
);

create table if not exists public.tenant_segments (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  segment_id text not null references public.segments(id),
  primary key (tenant_id, segment_id)
);

create table if not exists public.tenant_territories (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  scope          text not null check (scope in ('brasil','uf','municipio')),
  uf             text check (uf ~ '^[A-Z]{2}$'),
  municipio_ibge integer,
  check ((scope = 'brasil'    and uf is null     and municipio_ibge is null)
      or (scope = 'uf'        and uf is not null and municipio_ibge is null)
      or (scope = 'municipio' and municipio_ibge is not null))
);
create unique index if not exists tenant_territories_uq
  on public.tenant_territories (tenant_id, scope, coalesce(uf, ''), coalesce(municipio_ibge, 0));

-- ---------- Etapa 3: CNPJ como chave de negócio do revendedor + verificação ----------
alter table public.resellers
  add column if not exists cnpj text,
  add column if not exists verification_status text,
  add column if not exists verified_at timestamptz;

alter table public.resellers
  drop constraint if exists resellers_cnpj_check,
  add constraint resellers_cnpj_check check (cnpj is null or (cnpj ~ '^[0-9]{14}$' and public.is_valid_cnpj(cnpj))),
  drop constraint if exists resellers_verification_status_check,
  add constraint resellers_verification_status_check
    check (verification_status is null or verification_status in ('nao_verificado','ativa','suspensa','inapta','baixada','nula'));

-- um CNPJ por cliente (impede a duplicação na reimportação); linhas sem CNPJ não entram no índice
create unique index if not exists resellers_tenant_cnpj_uq on public.resellers (tenant_id, cnpj) where cnpj is not null;
create index if not exists resellers_cnpj_idx on public.resellers (cnpj) where cnpj is not null;

-- ---------- Etapa 4: RLS e permissões ----------
alter table public.tenant_profiles        enable row level security;
alter table public.cnae_catalog           enable row level security;
alter table public.segments               enable row level security;
alter table public.segment_channel_cnaes  enable row level security;
alter table public.tenant_segments        enable row level security;
alter table public.tenant_territories     enable row level security;

-- dados do cliente: leitura só para membros do tenant; escrita só service_role (sem policy de escrita)
drop policy if exists tenant_members_read_profile on public.tenant_profiles;
create policy tenant_members_read_profile on public.tenant_profiles for select
  using (exists (select 1 from public.tenant_users tu where tu.tenant_id = tenant_profiles.tenant_id and tu.user_id = auth.uid()));
drop policy if exists tenant_members_read_segments on public.tenant_segments;
create policy tenant_members_read_segments on public.tenant_segments for select
  using (exists (select 1 from public.tenant_users tu where tu.tenant_id = tenant_segments.tenant_id and tu.user_id = auth.uid()));
drop policy if exists tenant_members_read_territories on public.tenant_territories;
create policy tenant_members_read_territories on public.tenant_territories for select
  using (exists (select 1 from public.tenant_users tu where tu.tenant_id = tenant_territories.tenant_id and tu.user_id = auth.uid()));

-- dados de referência: leitura para usuários logados; escrita só service_role
drop policy if exists authenticated_read_cnae_catalog on public.cnae_catalog;
create policy authenticated_read_cnae_catalog on public.cnae_catalog for select to authenticated using (true);
drop policy if exists authenticated_read_segments on public.segments;
create policy authenticated_read_segments on public.segments for select to authenticated using (true);
drop policy if exists authenticated_read_segment_channel_cnaes on public.segment_channel_cnaes;
create policy authenticated_read_segment_channel_cnaes on public.segment_channel_cnaes for select to authenticated using (true);

-- defesa em profundidade: anônimo não toca nas tabelas novas; logado só lê (RLS decide quais linhas)
revoke all on public.tenant_profiles, public.cnae_catalog, public.segments, public.segment_channel_cnaes,
              public.tenant_segments, public.tenant_territories from anon;
revoke insert, update, delete, truncate, references, trigger on public.tenant_profiles, public.cnae_catalog,
              public.segments, public.segment_channel_cnaes, public.tenant_segments, public.tenant_territories from authenticated;

-- A policy pública `public_read_resellers` deixa o anônimo ler a tabela inteira. As colunas novas (cnpj, verificação) NÃO devem
-- ficar públicas: o anônimo passa a ler só as colunas que o widget usa. Colunas futuras ficam fechadas por padrão.
revoke select on public.resellers from anon;
grant select (id, tenant_id, name, type, status, phone, whatsapp, website, created_at, updated_at) on public.resellers to anon;
