-- ============================================================
-- Sistema de Localização Multi-tenant (GeoLynq — substituto Gofind)
-- Schema — Supabase / Postgres
-- v2: adiciona session_id em widget_events e a tabela
--     commercial_opportunities (preparo para Fase 10 — pós-MVP).
--     Nenhuma tabela, coluna ou policy do schema original foi removida
--     ou renomeada. Marcações "-- NOVO" indicam o que foi acrescentado.
-- ============================================================

create extension if not exists postgis;
create extension if not exists pgcrypto; -- gen_random_uuid()

-- ============================================================
-- 1. TENANTS — cada fabricante/cliente do SaaS
-- ============================================================
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,                 -- usado no <script data-tenant="slug">
  status text not null default 'active'
    check (status in ('active','trial','suspended','cancelled')),
  plan text not null default 'standard',
  primary_color text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. TENANT_USERS — quem administra cada tenant (painel interno)
-- ============================================================
create table tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin','viewer')),
  created_at timestamptz not null default now(),
  unique(tenant_id, user_id)
);

-- ============================================================
-- 3. PRODUCTS — catálogo de SKUs do fabricante
-- ============================================================
create table products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sku text not null,
  name text not null,
  category text,
  claims text[],
  allergens text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, sku)
);

-- ============================================================
-- 4. RESELLERS — revendedores / pontos de venda
-- ============================================================
create table resellers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  type text not null
    check (type in ('loja_fisica','farmacia','online','distribuidor','outro')),
  status text not null default 'active' check (status in ('active','inactive')),
  phone text,
  whatsapp text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 5. ADDRESSES — endereço do revendedor, geocodificado no pipeline (n8n)
--    Cliente NUNCA digita lat/long — só CEP/endereço. Geog é calculado.
-- ============================================================
create table addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  reseller_id uuid not null references resellers(id) on delete cascade,
  cep text,
  street text,
  number text,
  neighborhood text,
  city text not null,
  state text not null,
  latitude double precision,
  longitude double precision,
  geog geography(point, 4326)
    generated always as (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) stored,
  geocoded_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 6. PRODUCT_RESELLER_COVERAGE — núcleo do sistema: quem vende o quê, onde
-- ============================================================
create table product_reseller_coverage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  reseller_id uuid not null references resellers(id) on delete cascade,
  priority int not null default 0,           -- score de priorização comercial
  created_at timestamptz not null default now(),
  unique(product_id, reseller_id)
);

-- ============================================================
-- 7. IMPORT_BATCHES — rastreio da logística reversa de dados (pipeline n8n)
-- ============================================================
create table import_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  source text not null default 'excel_upload',
  status text not null default 'processing'
    check (status in ('processing','success','partial','failed')),
  rows_processed int default 0,
  rows_failed int default 0,
  error_log jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ============================================================
-- 8. WIDGET_EVENTS — toda busca e clique registrados pelo widget
--    Base de tudo que vira dashboard/relatório pro fabricante.
--    product_id NULL         = termo buscado não bateu com nenhum SKU (demanda por produto não cadastrado)
--    product_id preenchido +
--    results_count = 0       = produto existe, ninguém vende perto (equivalente a "no_store_found")
-- ============================================================
create table widget_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  session_id text,                          -- NOVO: uuid anônimo gerado no navegador (localStorage, 30 dias).
                                              -- Sem isso, "10 buscas" pode ser 1 pessoa insistindo ou 10 pessoas —
                                              -- métricas de demanda (Fase 10) ficam infladas sem essa distinção.
  event_type text not null check (event_type in ('search','reseller_click')),
  query_text text,                          -- termo digitado (produto ou local)
  product_id uuid references products(id),
  city text,
  state text,
  results_count int,                        -- 0 = busca sem cobertura (dado valioso pro comercial)
  reseller_id uuid references resellers(id),-- preenchido só em reseller_click
  created_at timestamptz not null default now()
);

-- ============================================================
-- 9. LEADS — captura da página de vendas institucional
--    Fora do modelo multi-tenant: lead ainda não é cliente, não tem tenant_id.
-- ============================================================
create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text not null,
  phone text,
  message text,
  source text not null default 'landing_page',
  status text not null default 'new'
    check (status in ('new','contacted','qualified','converted','discarded')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 10. COMMERCIAL_OPPORTUNITIES — NOVO (Fase 10, pós-MVP)
--     Tabela agregada, recalculada 1x/dia via n8n a partir de widget_events.
--     Não criar/usar antes da Fase 10 — deixar definida agora só para não
--     precisar reabrir o schema depois.
-- ============================================================
create table commercial_opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  city text not null,
  state text not null,
  period_start date not null,
  period_end date not null,
  searches int not null default 0,
  unique_sessions int not null default 0,
  coverage_gap_searches int not null default 0,     -- results_count = 0
  reseller_count int not null default 0,
  growth_rate numeric,                               -- vs período anterior equivalente
  engagement_rate numeric,                            -- reseller_click / search
  demand_score numeric,
  coverage_gap_score numeric,
  growth_score numeric,
  engagement_score numeric,
  opportunity_score numeric not null default 0,
  classification text check (classification in ('baixa','moderada','alta','muito_alta')),
  updated_at timestamptz not null default now(),
  unique (tenant_id, product_id, city, state, period_start, period_end)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_products_tenant   on products(tenant_id);
create index idx_products_sku      on products(tenant_id, sku);
create index idx_resellers_tenant  on resellers(tenant_id);
create index idx_addresses_reseller on addresses(reseller_id);
create index idx_addresses_city    on addresses(tenant_id, city);
create index idx_addresses_geog    on addresses using gist(geog);  -- busca por raio/proximidade
create index idx_coverage_product  on product_reseller_coverage(product_id);
create index idx_coverage_reseller on product_reseller_coverage(reseller_id);
create index idx_events_tenant_date on widget_events(tenant_id, created_at desc);
create index idx_events_product    on widget_events(product_id);
create index idx_events_zero_result on widget_events(tenant_id, results_count) where results_count = 0;
create index idx_events_session    on widget_events(tenant_id, session_id); -- NOVO
create index idx_opportunities_tenant_score on commercial_opportunities(tenant_id, opportunity_score desc); -- NOVO

-- ============================================================
-- RLS — ROW LEVEL SECURITY
-- ============================================================
alter table tenants                    enable row level security;
alter table tenant_users               enable row level security;
alter table products                   enable row level security;
alter table resellers                  enable row level security;
alter table addresses                  enable row level security;
alter table product_reseller_coverage  enable row level security;
alter table import_batches             enable row level security;
alter table widget_events              enable row level security;
alter table leads                      enable row level security;
alter table commercial_opportunities   enable row level security; -- NOVO

-- ---- Leitura pública (widget embutido no site do cliente) ----
-- Só dados de tenant ativo. Sem autenticação — chave anon do Supabase.

create policy "public_read_products" on products
  for select using (
    active = true
    and exists (select 1 from tenants t where t.id = tenant_id and t.status = 'active')
  );

create policy "public_read_resellers" on resellers
  for select using (
    status = 'active'
    and exists (select 1 from tenants t where t.id = tenant_id and t.status = 'active')
  );

create policy "public_read_addresses" on addresses
  for select using (
    exists (select 1 from tenants t where t.id = tenant_id and t.status = 'active')
  );

create policy "public_read_coverage" on product_reseller_coverage
  for select using (
    exists (select 1 from tenants t where t.id = tenant_id and t.status = 'active')
  );

-- Widget grava evento sem login — só insert, nunca leitura pública
create policy "public_insert_events" on widget_events
  for insert with check (
    exists (select 1 from tenants t where t.id = tenant_id and t.status = 'active')
  );

-- Formulário da página de vendas grava lead sem login — só insert.
-- Sem policy de select: leitura só via service_role (Supabase Table Editor), por design, até existir volume que justifique painel próprio.
create policy "public_insert_leads" on leads
  for insert with check (true);

-- ---- Escrita/gestão (painel admin) — só quem está em tenant_users ----

create policy "tenant_admin_all_products" on products
  for all using (
    exists (select 1 from tenant_users tu
            where tu.tenant_id = products.tenant_id and tu.user_id = auth.uid())
  );

create policy "tenant_admin_all_resellers" on resellers
  for all using (
    exists (select 1 from tenant_users tu
            where tu.tenant_id = resellers.tenant_id and tu.user_id = auth.uid())
  );

create policy "tenant_admin_all_addresses" on addresses
  for all using (
    exists (select 1 from tenant_users tu
            where tu.tenant_id = addresses.tenant_id and tu.user_id = auth.uid())
  );

create policy "tenant_admin_all_coverage" on product_reseller_coverage
  for all using (
    exists (select 1 from tenant_users tu
            where tu.tenant_id = product_reseller_coverage.tenant_id and tu.user_id = auth.uid())
  );

create policy "tenant_admin_all_import_batches" on import_batches
  for all using (
    exists (select 1 from tenant_users tu
            where tu.tenant_id = import_batches.tenant_id and tu.user_id = auth.uid())
  );

-- Só o admin do tenant lê os próprios eventos (dashboard/relatórios)
create policy "tenant_admin_read_events" on widget_events
  for select using (
    exists (select 1 from tenant_users tu
            where tu.tenant_id = widget_events.tenant_id and tu.user_id = auth.uid())
  );

create policy "tenant_users_self" on tenant_users
  for select using (user_id = auth.uid());

-- NOVO: só o admin do tenant lê as oportunidades comerciais calculadas
create policy "tenant_admin_read_opportunities" on commercial_opportunities
  for select using (
    exists (select 1 from tenant_users tu
            where tu.tenant_id = commercial_opportunities.tenant_id and tu.user_id = auth.uid())
  );

-- NOVO: só o service_role (n8n) escreve em commercial_opportunities — sem policy de insert/update
-- para usuários comuns; o UPSERT do pipeline diário roda com a service_role key, que ignora RLS.

-- ============================================================
-- EXEMPLO DE QUERY — o coração do widget:
-- "revendedores mais próximos que vendem este produto"
-- ============================================================
-- select r.id, r.name, a.city, a.neighborhood,
--        ST_Distance(a.geog, ST_SetSRID(ST_MakePoint(:lng, :lat),4326)::geography) / 1000 as km
-- from resellers r
-- join addresses a on a.reseller_id = r.id
-- join product_reseller_coverage c on c.reseller_id = r.id
-- where c.product_id = :product_id
--   and r.tenant_id = :tenant_id
--   and r.status = 'active'
-- order by a.geog <-> ST_SetSRID(ST_MakePoint(:lng, :lat),4326)::geography
-- limit 10;
