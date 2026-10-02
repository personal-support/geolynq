-- ============================================================
-- Fase 4 — raio máximo na busca de revendedores (widget)
--
-- ANTES: widget_nearest_resellers devolvia os N mais próximos sem limite de distância
-- (ex.: de Salvador, um revendedor a 1.423 km). Efeito colateral: a busca "produto existe
-- mas ninguém vende perto" nunca disparava para produto com 1 revendedor no país.
--
-- AGORA: função NOVA widget_resellers_in_radius (parâmetro p_max_km, padrão 100). Regras:
--   * Com localização (p_lat/p_lng): só revendedores físicos com distância <= p_max_km.
--     Físico sem coordenadas (geog nulo) fica de fora: não dá pra confirmar que é perto.
--   * type = 'online' sempre entra (atende qualquer lugar), SEM distância (null) e por
--     último na ordenação.
--   * Sem localização (p_lat/p_lng nulos): não há como filtrar → comportamento anterior.
--
-- POR QUE OUTRO NOME (e não substituir widget_nearest_resellers): trocar a assinatura exige
-- DROP da função em produção, e o conector MCP deu timeout nessa transação (nada foi
-- aplicado). Com nome novo não há janela em que o widget publicado fique sem função, e dá
-- rollback trivial. widget_nearest_resellers (sem raio) fica até o widget novo estar no ar;
-- depois: drop function public.widget_nearest_resellers(uuid, uuid, double precision, double precision, int);
-- Idempotente (create or replace).
-- ============================================================


create or replace function public.widget_resellers_in_radius(
  p_tenant_id uuid,
  p_product_id uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_limit int default 10,
  p_max_km double precision default 100
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
  with c as (
    select
      r.id as reseller_id, r.name, r.type, r.phone, r.whatsapp, r.website,
      a.street, a.number, a.neighborhood, a.city, a.state,
      a.latitude, a.longitude,
      cv.priority,
      case
        when r.type <> 'online' and p_lat is not null and p_lng is not null and a.geog is not null
        then st_distance(a.geog, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000.0
      end as distance_km
    from public.product_reseller_coverage cv
    join public.resellers r on r.id = cv.reseller_id and r.tenant_id = cv.tenant_id
    join public.addresses a on a.reseller_id = r.id
    where cv.tenant_id = p_tenant_id
      and cv.product_id = p_product_id
      and r.status = 'active'
  )
  select
    c.reseller_id, c.name, c.type, c.phone, c.whatsapp, c.website,
    c.street, c.number, c.neighborhood, c.city, c.state,
    c.latitude, c.longitude, c.distance_km
  from c
  where c.type = 'online'
     or p_lat is null or p_lng is null
     or c.distance_km <= greatest(coalesce(p_max_km, 100), 0)
  order by c.distance_km asc nulls last, c.priority desc, c.name
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

revoke all on function public.widget_resellers_in_radius(uuid, uuid, double precision, double precision, int, double precision) from public;
grant execute on function public.widget_resellers_in_radius(uuid, uuid, double precision, double precision, int, double precision) to anon, authenticated;
