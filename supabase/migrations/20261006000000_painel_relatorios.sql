-- ============================================================
-- Fase 5 — Painel do cliente: relatórios (somente leitura)
--
-- O painel NÃO usa service_role: o usuário logado (Supabase Auth) lê pelo papel `authenticated`, e a isolação entre clientes
-- vem do RLS que já existe (tenant_admin_* via tenant_users). As funções abaixo são SECURITY INVOKER (o RLS continua valendo)
-- e, por segurança extra, devolvem NULL se o usuário não for membro do tenant pedido.
--
-- Aditiva e idempotente (CREATE OR REPLACE / DROP POLICY IF EXISTS só da policy nova). Sem DROP de tabela/coluna/função antiga.
--
-- Conteúdo:
--   1. policy tenant_members_read_tenant  -> o usuário vê a PRÓPRIA linha em `tenants` (nome, slug, status, cor).
--   2. is_tenant_member(tenant)            -> helper.
--   3. panel_overview(tenant, dias)        -> demanda e lacunas (Categoria 1 e 3 do blueprint): KPIs, série diária, produtos mais
--                                              buscados, lacunas produto x cidade, buscas fora do catálogo, regiões, ações.
--   4. panel_catalog(tenant)               -> saúde do catálogo e cobertura (Categoria 2): produtos sem revendedor, revendedores
--                                              sem produto, rede por UF/cidade/tipo, completude, última importação.
-- Definições (para ninguém interpretar errado depois):
--   * "busca"        = evento event_type='search'.            * "sessão" = session_id distinto.
--   * "conversão"    = % das sessões com busca que tiveram >= 1 clique em revendedor (não é cliques/buscas).
--   * "sem cobertura"= busca com produto identificado e results_count = 0 (a partir da telemetria v2 = nenhum revendedor FÍSICO
--                      no raio; na v1 = nenhum resultado).
--   * "fora do catálogo" = busca sem produto identificado (product_id nulo) e com termo digitado.
--   * 'distancia_media_km' = média de nearest_km das buscas ATENDIDAS (sem revendedor no raio o widget não grava distância).
--   * dias do calendário em America/Sao_Paulo; período anterior = mesma duração imediatamente antes.
-- ============================================================

-- 1. O usuário logado enxerga o próprio cliente (antes: `tenants` tinha RLS e nenhuma policy -> o painel não conseguiria o nome).
drop policy if exists tenant_members_read_tenant on public.tenants;
create policy tenant_members_read_tenant on public.tenants
  for select to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.tenant_id = tenants.id and tu.user_id = auth.uid()));

-- 2. helper
create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and exists (select 1 from public.tenant_users tu where tu.tenant_id = p_tenant_id and tu.user_id = auth.uid());
$$;

-- 3. demanda e lacunas
create or replace function public.panel_overview(p_tenant_id uuid, p_days integer default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_days      integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_to        timestamptz := now();
  v_from      timestamptz;
  v_prev_from timestamptz;
  v_tz        constant text := 'America/Sao_Paulo';
  v_result    jsonb;
begin
  if not public.is_tenant_member(p_tenant_id) then
    return null;
  end if;

  v_from      := v_to - make_interval(days => v_days);
  v_prev_from := v_from - make_interval(days => v_days);

  with ev as (
    select e.*
      from public.widget_events e
     where e.tenant_id = p_tenant_id and e.created_at >= v_prev_from and e.created_at <= v_to
  ),
  cur as (select * from ev where created_at >= v_from),
  prv as (select * from ev where created_at <  v_from),
  k as (
    select
      count(*) filter (where event_type = 'search')                                                        as buscas,
      count(distinct session_id) filter (where event_type = 'search')                                      as sessoes,
      count(*) filter (where event_type = 'reseller_click')                                                as cliques,
      count(*) filter (where event_type = 'search' and product_id is not null)                             as buscas_com_produto,
      count(*) filter (where event_type = 'search' and product_id is not null and coalesce(results_count, 0) = 0) as sem_cobertura,
      count(*) filter (where event_type = 'search' and product_id is null)                                 as fora_do_catalogo,
      round((avg(nearest_km) filter (where event_type = 'search' and nearest_km is not null))::numeric, 1) as distancia_media_km,
      (select count(distinct s.session_id)
         from cur s
        where s.event_type = 'search' and s.session_id is not null
          and exists (select 1 from cur c where c.event_type = 'reseller_click' and c.session_id = s.session_id)) as sessoes_com_clique
    from cur
  ),
  kp as (
    select
      count(*) filter (where event_type = 'search')                                                        as buscas,
      count(distinct session_id) filter (where event_type = 'search')                                      as sessoes,
      count(*) filter (where event_type = 'reseller_click')                                                as cliques,
      count(*) filter (where event_type = 'search' and product_id is not null and coalesce(results_count, 0) = 0) as sem_cobertura
    from prv
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('dias', v_days, 'de', v_from, 'ate', v_to, 'anterior_de', v_prev_from),
    'kpis', (select jsonb_build_object(
        'buscas', k.buscas, 'sessoes', k.sessoes, 'cliques', k.cliques,
        'conversao_pct', case when k.sessoes > 0 then round(100.0 * k.sessoes_com_clique / k.sessoes, 1) end,
        'buscas_com_produto', k.buscas_com_produto,
        'sem_cobertura', k.sem_cobertura,
        'cobertura_pct', case when k.buscas_com_produto > 0 then round(100.0 * (k.buscas_com_produto - k.sem_cobertura) / k.buscas_com_produto, 1) end,
        'fora_do_catalogo', k.fora_do_catalogo,
        'distancia_media_km', k.distancia_media_km) from k),
    'anterior', (select jsonb_build_object(
        'buscas', kp.buscas, 'sessoes', kp.sessoes, 'cliques', kp.cliques, 'sem_cobertura', kp.sem_cobertura) from kp),
    'serie', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia, 'buscas', coalesce(b.n, 0), 'cliques', coalesce(c.n, 0)) order by d.dia)
        from (select g::date as dia
                from generate_series(date_trunc('day', v_from at time zone v_tz), date_trunc('day', v_to at time zone v_tz), interval '1 day') g) d
        left join (select (created_at at time zone v_tz)::date as dia, count(*) as n from cur where event_type = 'search' group by 1) b on b.dia = d.dia
        left join (select (created_at at time zone v_tz)::date as dia, count(*) as n from cur where event_type = 'reseller_click' group by 1) c on c.dia = d.dia
    ), '[]'::jsonb),
    'top_produtos', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select p.id, p.sku, p.name,
               count(*) filter (where e.event_type = 'search')         as buscas,
               count(*) filter (where e.event_type = 'reseller_click') as cliques,
               count(*) filter (where e.event_type = 'search' and coalesce(e.results_count, 0) = 0) as sem_cobertura
          from cur e join public.products p on p.id = e.product_id
         group by p.id, p.sku, p.name
         order by buscas desc, cliques desc, p.name
         limit 10) x), '[]'::jsonb),
    'lacunas', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select p.id as product_id, p.sku, p.name as produto,
               coalesce(nullif(btrim(e.city), ''), 'Local não identificado') as cidade,
               nullif(btrim(e.state), '') as uf,
               count(*) as buscas,
               count(distinct e.session_id) as sessoes
          from cur e join public.products p on p.id = e.product_id
         where e.event_type = 'search' and coalesce(e.results_count, 0) = 0
         group by p.id, p.sku, p.name, 4, 5
         order by buscas desc, cidade, p.name
         limit 30) x), '[]'::jsonb),
    'fora_do_catalogo', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select lower(btrim(query_text)) as termo, count(*) as buscas, count(distinct session_id) as sessoes
          from cur
         where event_type = 'search' and product_id is null and nullif(btrim(query_text), '') is not null
         group by 1
         order by buscas desc, termo
         limit 20) x), '[]'::jsonb),
    'regioes', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select coalesce(nullif(btrim(city), ''), 'Local não identificado') as cidade,
               nullif(btrim(state), '') as uf,
               count(*) as buscas,
               count(*) filter (where product_id is not null and coalesce(results_count, 0) = 0) as sem_cobertura
          from cur
         where event_type = 'search'
         group by 1, 2
         order by buscas desc, cidade
         limit 10) x), '[]'::jsonb),
    'acoes', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select action as acao, count(*) as cliques
          from cur
         where event_type = 'reseller_click' and action is not null
         group by 1
         order by cliques desc) x), '[]'::jsonb),
    'tem_telemetria_v2', exists (select 1 from cur where telemetry_v >= 2)
  ) into v_result;

  return v_result;
end;
$$;

-- 4. saúde do catálogo e rede
create or replace function public.panel_catalog(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.is_tenant_member(p_tenant_id) then
    return null;
  end if;

  with rev as (
    select r.id, r.name, r.type, r.status, r.phone, r.whatsapp, r.website, r.cnpj,
           a.city, a.state, a.neighborhood, a.latitude, a.longitude
      from public.resellers r
      left join lateral (select * from public.addresses x where x.reseller_id = r.id order by x.created_at limit 1) a on true
     where r.tenant_id = p_tenant_id and r.status = 'active'
  ),
  cov as (
    select c.product_id, c.reseller_id from public.product_reseller_coverage c where c.tenant_id = p_tenant_id
  ),
  prod as (
    select p.id, p.sku, p.name, p.category,
           count(distinct rv.id)                                   as revendedores,
           count(distinct rv.id) filter (where rv.type <> 'online') as fisicos,
           coalesce(array_agg(distinct rv.state) filter (where rv.state is not null and rv.type <> 'online'), '{}') as ufs
      from public.products p
      left join cov on cov.product_id = p.id
      left join rev rv on rv.id = cov.reseller_id
     where p.tenant_id = p_tenant_id and p.active
     group by p.id, p.sku, p.name, p.category
  ),
  imp as (
    select b.status, b.rows_processed, b.rows_failed, b.completed_at, b.created_at,
           (select count(*) from jsonb_array_elements(coalesce(b.error_log, '[]'::jsonb)) x where coalesce(x->>'_error', '') not like 'AVISO%') as erros,
           (select count(*) from jsonb_array_elements(coalesce(b.error_log, '[]'::jsonb)) x where coalesce(x->>'_error', '') like 'AVISO%') as avisos
      from public.import_batches b
     where b.tenant_id = p_tenant_id
     order by coalesce(b.completed_at, b.created_at) desc
     limit 1
  )
  select jsonb_build_object(
    'produtos_ativos',     (select count(*) from prod),
    'revendedores_ativos', (select count(*) from rev),
    'produtos', coalesce((select jsonb_agg(to_jsonb(p) order by p.name) from prod p), '[]'::jsonb),
    'produtos_sem_revendedor', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'sku', p.sku, 'name', p.name) order by p.name) from prod p where p.revendedores = 0), '[]'::jsonb),
    'produtos_sem_revendedor_fisico', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'sku', p.sku, 'name', p.name, 'online', p.revendedores) order by p.name)
        from prod p where p.revendedores > 0 and p.fisicos = 0), '[]'::jsonb),
    'revendedores_sem_produto', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'type', r.type, 'city', r.city, 'state', r.state) order by r.name)
        from rev r where not exists (select 1 from cov where cov.reseller_id = r.id)), '[]'::jsonb),
    'por_uf', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.revendedores desc, x.uf) from (
        select coalesce(state, '—') as uf, count(*) as revendedores,
               count(*) filter (where type <> 'online') as fisicos, count(*) filter (where type = 'online') as online
          from rev group by 1) x), '[]'::jsonb),
    'por_cidade', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select coalesce(city, '—') as cidade, state as uf, count(*) as revendedores
          from rev where type <> 'online' group by 1, 2 order by revendedores desc, cidade limit 15) x), '[]'::jsonb),
    'por_tipo', coalesce((
      select jsonb_agg(to_jsonb(x)) from (select type as tipo, count(*) as revendedores from rev group by 1 order by 2 desc) x), '[]'::jsonb),
    'completude', (select jsonb_build_object(
        'total', count(*),
        'com_whatsapp', count(*) filter (where nullif(btrim(whatsapp), '') is not null),
        'com_telefone', count(*) filter (where nullif(btrim(phone), '') is not null),
        'com_cnpj',     count(*) filter (where cnpj is not null),
        'com_site',     count(*) filter (where nullif(btrim(website), '') is not null),
        'fisicos',      count(*) filter (where type <> 'online'),
        'fisicos_com_coordenadas', count(*) filter (where type <> 'online' and latitude is not null and longitude is not null))
      from rev),
    'ultima_importacao', (select to_jsonb(i) from imp i)
  ) into v_result;

  return v_result;
end;
$$;

-- só quem está logado pode chamar (as funções já devolvem NULL para não-membros)
revoke all on function public.is_tenant_member(uuid)            from public, anon;
revoke all on function public.panel_overview(uuid, integer)     from public, anon;
revoke all on function public.panel_catalog(uuid)               from public, anon;
grant execute on function public.is_tenant_member(uuid)        to authenticated, service_role;
grant execute on function public.panel_overview(uuid, integer) to authenticated, service_role;
grant execute on function public.panel_catalog(uuid)           to authenticated, service_role;
