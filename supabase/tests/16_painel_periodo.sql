-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- 16 — Painel: períodos de calendário (migration 20261024030000). Transação com ROLLBACK; imprime "OK 16".
-- Pré-requisitos: migrations aplicadas; tenant `demo` com eventos simulados (06_/11_/14_) para o teste ter o que contar.
-- 1) as funções novas (_r), no mesmo intervalo "últimos 30 dias", devolvem EXATAMENTE o que as antigas devolvem;
-- 2) hoje (série por hora), este mês, semana passada e mês anterior batem com a contagem direta na tabela;
-- 3) período inválido dá erro; quem não é do cliente recebe null.
begin;

-- um usuário membro do demo e um estranho
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d1', 'membro16@teste'), ('00000000-0000-4000-8000-0000000000d2', 'estranho16@teste');
insert into public.tenant_users (tenant_id, user_id, role) select id, '00000000-0000-4000-8000-0000000000d1', 'viewer' from public.tenants where slug = 'demo';

-- eventos de HOJE (uma busca e um clique, 1 minuto atrás) para o teste de "hoje" ter o que contar
insert into public.widget_events (tenant_id, session_id, event_type, query_text, created_at, telemetry_v, product_id, results_count)
  select t.id, 'teste-16', 'search', 'whey', now() - interval '1 minute', 2, (select id from public.products where tenant_id = t.id and sku = 'WPC-900'), 3
    from public.tenants t where t.slug = 'demo';
insert into public.widget_events (tenant_id, session_id, event_type, created_at, telemetry_v, action, reseller_id)
  select t.id, 'teste-16', 'reseller_click', now() - interval '30 seconds', 2, 'whatsapp', (select id from public.resellers where tenant_id = t.id limit 1)
    from public.tenants t where t.slug = 'demo';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000d1', true);

do $t$
declare
  t uuid := (select id from public.tenants where slug = 'demo');
  agora timestamptz := now();
  tz constant text := 'America/Sao_Paulo';
  a jsonb; b jsonb; k text; n_direto int; c_direto int;
  ini_hoje timestamptz := date_trunc('day', agora at time zone tz) at time zone tz;
  ini_mes timestamptz := date_trunc('month', agora at time zone tz) at time zone tz;
  ini_mes_ant timestamptz := (date_trunc('month', agora at time zone tz) - interval '1 month') at time zone tz;
  ini_sem timestamptz := date_trunc('week', agora at time zone tz) at time zone tz;      -- segunda-feira 00:00 (ISO)
  ini_sem_ant timestamptz := (date_trunc('week', agora at time zone tz) - interval '7 days') at time zone tz;
  ok_erro boolean;
begin
  assert t is not null, 'tenant demo não existe';

  -- 1) equivalência com as funções antigas (mesmos 30 dias; now() é o mesmo na transação)
  a := public.panel_overview(t, 30);
  b := public.panel_overview_r(t, agora - interval '30 days', agora, agora - interval '60 days', agora - interval '30 days');
  assert a is not null and b is not null, 'overview nulo para membro';
  foreach k in array array['kpis', 'anterior', 'serie', 'top_produtos', 'lacunas', 'fora_do_catalogo', 'regioes', 'mapa_demanda', 'acoes', 'tem_telemetria_v2'] loop
    assert a -> k = b -> k, 'overview diverge em ' || k || E'\nantigo: ' || left((a -> k)::text, 300) || E'\nnovo:   ' || left((b -> k)::text, 300);
  end loop;
  assert (a #>> '{periodo,dias}')::int = (b #>> '{periodo,dias}')::int, 'dias do período diferem';
  assert b #>> '{periodo,granularidade}' = 'dia', 'granularidade de 30 dias deveria ser dia';
  assert (a #> '{kpis,buscas}')::text::int > 0, 'o demo deveria ter buscas nos últimos 30 dias (carregue 06_/11_/14_)';

  assert public.panel_resellers(t, 30) = public.panel_resellers_r(t, agora - interval '30 days', agora), 'resellers diverge';
  assert public.panel_gaps(t, 30) = public.panel_gaps_r(t, agora - interval '30 days', agora), 'gaps diverge';
  assert public.panel_funnel(t, 30) = public.panel_funnel_r(t, agora - interval '30 days', agora), 'funnel diverge';
  -- idem em 7 e 90 dias
  assert (public.panel_overview(t, 7) -> 'kpis') = (public.panel_overview_r(t, agora - interval '7 days', agora, agora - interval '14 days', agora - interval '7 days') -> 'kpis'), 'kpis 7d';
  assert public.panel_gaps(t, 90) = public.panel_gaps_r(t, agora - interval '90 days', agora), 'gaps 90d';

  -- 2) HOJE: série por hora; os números batem com a contagem direta
  b := public.panel_overview_r(t, ini_hoje, agora, ini_hoje - interval '1 day', agora - interval '1 day');
  assert b #>> '{periodo,granularidade}' = 'hora', 'hoje deveria ser por hora';
  select count(*) filter (where event_type = 'search'), count(*) filter (where event_type = 'reseller_click') into n_direto, c_direto
    from public.widget_events where tenant_id = t and created_at >= ini_hoje and created_at < agora;
  assert (b #>> '{kpis,buscas}')::int = n_direto and n_direto >= 1, format('buscas de hoje: painel %s, direto %s', b #>> '{kpis,buscas}', n_direto);
  assert (b #>> '{kpis,cliques}')::int = c_direto and c_direto >= 1, 'cliques de hoje';
  assert (select sum((x ->> 'buscas')::int) from jsonb_array_elements(b -> 'serie') x) = n_direto, 'soma da série por hora != buscas';
  assert (b -> 'serie' -> 0 ->> 'dia') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:00$', 'formato da chave por hora: ' || (b -> 'serie' -> 0 ->> 'dia');
  assert jsonb_array_length(b -> 'serie') = extract(hour from (agora - interval '1 second') at time zone tz)::int + 1, 'a série por hora deveria ir da 00h até a hora atual';

  -- este mês (parcial): comparação com os MESMOS dias do mês anterior
  b := public.panel_overview_r(t, ini_mes, agora, ini_mes_ant, ini_mes_ant + (agora - ini_mes));
  select count(*) filter (where event_type = 'search') into n_direto from public.widget_events where tenant_id = t and created_at >= ini_mes and created_at < agora;
  assert (b #>> '{kpis,buscas}')::int = n_direto, 'buscas do mês';
  select count(*) filter (where event_type = 'search') into n_direto from public.widget_events
    where tenant_id = t and created_at >= ini_mes_ant and created_at < ini_mes_ant + (agora - ini_mes);
  assert (b #>> '{anterior,buscas}')::int = n_direto, 'buscas do mês anterior (mesmos dias)';
  assert jsonb_array_length(b -> 'serie') = (date_trunc('day', (agora - interval '1 second') at time zone tz)::date - date_trunc('month', agora at time zone tz)::date) + 1, 'dias da série do mês';

  -- mês anterior inteiro
  b := public.panel_overview_r(t, ini_mes_ant, ini_mes, ini_mes_ant - interval '1 month', ini_mes_ant);
  select count(*) filter (where event_type = 'search') into n_direto from public.widget_events where tenant_id = t and created_at >= ini_mes_ant and created_at < ini_mes;
  assert (b #>> '{kpis,buscas}')::int = n_direto, 'buscas do mês anterior';
  assert jsonb_array_length(b -> 'serie') = extract(day from (date_trunc('month', agora at time zone tz) - interval '1 day'))::int, 'dias do mês anterior';

  -- semana passada (segunda a domingo) e semana atual
  b := public.panel_overview_r(t, ini_sem_ant, ini_sem, ini_sem_ant - interval '7 days', ini_sem_ant);
  select count(*) filter (where event_type = 'search') into n_direto from public.widget_events where tenant_id = t and created_at >= ini_sem_ant and created_at < ini_sem;
  assert (b #>> '{kpis,buscas}')::int = n_direto, 'buscas da semana passada';
  assert jsonb_array_length(b -> 'serie') = 7, 'a semana passada tem 7 dias na série';
  assert extract(isodow from (ini_sem at time zone tz)) = 1, 'a semana deve começar na segunda';

  -- resellers/gaps/funnel em intervalo de calendário
  assert (select count(*) from jsonb_array_elements(public.panel_resellers_r(t, ini_mes_ant, ini_mes))) >= 1, 'resellers do mês anterior';
  assert (public.panel_gaps_r(t, ini_mes_ant, ini_mes) ->> 'total_buscas')::int = (
    select count(*) from public.widget_events e where e.tenant_id = t and e.created_at >= ini_mes_ant and e.created_at < ini_mes
       and e.event_type = 'search' and e.product_id is not null and coalesce(e.results_count, 0) = 0), 'lacunas do mês anterior';
  assert (public.panel_funnel_r(t, ini_hoje, agora) ->> 'visitas')::int >= 1, 'funil de hoje deveria ter a visita do teste';

  -- 3) períodos inválidos
  ok_erro := false; begin perform public.panel_overview_r(t, agora, agora - interval '1 day', agora - interval '2 days', agora - interval '1 day');
  exception when sqlstate '22023' then ok_erro := true; end; assert ok_erro, 'início depois do fim deveria dar erro';
  ok_erro := false; begin perform public.panel_gaps_r(t, agora - interval '400 days', agora);
  exception when sqlstate '22023' then ok_erro := true; end; assert ok_erro, 'mais de 366 dias deveria dar erro';
  ok_erro := false; begin perform public.panel_funnel_r(t, null, agora);
  exception when sqlstate '22023' then ok_erro := true; end; assert ok_erro, 'período nulo deveria dar erro';
  ok_erro := false; begin perform public.panel_overview_r(t, agora - interval '1 day', agora, null, null);
  exception when sqlstate '22023' then ok_erro := true; end; assert ok_erro, 'comparação nula deveria dar erro';
end
$t$;

-- quem não é do cliente recebe null (e anônimo nem executa)
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000d2', true);
do $t$
declare t uuid := (select id from public.tenants where slug = 'demo'); agora timestamptz := now();
begin
  assert public.panel_overview_r(t, agora - interval '30 days', agora, agora - interval '60 days', agora - interval '30 days') is null, 'estranho não pode ver overview';
  assert public.panel_resellers_r(t, agora - interval '30 days', agora) is null, 'estranho não pode ver resellers';
  assert public.panel_gaps_r(t, agora - interval '30 days', agora) is null, 'estranho não pode ver gaps';
  assert public.panel_funnel_r(t, agora - interval '30 days', agora) is null, 'estranho não pode ver funil';
end
$t$;

reset role;
set local role anon;
do $t$
declare ok boolean := false;
begin
  begin
    perform public.panel_overview_r((select id from public.tenants where slug = 'demo'), now() - interval '1 day', now(), now() - interval '2 days', now() - interval '1 day');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'anônimo não deveria executar a função';
end
$t$;
rollback;
\echo OK 16
