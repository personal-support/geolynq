-- ===== EVENTOS DE FUNIL SIMULADOS — complementa as buscas simuladas (03_ / 06_) com a navegação que vem antes e depois =====
-- Uso (psql):  psql -v slug=demo -v prefix=seed-pod- -f 11_eventos_funil_simulados.sql        (marca fictícia Pódio)
--              psql -v slug=fabrica-teste -v prefix=seed- -f 11_eventos_funil_simulados.sql    (cliente de teste local)
-- No conector/SQL Editor, troque :'slug' e :'prefix' pelos valores entre aspas simples.
-- Para cada sessão simulada que tem busca com produto: product_select 25 s antes e, em ~70%, catalog_search 50 s antes; em ~15% a pessoa
-- também abre e filtra a lista. Mais ~12% de sessões extras que usam SÓ a lista (45% clicam num revendedor real do cliente).
-- Todas as sessões novas começam com o prefixo informado (para apagar depois junto com as demais: delete ... like 'seed-%').
-- Roda uma vez só: se já houver product_select simulado com este prefixo, não insere nada.
insert into public.widget_events
  (tenant_id, session_id, event_type, query_text, product_id, city, state, results_count, created_at, telemetry_v, location_source, action, reseller_id)
with t as (select id from public.tenants where slug = :'slug'),
guard as (
  select not exists (select 1 from public.widget_events e where e.tenant_id = (select id from t) and e.event_type = 'product_select' and e.session_id like :'prefix' || '%') as ok
),
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
-- cidades onde há revendedor físico ativo (para as sessões que só usam a lista)
lugares as (
  select a.city, a.state, count(*)::int as n, (array_agg(r.id order by r.name))[1 + abs(hashtext(a.city)) % count(*)] as reseller_id
    from public.resellers r join public.addresses a on a.reseller_id = r.id
   where r.tenant_id = (select id from t) and r.status = 'active' and r.type <> 'online' and a.city is not null and a.state is not null
   group by a.city, a.state
),
lug as (select *, row_number() over (order by city, state) as rn, count(*) over () as total from lugares),
extra as (
  select i,
         (abs(hashtext('lx' || i)) % 10000) / 10000.0 as ru,
         abs(hashtext('ly' || i)) % 100 as hc,
         abs(hashtext('lz' || i)) % 4 as ha
    from generate_series(1, greatest(1, ((select count(*) from base) * 12 / 100)::int)) i
),
extra_l as (
  select x.*, l.city, l.state, l.n, l.reseller_id,
         now() - interval '60 days' * power(x.ru, 1.5) as quando
    from extra x join lug l on l.rn = 1 + (abs(hashtext('lw' || x.i)) % l.total)
)
select (select id from t), b.session_id, 'product_select', null::text, b.product_id, null::text, null::text, null::int, b.t0 - interval '25 seconds', 2::smallint, null::text, null::text, null::uuid
  from base b where (select ok from guard)
union all
select (select id from t), b.session_id, 'catalog_search', lower(b.termo), null, null, null, 1 + b.h % 3, b.t0 - interval '50 seconds', 2, null, null, null
  from base b where (select ok from guard) and b.h < 70 and b.termo is not null
union all
select (select id from t), b.session_id, 'list_open', null, null, null, null, null, b.t0 + interval '3 minutes', 2, null, null, null
  from base b where (select ok from guard) and b.h >= 70 and b.h < 85
union all
select (select id from t), b.session_id, 'list_search', null, null, b.city, b.state, 1 + b.h % 6, b.t0 + interval '3 minutes 10 seconds', 2, 'none', null, null
  from base b where (select ok from guard) and b.h >= 70 and b.h < 85 and b.state is not null
union all
select (select id from t), :'prefix' || 'lst-' || x.i, 'list_open', null, null, null, null, null, x.quando, 2, null, null, null
  from extra_l x where (select ok from guard)
union all
select (select id from t), :'prefix' || 'lst-' || x.i, 'list_search', null, null, x.city, x.state, x.n, x.quando + interval '12 seconds', 2, 'none', null, null
  from extra_l x where (select ok from guard)
union all
select (select id from t), :'prefix' || 'lst-' || x.i, 'reseller_click', null, null, x.city, x.state, null, x.quando + interval '40 seconds', 2, null,
       (array['whatsapp','call','site','directions'])[1 + x.ha], x.reseller_id
  from extra_l x where (select ok from guard) and x.hc < 45;
