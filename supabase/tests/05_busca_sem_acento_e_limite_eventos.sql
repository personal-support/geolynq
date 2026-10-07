-- Testa a migration 20261007000000 (busca sem acento + limite de eventos). Rodar DEPOIS das migrations.
-- Cada bloco lança exceção se algo estiver errado; no fim imprime "OK 05". Tudo roda numa transação com rollback.
\set ON_ERROR_STOP on
begin;

insert into tenants (id, name, slug, status) values
  ('00000000-0000-4000-8000-0000000005a1', 'Teste Busca', 'teste-busca-05', 'active'),
  ('00000000-0000-4000-8000-0000000005a2', 'Outro Teste', 'teste-busca-05b', 'active');
insert into products (tenant_id, sku, name, category, active) values
  ('00000000-0000-4000-8000-0000000005a1', 'PRT-001', 'Proteína Isolada 900g', 'Proteínas', true),
  ('00000000-0000-4000-8000-0000000005a1', 'CRE-002', 'Creatina Monohidratada', 'Creatina', true),
  ('00000000-0000-4000-8000-0000000005a1', 'X_%-003', 'Barra 100% Cacau_Pura', 'Barras', true),
  ('00000000-0000-4000-8000-0000000005a1', 'OFF-004', 'Produto Inativo Proteína', 'Proteínas', false),
  ('00000000-0000-4000-8000-0000000005a2', 'PRT-001', 'Proteína de Outro Cliente', 'Proteínas', true);

-- ===== (3) busca sem acento, como anon (RLS valendo)
set local role anon;
do $$
declare n int;
  a constant uuid := '00000000-0000-4000-8000-0000000005a1';
begin
  select count(*) into n from widget_search_products(a, 'proteina');
  if n <> 1 then raise exception 'proteina (sem acento): esperado 1 (inativo e outro tenant ficam de fora), veio %', n; end if;
  select count(*) into n from widget_search_products(a, 'PROTEÍNA');
  if n <> 1 then raise exception 'PROTEÍNA (maiúscula e acento): esperado 1, veio %', n; end if;
  select count(*) into n from widget_search_products(a, 'creatína mono');
  if n <> 1 then raise exception 'creatína mono: esperado 1, veio %', n; end if;
  select count(*) into n from widget_search_products(a, 'prt-001');
  if n <> 1 then raise exception 'busca por SKU em minúscula: esperado 1, veio %', n; end if;
  select count(*) into n from widget_search_products(a, '%');
  if n <> 1 then raise exception 'o curinga percent deve ser literal (só a barra de cacau tem): esperado 1, veio %', n; end if;
  select count(*) into n from widget_search_products(a, '_');
  if n <> 1 then raise exception 'o curinga _ deve ser literal: esperado 1, veio %', n; end if;
  select count(*) into n from widget_search_products(a, '');
  if n <> 0 then raise exception 'termo vazio: esperado 0, veio %', n; end if;
  select count(*) into n from widget_search_products(a, '   ');
  if n <> 0 then raise exception 'termo em branco: esperado 0, veio %', n; end if;
  select count(*) into n from widget_search_products(a, 'zzz');
  if n <> 0 then raise exception 'termo inexistente: esperado 0, veio %', n; end if;
  select count(*) into n from widget_search_products('00000000-0000-4000-8000-0000000005a2', 'proteina');
  if n <> 1 then raise exception 'outro tenant ve só o produto dele: esperado 1, veio %', n; end if;
end $$;
reset role;

-- ===== (4) limite de eventos
-- (a) anon: created_at forjado é ignorado
set local role anon;
insert into widget_events (tenant_id, session_id, event_type, query_text, created_at)
  values ('00000000-0000-4000-8000-0000000005a1', 'sessao-forjada', 'search', 'x', now() - interval '40 days');
reset role;
do $$ begin
  if (select count(*) from widget_events where session_id = 'sessao-forjada' and created_at > now() - interval '1 minute') <> 1 then
    raise exception 'created_at forjado pelo anon deveria virar now()';
  end if;
end $$;

-- (b) anon: 20/min por sessão — 30 tentativas, só 20 entram
set local role anon;
do $$ begin
  for i in 1..30 loop
    insert into widget_events (tenant_id, session_id, event_type, query_text)
      values ('00000000-0000-4000-8000-0000000005a1', 'robo-1', 'search', 'q' || i);
  end loop;
end $$;
reset role;
do $$ declare n int; begin
  select count(*) into n from widget_events where session_id = 'robo-1';
  if n <> 20 then raise exception 'limite por sessão/min: esperado 20, entraram %', n; end if;
  -- sem erro para o robô (insert descartado em silêncio) já provado: o loop acima não lançou exceção
end $$;

-- (c) outra sessão do mesmo cliente continua entrando
set local role anon;
insert into widget_events (tenant_id, session_id, event_type, query_text)
  values ('00000000-0000-4000-8000-0000000005a1', 'pessoa-real', 'search', 'whey');
reset role;
do $$ begin
  if (select count(*) from widget_events where session_id = 'pessoa-real') <> 1 then raise exception 'sessão legítima foi bloqueada'; end if;
end $$;

-- (d) sessão sem id: só vale o teto do cliente; entra
set local role anon;
insert into widget_events (tenant_id, session_id, event_type, query_text)
  values ('00000000-0000-4000-8000-0000000005a1', null, 'search', 'sem-sessao');
reset role;
do $$ begin
  if (select count(*) from widget_events where query_text = 'sem-sessao') <> 1 then raise exception 'evento sem session_id deveria entrar'; end if;
end $$;

-- (e) teto do cliente: 600/min. Enche o cliente B com 600 (inserção como superusuário, sem limite) e tenta 1 como anon
insert into widget_events (tenant_id, session_id, event_type, query_text)
  select '00000000-0000-4000-8000-0000000005a2', 'enchimento-' || (g % 50), 'search', 'e' from generate_series(1, 600) g;
set local role anon;
insert into widget_events (tenant_id, session_id, event_type, query_text)
  values ('00000000-0000-4000-8000-0000000005a2', 'sessao-nova', 'search', 'barrado');
reset role;
do $$ begin
  if (select count(*) from widget_events where query_text = 'barrado') <> 0 then raise exception 'teto de 600/min por cliente não barrou'; end if;
  if (select count(*) from widget_events where tenant_id = '00000000-0000-4000-8000-0000000005a1' and session_id = 'pessoa-real') <> 1 then
    raise exception 'o teto do cliente B não pode afetar o cliente A';
  end if;
end $$;

-- (f) limite por hora: 200 eventos antigos (há 30 min) numa sessão; o próximo é barrado
insert into widget_events (tenant_id, session_id, event_type, query_text, created_at)
  select '00000000-0000-4000-8000-0000000005a1', 'robo-hora', 'search', 'h', now() - interval '30 minutes' - (g || ' seconds')::interval from generate_series(1, 200) g;
set local role anon;
insert into widget_events (tenant_id, session_id, event_type, query_text)
  values ('00000000-0000-4000-8000-0000000005a1', 'robo-hora', 'search', 'passou-da-hora');
reset role;
do $$ begin
  if (select count(*) from widget_events where query_text = 'passou-da-hora') <> 0 then raise exception 'limite de 200/hora por sessão não barrou'; end if;
end $$;

-- (g) papéis privilegiados (service_role/postgres) não são limitados nem têm created_at alterado
set local role service_role;
insert into widget_events (tenant_id, session_id, event_type, query_text, created_at)
  select '00000000-0000-4000-8000-0000000005a1', 'robo-1', 'search', 'svc', now() - interval '3 days' from generate_series(1, 25);
reset role;
do $$ begin
  if (select count(*) from widget_events where query_text = 'svc') <> 25 then raise exception 'service_role foi limitado'; end if;
  if (select count(*) from widget_events where query_text = 'svc' and created_at > now() - interval '1 day') <> 0 then
    raise exception 'service_role teve created_at alterado (simulados/backfill quebrariam)';
  end if;
end $$;

-- (h) a contagem não vaza: anon continua sem ler widget_events
set local role anon;
do $$ begin
  if (select count(*) from widget_events) <> 0 then raise exception 'anon leu widget_events'; end if;
end $$;
reset role;

rollback;
\echo OK 05
