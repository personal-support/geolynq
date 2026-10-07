-- ===== EVENTOS SIMULADOS (tenant demo = marca fictícia "Pódio") — session_id começa com 'seed-pod-' (para apagar depois) =====
-- Diferente do 03_: a cobertura (nº de revendedores no raio, distância ao mais próximo) é CALCULADA a partir da rede real do tenant
-- (PostGIS, raio de 100 km, só revendedor físico ativo), então o painel, o mapa e a página de Rede contam a mesma história.
-- Apagar: delete from public.widget_events where session_id like 'seed-pod-%';
-- Local: sed "s/slug = 'demo'/slug = 'podio-local'/" 06_*.sql | psql ...
insert into public.widget_events
  (tenant_id, session_id, event_type, query_text, product_id, city, state, neighborhood, results_count, created_at, telemetry_v,
   lat_approx, lng_approx, cep5, location_source, nearest_km, physical_count, online_count, action, reseller_id, distance_km)
with t as (select id from public.tenants where slug = 'demo'),
cities(ord, city, state, lat, lng, w, cep5, hood) as (values
  (1,'Santos','SP',-23.96,-46.33,20,'11060','Gonzaga'),
  (2,'Guarujá','SP',-23.99,-46.26,6,'11410','Pitangueiras'),
  (3,'São Vicente','SP',-23.96,-46.39,6,'11310','Centro'),
  (4,'Praia Grande','SP',-24.01,-46.41,10,'11700','Guilhermina'),
  (5,'São Paulo','SP',-23.56,-46.65,24,'01310','Bela Vista'),
  (6,'Campinas','SP',-22.90,-47.06,8,'13010','Centro'),
  (7,'Rio de Janeiro','RJ',-22.97,-43.19,7,'22070','Copacabana'),
  (8,'Curitiba','PR',-25.43,-49.27,7,'80010','Centro'),
  (9,'Belo Horizonte','MG',-19.92,-43.94,5,'30110','Savassi'),
  (10,'Salvador','BA',-12.97,-38.50,3,'40010','Barra')),
ccum as (select *, sum(w) over (order by ord) as cum from cities),
prods(sku, term, cut) as (values
  ('WPI-900','whey isolado',22),('WPC-900','whey',36),('CRE-300','creatina',54),('GLU-300','glutamina',62),
  ('BCA-120','bcaa',68),('PRE-300','pré-treino',74),('BAR-012','barra de proteína',80),('HIP-3000','hipercalórico',85),
  ('COL-300','colágeno',88),('OM3-120','ômega 3',90),('MVA-060','multivitamínico',92),('ALB-500','albumina',94)),
gen as (
  select i,
         (abs(hashtext('c' || i)) % 1000) / 10.0 as rc,
         (abs(hashtext('p' || i)) % 1000) / 10.0 as rp,
         (abs(hashtext('u' || i)) % 10000) / 10000.0 as ru,
         (abs(hashtext('j' || i)) % 1000) / 1000.0 as rj
    from generate_series(1, 600) i),
pick as (
  select g.*, c.city, c.state, c.lat, c.lng, c.cep5, c.hood,
         (select p.sku from prods p where p.cut > g.rp order by p.cut limit 1) as sku
    from gen g
    join lateral (select * from ccum x where x.cum >= g.rc * (select max(cum) from ccum) / 100.0 order by x.ord limit 1) c on true),
calc as (
  select p.*, pr.id as product_id, pd.term,
         (now() - (interval '60 days') * power(p.ru, 1.5)) as quando,
         cov.fis, cov.nearest, onl.n as online_n
    from pick p
    left join public.products pr on pr.tenant_id = (select id from t) and pr.sku = p.sku
    left join prods pd on pd.sku = p.sku
    left join lateral (
      select count(*)::int as fis, min(st_distance(a.geog, st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography) / 1000.0) as nearest
        from public.product_reseller_coverage c
        join public.resellers r on r.id = c.reseller_id and r.status = 'active' and r.type <> 'online'
        join public.addresses a on a.reseller_id = r.id
       where c.product_id = pr.id
         and st_dwithin(a.geog, st_setsrid(st_makepoint(p.lng, p.lat), 4326)::geography, 100000)) cov on true
    left join lateral (
      select count(*)::int as n from public.product_reseller_coverage c
        join public.resellers r on r.id = c.reseller_id and r.status = 'active' and r.type = 'online'
       where c.product_id = pr.id) onl on true)
select (select id from t),
       'seed-pod-' || (c.i / 2),
       'search',
       coalesce(c.term, (array['ashwagandha','pasta de amendoim','termogênico','vitamina d','magnésio','whey vegano'])[1 + (abs(hashtext('t' || c.i)) % 6)]),
       c.product_id,
       c.city, c.state, c.hood,
       case when c.product_id is null then 0 else coalesce(c.fis, 0) end,
       c.quando, 2,
       round((c.lat + (c.rj - 0.5) * 0.04)::numeric, 2), round((c.lng + (c.rj - 0.5) * 0.04)::numeric, 2),
       c.cep5, case when c.i % 3 = 0 then 'gps' else 'cep' end,
       case when coalesce(c.fis, 0) > 0 then round(c.nearest::numeric, 2) end,
       case when c.product_id is null then null else coalesce(c.fis, 0) end,
       case when c.product_id is null then null else coalesce(c.online_n, 0) end,
       null, null, null
  from calc c;

-- cliques: ~45% das buscas atendidas por loja física viram clique (20–90 s depois), numa das lojas do raio;
-- ~25% das buscas SEM loja física mas com loja online viram clique no site da loja online (a demanda "vaza" para o online)
insert into public.widget_events
  (tenant_id, session_id, event_type, query_text, product_id, city, state, neighborhood, results_count, created_at, telemetry_v,
   lat_approx, lng_approx, cep5, location_source, nearest_km, physical_count, online_count, action, reseller_id, distance_km)
select e.tenant_id, e.session_id, 'reseller_click', e.query_text, e.product_id, e.city, e.state, e.neighborhood, e.results_count,
       e.created_at + (interval '1 second') * (20 + abs(hashtext('d' || e.id)) % 70), 2,
       e.lat_approx, e.lng_approx, e.cep5, e.location_source, e.nearest_km, e.physical_count, e.online_count,
       case when r.online then 'site'
            when abs(hashtext('x' || e.id)) % 100 < 50 then 'whatsapp' when abs(hashtext('x' || e.id)) % 100 < 75 then 'directions'
            when abs(hashtext('x' || e.id)) % 100 < 90 then 'call' else 'site' end,
       r.reseller_id, case when r.online then null else e.nearest_km end
  from public.widget_events e
  join lateral (
    select c.reseller_id, (rs.type = 'online') as online
      from public.product_reseller_coverage c
      join public.resellers rs on rs.id = c.reseller_id and rs.status = 'active'
      left join public.addresses a on a.reseller_id = rs.id
     where c.product_id = e.product_id
       and ((e.results_count > 0 and rs.type <> 'online'
             and st_dwithin(a.geog, st_setsrid(st_makepoint(e.lng_approx, e.lat_approx), 4326)::geography, 100000))
         or (e.results_count = 0 and rs.type = 'online'))
     order by hashtext(c.reseller_id::text || e.id::text) limit 1) r on true
 where e.session_id like 'seed-pod-%' and e.event_type = 'search' and e.product_id is not null
   and abs(hashtext('k2' || e.id)) % 100 < case when e.results_count > 0 then 45 else 25 end;
