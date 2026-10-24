-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- ===== HISTÓRICO SIMULADO DA PÓDIO COM DATAS FIXAS (tenant demo) =====
-- Por quê: os geradores 06_ e 11_ usam "agora − 60 dias", então só cobrem os 60 dias anteriores ao dia em que rodaram (08/08 a 07/10/2026).
-- Este script preenche uma janela com início e fim FIXOS, para a demonstração mostrar 90 dias de histórico (o maior período do painel).
-- Junta as 3 partes dos geradores antigos (buscas, cliques, funil) mas só mexe nas sessões do prefixo informado: não duplica nada que já existe.
--
-- Uso (psql):  psql -v slug=demo -v prefix=seed-pod-a- -v ini='2026-07-26 00:00-03' -v fim='2026-08-08 00:00-03' -v n=110 -f 14_demo_podio_historico.sql
-- Janela = [ini, fim). `n` = quantidade de buscas. Prefixos sugeridos: seed-pod-a- (início) e seed-pod-b- (fim). Todos começam com 'seed-pod-'.
-- No conector/SQL Editor, troque :'slug', :'prefix', :'ini', :'fim' e :n pelos valores (texto entre aspas simples; n sem aspas).
-- Roda uma vez por prefixo: se já houver evento com o prefixo, para com erro.
-- Apagar só este lote: delete from public.widget_events where session_id like 'seed-pod-a-%';   (ou seed-pod-b-%)

-- trava: aborta se o prefixo já foi usado (o erro "more than one row returned by a subquery" é proposital; 1/0 não serve porque o Postgres
-- calcula constantes ao planejar a consulta e falharia sempre)
select case when exists (select 1 from public.widget_events e join public.tenants t on t.id = e.tenant_id
                          where t.slug = :'slug' and e.session_id like :'prefix' || '%')
            then (select 1 from generate_series(1, 2)) end as prefixo_ja_usado;

-- 1) buscas
insert into public.widget_events
  (tenant_id, session_id, event_type, query_text, product_id, city, state, neighborhood, results_count, created_at, telemetry_v,
   lat_approx, lng_approx, cep5, location_source, nearest_km, physical_count, online_count, action, reseller_id, distance_km)
with t as (select id from public.tenants where slug = :'slug'),
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
janela as (select :'ini'::timestamptz as ini, greatest(1, ceil(extract(epoch from (:'fim'::timestamptz - :'ini'::timestamptz)) / 86400.0)::int) as dias),
gen as (
  select i,
         (abs(hashtext('c' || i || :'prefix')) % 1000) / 10.0 as rc,
         (abs(hashtext('p' || i || :'prefix')) % 1000) / 10.0 as rp,
         (abs(hashtext('u' || i || :'prefix')) % 10000) / 10000.0 as ru,
         (abs(hashtext('j' || i || :'prefix')) % 1000) / 1000.0 as rj,
         (abs(hashtext('h' || i || :'prefix')) % 1000) / 1000.0 as rh,
         (abs(hashtext('m' || i || :'prefix')) % 60) as rm
    from generate_series(1, :n) i),
pick as (
  select g.*, c.city, c.state, c.lat, c.lng, c.cep5, c.hood,
         (select p.sku from prods p where p.cut > g.rp order by p.cut limit 1) as sku
    from gen g
    join lateral (select * from ccum x where x.cum >= g.rc * (select max(cum) from ccum) / 100.0 order by x.ord limit 1) c on true),
calc as (
  select p.*, pr.id as product_id, pd.term,
         -- dia uniforme dentro da janela; horário entre 08h e 22h59 (horário de Brasília)
         ((select ini from janela) + ((floor(p.ru * (select dias from janela)))::int) * interval '1 day'
            + (8 + floor(p.rh * 15)::int) * interval '1 hour' + p.rm * interval '1 minute') as quando,
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
       :'prefix' || (c.i / 2),
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

-- 2) cliques (só nas buscas deste lote): ~45% das buscas atendidas por loja física; ~25% das sem loja física mas com loja online
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
  join public.tenants tt on tt.id = e.tenant_id and tt.slug = :'slug'
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
 where e.session_id like :'prefix' || '%' and e.event_type = 'search' and e.product_id is not null
   and abs(hashtext('k2' || e.id)) % 100 < case when e.results_count > 0 then 45 else 25 end;

-- 3) funil (só nas sessões deste lote): escolha do produto 25 s antes, busca no catálogo 50 s antes (~70%), abertura da lista (~15%),
--    e ~12% de sessões extras que usam só a lista de revendedores (45% clicam)
insert into public.widget_events
  (tenant_id, session_id, event_type, query_text, product_id, city, state, results_count, created_at, telemetry_v, location_source, action, reseller_id)
with t as (select id from public.tenants where slug = :'slug'),
janela as (select :'ini'::timestamptz as ini, greatest(1, ceil(extract(epoch from (:'fim'::timestamptz - :'ini'::timestamptz)) / 86400.0)::int) as dias),
base as (
  select e.session_id,
         min(e.created_at) as t0,
         (array_agg(e.product_id order by e.created_at) filter (where e.product_id is not null))[1] as product_id,
         (array_agg(e.query_text order by e.created_at) filter (where e.product_id is not null))[1] as termo,
         (array_agg(e.city order by e.created_at) filter (where e.product_id is not null))[1] as city,
         (array_agg(e.state order by e.created_at) filter (where e.product_id is not null))[1] as state,
         abs(hashtext(e.session_id || 'f')) % 100 as h
    from public.widget_events e
   where e.tenant_id = (select id from t) and e.session_id like :'prefix' || '%' and e.event_type = 'search' and e.product_id is not null
   group by e.session_id
),
lugares as (
  select a.city, a.state, count(*)::int as n, (array_agg(r.id order by r.name))[1 + abs(hashtext(a.city)) % count(*)] as reseller_id
    from public.resellers r join public.addresses a on a.reseller_id = r.id
   where r.tenant_id = (select id from t) and r.status = 'active' and r.type <> 'online' and a.city is not null and a.state is not null
   group by a.city, a.state
),
lug as (select *, row_number() over (order by city, state) as rn, count(*) over () as total from lugares),
extra as (
  select i,
         (abs(hashtext('lx' || i || :'prefix')) % 10000) / 10000.0 as ru,
         (abs(hashtext('lh' || i || :'prefix')) % 1000) / 1000.0 as rh,
         abs(hashtext('lm' || i || :'prefix')) % 60 as rm,
         abs(hashtext('ly' || i || :'prefix')) % 100 as hc,
         abs(hashtext('lz' || i || :'prefix')) % 4 as ha
    from generate_series(1, greatest(1, ((select count(*) from base) * 12 / 100)::int)) i
),
extra_l as (
  select x.*, l.city, l.state, l.n, l.reseller_id,
         ((select ini from janela) + ((floor(x.ru * (select dias from janela)))::int) * interval '1 day'
            + (8 + floor(x.rh * 15)::int) * interval '1 hour' + x.rm * interval '1 minute') as quando
    from extra x join lug l on l.rn = 1 + (abs(hashtext('lw' || x.i || :'prefix')) % l.total)
)
select (select id from t), b.session_id, 'product_select', null::text, b.product_id, null::text, null::text, null::int, b.t0 - interval '25 seconds', 2::smallint, null::text, null::text, null::uuid
  from base b
union all
select (select id from t), b.session_id, 'catalog_search', lower(b.termo), null, null, null, 1 + b.h % 3, b.t0 - interval '50 seconds', 2, null, null, null
  from base b where b.h < 70 and b.termo is not null
union all
select (select id from t), b.session_id, 'list_open', null, null, null, null, null, b.t0 + interval '3 minutes', 2, null, null, null
  from base b where b.h >= 70 and b.h < 85
union all
select (select id from t), b.session_id, 'list_search', null, null, b.city, b.state, 1 + b.h % 6, b.t0 + interval '3 minutes 10 seconds', 2, 'none', null, null
  from base b where b.h >= 70 and b.h < 85 and b.state is not null
union all
select (select id from t), :'prefix' || 'lst-' || x.i, 'list_open', null, null, null, null, null, x.quando, 2, null, null, null
  from extra_l x
union all
select (select id from t), :'prefix' || 'lst-' || x.i, 'list_search', null, null, x.city, x.state, x.n, x.quando + interval '12 seconds', 2, 'none', null, null
  from extra_l x
union all
select (select id from t), :'prefix' || 'lst-' || x.i, 'reseller_click', null, null, x.city, x.state, null, x.quando + interval '40 seconds', 2, null,
       (array['whatsapp','call','site','directions'])[1 + x.ha], x.reseller_id
  from extra_l x where x.hc < 45;
