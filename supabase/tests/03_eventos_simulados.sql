-- ===== EVENTOS SIMULADOS (tenant fabrica-teste) — session_id começa com 'seed-' (para apagar depois) =====
insert into public.widget_events
  (tenant_id, session_id, event_type, query_text, product_id, city, state, neighborhood, results_count, created_at, telemetry_v,
   lat_approx, lng_approx, cep5, location_source, nearest_km, physical_count, online_count, action, reseller_id, distance_km)
with t as (select id from public.tenants where slug = 'fabrica-teste'),
cities(ord, city, state, lat, lng, w, cep5, hood, zona) as (values
  (1,'Santos','SP',-23.96,-46.33,22,'11060','Gonzaga','baixada'),
  (2,'Guarujá','SP',-23.99,-46.26,6,'11410','Pitangueiras','baixada'),
  (3,'São Vicente','SP',-23.96,-46.39,6,'11310','Centro','baixada'),
  (4,'Praia Grande','SP',-24.01,-46.41,10,'11700','Guilhermina','baixada'),
  (5,'São Paulo','SP',-23.56,-46.65,24,'01310','Bela Vista','sp'),
  (6,'Campinas','SP',-22.90,-47.06,8,'13010','Centro','campinas'),
  (7,'Rio de Janeiro','RJ',-22.97,-43.19,7,'22070','Copacabana','rio'),
  (8,'Curitiba','PR',-25.43,-49.27,7,'80010','Centro','longe'),
  (9,'Belo Horizonte','MG',-19.92,-43.94,5,'30110','Savassi','longe'),
  (10,'Salvador','BA',-12.97,-38.50,3,'40010','Barra','longe')),
ccum as (select *, sum(w) over (order by ord) as cum from cities),
prods as (select sku, id from public.products where tenant_id = (select id from t)),
gen as (
  select i,
         (abs(hashtext('c' || i)) % 1000) / 10.0                      as rc,   -- 0..100 cidade
         (abs(hashtext('p' || i)) % 1000) / 10.0                      as rp,   -- 0..100 produto
         (abs(hashtext('u' || i)) % 10000) / 10000.0                  as ru,   -- tempo
         (abs(hashtext('k' || i)) % 100)                              as rk,   -- clique?
         (abs(hashtext('a' || i)) % 100)                              as ra,   -- acao
         (abs(hashtext('j' || i)) % 1000) / 1000.0                    as rj    -- jitter / distancia
    from generate_series(1, 420) i),
pick as (
  select g.*, c.city, c.state, c.lat, c.lng, c.cep5, c.hood, c.zona,
         case when g.rp < 38 then 'TST-001' when g.rp < 62 then 'TST-002' when g.rp < 74 then 'TST-003'
              when g.rp < 82 then 'TST-004' when g.rp < 90 then 'TST-005' else null end as sku
    from gen g
    join lateral (select * from ccum x where x.cum >= g.rc order by x.ord limit 1) c on true
),
calc as (
  select p.*,
    case when p.sku is null then null
         when p.zona = 'baixada'  then case p.sku when 'TST-001' then 2 when 'TST-002' then 2 when 'TST-003' then 3 else 0 end
         when p.zona = 'sp'       then case p.sku when 'TST-001' then 3 when 'TST-002' then 3 when 'TST-003' then 2 when 'TST-004' then 1 else 0 end
         when p.zona = 'campinas' then case p.sku when 'TST-001' then 1 when 'TST-002' then 1 when 'TST-003' then 2 when 'TST-004' then 1 else 0 end
         when p.zona = 'rio'      then case p.sku when 'TST-001' then 1 else 0 end
         else 0 end as fis,
    case p.sku when 'TST-001' then 'whey' when 'TST-002' then 'creatina' when 'TST-003' then 'glutamina'
               when 'TST-004' then 'barra proteica' when 'TST-005' then 'hipercalórico'
               else (array['ashwagandha','colágeno','pasta de amendoim','bcaa','termogênico','ômega 3'])[1 + (abs(hashtext('t' || p.i)) % 6)] end as termo,
    (now() - (interval '60 days') * power(p.ru, 1.5)) as quando
  from pick p
)
select (select id from t),
       'seed-' || (c.i / 2),                                   -- ~2 buscas por sessão
       'search',
       c.termo,
       (select id from prods where sku = c.sku),
       c.city, c.state, c.hood,
       coalesce(c.fis, 0),
       c.quando,
       2,
       round((c.lat + (c.rj - 0.5) * 0.04)::numeric, 2), round((c.lng + (c.rj - 0.5) * 0.04)::numeric, 2),
       c.cep5, case when c.i % 3 = 0 then 'gps' else 'cep' end,
       case when coalesce(c.fis, 0) > 0
            then round((case when c.zona='baixada' and c.sku='TST-003' then 58 + c.rj*12
                             when c.zona='sp' and c.sku='TST-004' then 85 + c.rj*10
                             when c.zona='campinas' and c.sku='TST-003' then 85 + c.rj*7
                             else 1 + c.rj*7 end)::numeric, 2) end,
       coalesce(c.fis, 0), case when c.sku is null then null else 1 end,
       null, null, null
  from calc c;

-- cliques: ~45% das buscas atendidas viram clique (20-90 s depois), no revendedor que atende o produto
insert into public.widget_events
  (tenant_id, session_id, event_type, query_text, product_id, city, state, neighborhood, results_count, created_at, telemetry_v,
   lat_approx, lng_approx, cep5, location_source, nearest_km, physical_count, online_count, action, reseller_id, distance_km)
select e.tenant_id, e.session_id, 'reseller_click', e.query_text, e.product_id, e.city, e.state, e.neighborhood, e.results_count,
       e.created_at + (interval '1 second') * (20 + abs(hashtext('d' || e.id)) % 70), 2,
       e.lat_approx, e.lng_approx, e.cep5, e.location_source, e.nearest_km, e.physical_count, e.online_count,
       case when abs(hashtext('x' || e.id)) % 100 < 50 then 'whatsapp' when abs(hashtext('x' || e.id)) % 100 < 75 then 'directions'
            when abs(hashtext('x' || e.id)) % 100 < 90 then 'call' else 'site' end,
       r.reseller_id, e.nearest_km
  from public.widget_events e
  join lateral (select c.reseller_id from public.product_reseller_coverage c
                 where c.product_id = e.product_id order by hashtext(c.reseller_id::text || e.id::text) limit 1) r on true
 where e.session_id like 'seed-%' and e.event_type = 'search' and e.product_id is not null and coalesce(e.results_count, 0) > 0
   and abs(hashtext('k2' || e.id)) % 100 < 45;
