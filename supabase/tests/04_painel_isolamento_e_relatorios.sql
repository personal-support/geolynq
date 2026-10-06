\set QUIET on
create temp table res(k text, v jsonb);
grant all on res to public;
select count(*) as eventos_carregados from widget_events \gset
\echo eventos_carregados :eventos_carregados
-- A: membro do fabrica-teste
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000aa', false) \gset
insert into res select 'A_overview_30d', public.panel_overview((select id from public.tenants where slug='fabrica-teste'), 30);
insert into res select 'A_overview_7d_kpis', (public.panel_overview((select id from public.tenants where slug='fabrica-teste'), 7))->'kpis';
insert into res select 'A_catalog', public.panel_catalog((select id from public.tenants where slug='fabrica-teste'));
insert into res select 'A_ve_tenant', (select to_jsonb(t) from public.tenants t where t.slug='fabrica-teste');
insert into res select 'A_tenants_visiveis', to_jsonb((select count(*) from public.tenants));
insert into res select 'A_eventos_visiveis_total', to_jsonb((select count(*) from public.widget_events));
reset role;
-- B: usuario so do demo
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000bb', false) \gset
insert into res select 'B_overview_fabrica_e_nulo', to_jsonb(public.panel_overview((select id from public.tenants where slug='fabrica-teste'), 30) is null);
insert into res select 'B_catalog_fabrica_e_nulo', to_jsonb(public.panel_catalog((select id from public.tenants where slug='fabrica-teste')) is null);
insert into res select 'B_eventos_fabrica_visiveis', to_jsonb((select count(*) from public.widget_events where tenant_id = (select id from public.tenants where slug='fabrica-teste')));
insert into res select 'B_produtos_fabrica_visiveis', to_jsonb((select count(*) from public.products where tenant_id = (select id from public.tenants where slug='fabrica-teste')));
insert into res select 'B_tenants_visiveis', to_jsonb((select count(*) from public.tenants));
insert into res select 'B_overview_demo_funciona', to_jsonb(public.panel_overview((select id from public.tenants where slug='demo'), 30) is not null);
reset role;
-- C: anonimo
set role anon;
select set_config('request.jwt.claim.sub', '', false) \gset
insert into res select 'C_anon_tenants_visiveis', to_jsonb((select count(*) from public.tenants));
insert into res select 'C_anon_eventos_visiveis', to_jsonb((select count(*) from public.widget_events));
reset role;
insert into res select 'C_anon_pode_executar_overview', to_jsonb(has_function_privilege('anon','public.panel_overview(uuid,integer)','execute'));
insert into res select 'C_anon_pode_executar_catalog', to_jsonb(has_function_privilege('anon','public.panel_catalog(uuid)','execute'));
\o /tmp/res.json
select jsonb_pretty(jsonb_object_agg(k, v)) from res;
\o
