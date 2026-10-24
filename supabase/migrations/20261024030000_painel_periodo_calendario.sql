-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- ============================================================
-- Painel: períodos de calendário (hoje, esta semana, semana passada, este mês, mês anterior, este ano, personalizado)
--
-- Por quê: as funções do painel só aceitavam "últimos N dias" (p_days). Para períodos de calendário elas precisam de início e fim.
-- Como: ADITIVO. Quatro funções novas (sufixo _r = "range") com a MESMA lógica e o MESMO formato de resposta das atuais, trocando
-- "agora − N dias" por um intervalo [p_from, p_to) informado pelo painel. As funções atuais (panel_overview, panel_resellers,
-- panel_gaps, panel_funnel) NÃO são tocadas: o painel já publicado continua funcionando até a nova versão entrar. Depois que o painel
-- novo estiver no ar e estável, as antigas podem ser removidas.
--
-- Regras:
--   * intervalo meio aberto [p_from, p_to); p_to é limitado a "agora"; duração máxima de 366 dias (a retenção é de 12 meses).
--   * panel_overview_r recebe também o período de comparação [p_prev_from, p_prev_to), calculado pelo painel (mesmos dias do período anterior,
--     para que um mês pela metade não seja comparado com um mês inteiro).
--   * se o período tem até 24 horas (hoje, um dia), a série vem POR HORA (granularidade 'hora', chave "AAAA-MM-DDTHH:00", horário de Brasília);
--     senão, por dia de calendário em America/Sao_Paulo.
--   * período inválido (início >= fim, nulo, mais de 366 dias) levanta erro 22023. Quem não é membro do cliente recebe null.
--
-- Como aplicar: SQL Editor ou conector (CREATE OR REPLACE; sem DROP). Idempotente. Testes: supabase/tests/16_painel_periodo.sql
-- ============================================================

create or replace function public.panel_overview_r(
  p_tenant_id uuid, p_from timestamptz, p_to timestamptz, p_prev_from timestamptz, p_prev_to timestamptz)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_days      integer;
  v_to        timestamptz := least(p_to, now());
  v_from      timestamptz := p_from;
  v_prev_from timestamptz := p_prev_from;
  v_prev_to   timestamptz := p_prev_to;
  v_hourly    boolean;
  v_tz        constant text := 'America/Sao_Paulo';
  v_result    jsonb;
begin
  if not public.is_tenant_member(p_tenant_id) then
    return null;
  end if;


  if p_from is null or p_to is null or p_prev_from is null or p_prev_to is null
     or p_from >= p_to or p_prev_from >= p_prev_to or p_to - p_from > interval '366 days' then
    raise exception 'período inválido' using errcode = '22023';
  end if;
  v_days := greatest(1, ceil(extract(epoch from (v_to - p_from)) / 86400.0)::int);
  v_hourly := (v_to - v_from) <= interval '24 hours';

  with ev as (
    select e.*
      from public.widget_events e
     where e.tenant_id = p_tenant_id
       and ((e.created_at >= v_prev_from and e.created_at < v_prev_to) or (e.created_at >= v_from and e.created_at < v_to))
  ),
  cur as (select * from ev where created_at >= v_from and created_at < v_to),
  prv as (select * from ev where created_at >= v_prev_from and created_at < v_prev_to),
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
    'periodo', jsonb_build_object('dias', v_days, 'de', v_from, 'ate', v_to, 'anterior_de', v_prev_from, 'anterior_ate', v_prev_to,
                                  'granularidade', case when v_hourly then 'hora' else 'dia' end),
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
    'serie', case when v_hourly then coalesce((
      select jsonb_agg(jsonb_build_object('dia', to_char(h.hora, 'YYYY-MM-DD"T"HH24":00"'), 'buscas', coalesce(b.n, 0), 'cliques', coalesce(c.n, 0)) order by h.hora)
        from (select g as hora
                from generate_series(date_trunc('hour', v_from at time zone v_tz), date_trunc('hour', (v_to - interval '1 second') at time zone v_tz), interval '1 hour') g) h
        left join (select date_trunc('hour', created_at at time zone v_tz) as hora, count(*) as n from cur where event_type = 'search' group by 1) b on b.hora = h.hora
        left join (select date_trunc('hour', created_at at time zone v_tz) as hora, count(*) as n from cur where event_type = 'reseller_click' group by 1) c on c.hora = h.hora
    ), '[]'::jsonb) else coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia, 'buscas', coalesce(b.n, 0), 'cliques', coalesce(c.n, 0)) order by d.dia)
        from (select g::date as dia
                from generate_series(date_trunc('day', v_from at time zone v_tz), date_trunc('day', (v_to - interval '1 second') at time zone v_tz), interval '1 day') g) d
        left join (select (created_at at time zone v_tz)::date as dia, count(*) as n from cur where event_type = 'search' group by 1) b on b.dia = d.dia
        left join (select (created_at at time zone v_tz)::date as dia, count(*) as n from cur where event_type = 'reseller_click' group by 1) c on c.dia = d.dia
    ), '[]'::jsonb) end,
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
    'mapa_demanda', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select coalesce(nullif(btrim(city), ''), 'Local não identificado') as cidade,
               nullif(btrim(state), '') as uf,
               round(avg(lat_approx)::numeric, 3) as lat,
               round(avg(lng_approx)::numeric, 3) as lng,
               count(*) as buscas,
               count(*) filter (where product_id is not null and coalesce(results_count, 0) = 0) as sem_cobertura
          from cur
         where event_type = 'search' and lat_approx is not null and lng_approx is not null
         group by 1, 2
         order by buscas desc, cidade
         limit 60) x), '[]'::jsonb),
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

create or replace function public.panel_resellers_r(p_tenant_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_days int;
  v_to timestamptz := least(p_to, now());
begin
  if not public.is_tenant_member(p_tenant_id) then
    return null;
  end if;

  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > interval '366 days' then
    raise exception 'período inválido' using errcode = '22023';
  end if;
  v_days := greatest(1, ceil(extract(epoch from (v_to - p_from)) / 86400.0)::int);
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.contatos desc, x.nome)
      from (
        select r.id,
               r.name as nome,
               r.type as tipo,
               a.city as cidade,
               a.state as uf,
               count(e.id)::int                                    as contatos,
               (count(e.id) filter (where e.action = 'whatsapp'))::int  as whatsapp,
               (count(e.id) filter (where e.action = 'call'))::int      as ligar,
               (count(e.id) filter (where e.action = 'directions'))::int as rota,
               (count(e.id) filter (where e.action = 'site'))::int      as site,
               max(e.created_at)                                   as ultimo_contato
          from public.resellers r
          left join public.addresses a on a.reseller_id = r.id
          left join public.widget_events e
                 on e.reseller_id = r.id
                and e.tenant_id = r.tenant_id
                and e.event_type = 'reseller_click'
                and e.created_at >= p_from and e.created_at < v_to
         where r.tenant_id = p_tenant_id and r.status = 'active'
         group by r.id, r.name, r.type, a.city, a.state
      ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.panel_gaps_r(p_tenant_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_days int;
  v_from timestamptz := p_from;
  v_to timestamptz := least(p_to, now());
  v_result jsonb;
begin
  if not public.is_tenant_member(p_tenant_id) then
    return null;
  end if;

  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > interval '366 days' then
    raise exception 'período inválido' using errcode = '22023';
  end if;
  v_days := greatest(1, ceil(extract(epoch from (v_to - p_from)) / 86400.0)::int);

  with cur as (
    select e.product_id, e.city, e.state, e.session_id
      from public.widget_events e
     where e.tenant_id = p_tenant_id
       and e.created_at >= v_from and e.created_at < v_to
       and e.event_type = 'search'
       and e.product_id is not null
       and coalesce(e.results_count, 0) = 0
  ),
  g as (
    select p.id as product_id, p.sku, p.name as produto,
           coalesce(nullif(btrim(c.city), ''), 'Local não identificado') as cidade,
           nullif(btrim(c.state), '') as uf,
           count(*) as buscas,
           count(distinct c.session_id) as sessoes
      from cur c join public.products p on p.id = c.product_id
     group by p.id, p.sku, p.name, 4, 5
  )
  select jsonb_build_object(
    'dias', v_days,
    'total_buscas', coalesce((select sum(buscas) from g), 0),
    'combinacoes', (select count(*) from g),
    'itens', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select product_id, sku, produto, cidade, uf, buscas, sessoes
          from g order by buscas desc, cidade, produto limit 500) x), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.panel_funnel_r(p_tenant_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_days int;
  v_to timestamptz := least(p_to, now());
  v_out jsonb;
begin
  if not public.is_tenant_member(p_tenant_id) then
    return null;
  end if;

  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > interval '366 days' then
    raise exception 'período inválido' using errcode = '22023';
  end if;
  v_days := greatest(1, ceil(extract(epoch from (v_to - p_from)) / 86400.0)::int);

  with cur as (
    select e.session_id, e.event_type, e.product_id, e.results_count, e.query_text
      from public.widget_events e
     where e.tenant_id = p_tenant_id
       and e.session_id is not null
       and e.created_at >= p_from and e.created_at < v_to
  ),
  inter     as (select distinct session_id from cur),
  typed     as (select distinct session_id from cur where event_type = 'catalog_search' or (event_type = 'search' and product_id is null)),
  prod      as (select distinct session_id from cur where event_type = 'product_select' or (event_type = 'search' and product_id is not null)),
  loc       as (select distinct session_id from cur where event_type = 'search' and product_id is not null),
  cov       as (select distinct session_id from cur where event_type = 'search' and product_id is not null and coalesce(results_count, 0) > 0),
  click_any as (select distinct session_id from cur where event_type = 'reseller_click'),
  lst       as (select distinct session_id from cur where event_type = 'list_open'),
  lst_f     as (select distinct session_id from cur where event_type = 'list_search' and session_id in (select session_id from lst)),
  terms     as (
    select lower(query_text) as termo,
           count(*)::int as buscas,
           bool_or(event_type = 'catalog_search') as achou
      from cur
     where (event_type = 'catalog_search' or (event_type = 'search' and product_id is null))
       and nullif(btrim(query_text), '') is not null
     group by 1
     order by 2 desc, 1
     limit 10
  )
  select jsonb_build_object(
    'dias', v_days,
    'visitas', (select count(*) from inter),
    'digitaram', (select count(*) from typed),
    'visitas_com_clique', (select count(*) from click_any),
    'produto', jsonb_build_object(
      'escolheram', (select count(*) from prod),
      'localizacao', (select count(*) from loc),
      'com_revendedor', (select count(*) from cov),
      'clicaram', (select count(*) from cov where session_id in (select session_id from click_any))
    ),
    'lista', jsonb_build_object(
      'abriram', (select count(*) from lst),
      'filtraram', (select count(*) from lst_f),
      'clicaram', (select count(*) from lst where session_id in (select session_id from click_any))
    ),
    'termos', coalesce((select jsonb_agg(to_jsonb(t) order by t.buscas desc, t.termo) from terms t), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.panel_overview_r(uuid, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
revoke all on function public.panel_resellers_r(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.panel_gaps_r(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.panel_funnel_r(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.panel_overview_r(uuid, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.panel_resellers_r(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.panel_gaps_r(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.panel_funnel_r(uuid, timestamptz, timestamptz) to authenticated, service_role;

-- leitura de IA: chave do período (ex.: '7d', 'mes', 'pers:2026-10-01:2026-10-20'); a coluna dias continua existindo
alter table public.panel_ai_readings add column if not exists chave text;
create index if not exists panel_ai_readings_chave_idx on public.panel_ai_readings (tenant_id, chave, created_at desc);
