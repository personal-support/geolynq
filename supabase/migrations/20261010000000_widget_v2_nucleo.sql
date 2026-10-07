-- ============================================================
-- Widget v2 (Etapa 1: núcleo) — tema por cliente, foto do produto, grade com filtro e lista de revendedores
--
-- 100% ADITIVO (nada é apagado nem muda de assinatura; o widget v1 em /v1/embed.js continua igual):
--   * products.image_url         — foto do produto (link do cliente OU nosso armazenamento; o widget só aceita https)
--   * tenants.widget_theme       — tema do widget por cliente (jsonb; só a GeoLynq edita; o widget valida cada chave)
--   * widget_get_tenant_v2()     — como widget_get_tenant, mais o tema (SECURITY DEFINER: `tenants` segue fechada para anon)
--   * widget_find_products()     — grade/busca de produtos, sem acento, com paginação e total (SECURITY INVOKER)
--   * widget_list_resellers()    — lista de revendedores com filtros (produto, UF, cidade, tipo) e paginação (SECURITY INVOKER)
--   * widget_list_places()       — UFs e cidades que têm revendedor físico (para os filtros)
--
-- REGRAS DE EXPOSIÇÃO (decisão do Junior): a lista exige pelo menos um filtro (produto, UF, cidade ou localização), devolve no
-- máximo 20 por página e não há exportação. Revendedor online só entra quando não há filtro de UF/cidade (ou se o tipo for online):
-- o endereço dele é o da sede e não faz sentido num filtro por estado. Nenhuma coluna fechada ao público (cnpj etc.) é lida.
-- APLICADA em geolynq-prod em 2026-10-07 via execute_sql, em 2 partes (limite de 60 s do conector). Idempotente.
-- ============================================================

alter table public.products add column if not exists image_url text;
alter table public.tenants  add column if not exists widget_theme jsonb not null default '{}'::jsonb;

-- ---------- tenant + tema ----------
create or replace function public.widget_get_tenant_v2(p_slug text)
returns table (id uuid, name text, slug text, primary_color text, logo_url text, theme jsonb)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.id, t.name, t.slug, t.primary_color, t.logo_url, t.widget_theme
  from public.tenants t
  where t.slug = p_slug and t.status = 'active';
$$;

-- ---------- produtos (grade e busca) ----------
create or replace function public.widget_find_products(
  p_tenant_id uuid,
  p_term text default '',
  p_limit int default 60,
  p_offset int default 0
)
returns table (id uuid, sku text, name text, category text, image_url text, total_count bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with q as (
    select replace(replace(replace(public.norm_busca(left(btrim(coalesce(p_term, '')), 80)), '\', '\\'), '%', '\%'), '_', '\_') as t
  )
  select p.id, p.sku, p.name, p.category,
         case when p.image_url ~ '^https://[^[:space:]]+$' and char_length(p.image_url) between 12 and 500 then p.image_url end as image_url,
         count(*) over () as total_count
  from public.products p, q
  where p.tenant_id = p_tenant_id
    and (q.t = '' or public.norm_busca(p.name) like '%' || q.t || '%'
                  or public.norm_busca(p.sku)  like '%' || q.t || '%'
                  or public.norm_busca(coalesce(p.category, '')) like '%' || q.t || '%')
  order by p.name asc
  limit least(greatest(coalesce(p_limit, 60), 1), 500)
  offset least(greatest(coalesce(p_offset, 0), 0), 10000);
$$;

-- ---------- lista de revendedores com filtros ----------
create or replace function public.widget_list_resellers(
  p_tenant_id uuid,
  p_product_id uuid default null,
  p_uf text default null,
  p_city text default null,
  p_type text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_limit int default 10,
  p_offset int default 0
)
returns table (
  reseller_id uuid, name text, type text, phone text, whatsapp text, website text,
  street text, number text, neighborhood text, city text, state text,
  latitude double precision, longitude double precision, distance_km double precision,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with f as (
    select nullif(upper(btrim(coalesce(p_uf, ''))), '') as uf,
           nullif(public.norm_busca(btrim(coalesce(p_city, ''))), '') as city,
           nullif(btrim(coalesce(p_type, '')), '') as tp,
           (p_lat is not null and p_lng is not null) as located
  )
  select r.id, r.name, r.type, r.phone, r.whatsapp, r.website,
         a.street, a.number, a.neighborhood, a.city, a.state, a.latitude, a.longitude,
         case when f.located and a.geog is not null
              then st_distance(a.geog, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000.0 end as distance_km,
         count(*) over () as total_count
  from public.resellers r
  join public.addresses a on a.reseller_id = r.id and a.tenant_id = r.tenant_id
  cross join f
  where r.tenant_id = p_tenant_id
    and r.status = 'active'
    -- exige ao menos um filtro: nada de despejar a rede inteira do cliente
    and (p_product_id is not null or f.uf is not null or f.city is not null or f.located)
    and (p_product_id is null or exists (
          select 1 from public.product_reseller_coverage c
           where c.tenant_id = r.tenant_id and c.reseller_id = r.id and c.product_id = p_product_id))
    and (f.uf is null or upper(a.state) = f.uf)
    and (f.city is null or public.norm_busca(a.city) = f.city)
    and (f.tp is null or r.type = f.tp)
    -- online tem endereço de sede: só entra quando não se filtrou por lugar (ou se pediram "online")
    and (r.type <> 'online' or (f.uf is null and f.city is null) or f.tp = 'online')
  order by distance_km asc nulls last, r.name
  limit least(greatest(coalesce(p_limit, 10), 1), 20)
  offset least(greatest(coalesce(p_offset, 0), 0), 1000);
$$;

-- ---------- lugares para os filtros ----------
create or replace function public.widget_list_places(p_tenant_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with x as (
    select distinct upper(a.state) as uf, a.city as cidade
      from public.resellers r
      join public.addresses a on a.reseller_id = r.id and a.tenant_id = r.tenant_id
     where r.tenant_id = p_tenant_id and r.status = 'active' and r.type <> 'online'
       and nullif(btrim(a.state), '') is not null and nullif(btrim(a.city), '') is not null
  )
  select jsonb_build_object(
    'ufs', coalesce((select jsonb_agg(u order by u) from (select distinct uf as u from x) z), '[]'::jsonb),
    'cidades', coalesce((select jsonb_agg(jsonb_build_object('uf', uf, 'cidade', cidade) order by uf, cidade)
                           from (select uf, cidade from x order by uf, cidade limit 1500) y), '[]'::jsonb)
  );
$$;

revoke all on function public.widget_get_tenant_v2(text) from public;
revoke all on function public.widget_find_products(uuid, text, int, int) from public;
revoke all on function public.widget_list_resellers(uuid, uuid, text, text, text, double precision, double precision, int, int) from public;
revoke all on function public.widget_list_places(uuid) from public;
grant execute on function public.widget_get_tenant_v2(text) to anon, authenticated;
grant execute on function public.widget_find_products(uuid, text, int, int) to anon, authenticated, service_role;
grant execute on function public.widget_list_resellers(uuid, uuid, text, text, text, double precision, double precision, int, int) to anon, authenticated, service_role;
grant execute on function public.widget_list_places(uuid) to anon, authenticated, service_role;
