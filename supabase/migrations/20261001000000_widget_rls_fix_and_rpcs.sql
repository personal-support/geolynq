-- ============================================================
-- Fase 4 — pré-requisitos do widget (leitura pública via anon key)
--
-- APLICADO EM geolynq-prod em 2026-10-01 via execute_sql (policies por ALTER POLICY),
-- NÃO via apply_migration: a ferramenta deu timeout 3x neste projeto, mesmo sem lock
-- no banco. Por isso esta migration não consta em supabase_migrations; o estado final
-- do banco é equivalente ao deste arquivo (idempotente: pode ser reaplicado).
--
-- PROBLEMA CORRIGIDO: as policies "public_read_*" e "public_insert_events" do
-- schema v2 usam `exists (select 1 from tenants ...)`. Como `tenants` tem RLS
-- ativo e a única policy dela é "tenant_users_self", o subselect roda como
-- `anon`, não enxerga nenhum tenant, e a policy nega tudo. Verificado em
-- geolynq-prod: `set role anon` retorna 0 linhas em products/resellers/
-- addresses/product_reseller_coverage mesmo com dados ativos.
--
-- CORREÇÃO: helper SECURITY DEFINER que checa o tenant sem depender da RLS de
-- `tenants` (que continua fechada para anon), e policies recriadas com a
-- mesma regra de negócio original (só tenant 'active').
-- ============================================================

create or replace function public.is_active_tenant(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.tenants t
    where t.id = p_tenant_id and t.status = 'active'
  );
$$;

revoke all on function public.is_active_tenant(uuid) from public;
grant execute on function public.is_active_tenant(uuid) to anon, authenticated;

drop policy if exists "public_read_products" on public.products;
create policy "public_read_products" on public.products
  for select using (active = true and public.is_active_tenant(tenant_id));

drop policy if exists "public_read_resellers" on public.resellers;
create policy "public_read_resellers" on public.resellers
  for select using (status = 'active' and public.is_active_tenant(tenant_id));

drop policy if exists "public_read_addresses" on public.addresses;
create policy "public_read_addresses" on public.addresses
  for select using (public.is_active_tenant(tenant_id));

drop policy if exists "public_read_coverage" on public.product_reseller_coverage;
create policy "public_read_coverage" on public.product_reseller_coverage
  for select using (public.is_active_tenant(tenant_id));

drop policy if exists "public_insert_events" on public.widget_events;
create policy "public_insert_events" on public.widget_events
  for insert with check (public.is_active_tenant(tenant_id));

-- ============================================================
-- RPC 1 — resolve slug -> dados públicos do tenant
-- `tenants` segue fechada para anon; só estes 5 campos saem, e só de tenant ativo.
-- ============================================================
create or replace function public.widget_get_tenant(p_slug text)
returns table (id uuid, name text, slug text, primary_color text, logo_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.id, t.name, t.slug, t.primary_color, t.logo_url
  from public.tenants t
  where t.slug = p_slug and t.status = 'active';
$$;

revoke all on function public.widget_get_tenant(text) from public;
grant execute on function public.widget_get_tenant(text) to anon, authenticated;

-- ============================================================
-- RPC 2 — revendedores que vendem o produto, do mais próximo ao mais distante
-- SECURITY INVOKER: a RLS pública (já corrigida acima) continua valendo.
-- Sem lat/lng, ordena só por prioridade comercial.
-- ============================================================
create or replace function public.widget_nearest_resellers(
  p_tenant_id uuid,
  p_product_id uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_limit int default 10
)
returns table (
  reseller_id uuid,
  name text,
  type text,
  phone text,
  whatsapp text,
  website text,
  street text,
  number text,
  neighborhood text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  distance_km double precision
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    r.id, r.name, r.type, r.phone, r.whatsapp, r.website,
    a.street, a.number, a.neighborhood, a.city, a.state,
    a.latitude, a.longitude,
    case
      when p_lat is not null and p_lng is not null and a.geog is not null
      then st_distance(a.geog, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000.0
    end as distance_km
  from public.product_reseller_coverage c
  join public.resellers r on r.id = c.reseller_id and r.tenant_id = c.tenant_id
  join public.addresses a on a.reseller_id = r.id
  where c.tenant_id = p_tenant_id
    and c.product_id = p_product_id
    and r.status = 'active'
  order by distance_km asc nulls last, c.priority desc, r.name
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

revoke all on function public.widget_nearest_resellers(uuid, uuid, double precision, double precision, int) from public;
grant execute on function public.widget_nearest_resellers(uuid, uuid, double precision, double precision, int) to anon, authenticated;
