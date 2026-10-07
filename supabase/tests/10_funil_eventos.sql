-- Testa a migration 20261011000000 (eventos de funil + panel_funnel). Cliente próprio, sem outros eventos: os números são exatos.
-- Rodar DEPOIS de 02 (usa os usuários aa/bb). Faz rollback e imprime "OK 10".
\set ON_ERROR_STOP on
begin;

insert into tenants (id, name, slug, status) values ('00000000-0000-4000-8000-000000000a01', 'Marca Funil', 'marca-funil-10', 'active');
insert into products (id, tenant_id, sku, name, category, active) values
  ('00000000-0000-4000-8000-000000000a11', '00000000-0000-4000-8000-000000000a01', 'F-1', 'Whey Funil', 'Proteínas', true);
insert into tenant_users (tenant_id, user_id, role) values ('00000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-0000000000aa', 'owner');

-- anônimo (o visitante) grava os 4 tipos novos; tipo desconhecido continua barrado
set local role anon;
do $$
declare t uuid := '00000000-0000-4000-8000-000000000a01'; p uuid := '00000000-0000-4000-8000-000000000a11'; bad boolean := false;
begin
  -- A: digitou, escolheu, buscou com revendedor, clicou
  insert into widget_events (tenant_id, session_id, event_type, query_text, results_count, telemetry_v) values (t, 'f-A', 'catalog_search', 'whey', 3, 2);
  insert into widget_events (tenant_id, session_id, event_type, product_id, telemetry_v) values (t, 'f-A', 'product_select', p, 2);
  insert into widget_events (tenant_id, session_id, event_type, product_id, results_count, telemetry_v) values (t, 'f-A', 'search', p, 2, 2);
  insert into widget_events (tenant_id, session_id, event_type, product_id, action, telemetry_v) values (t, 'f-A', 'reseller_click', p, 'whatsapp', 2);
  -- B: digitou, escolheu, buscou e NÃO havia revendedor
  insert into widget_events (tenant_id, session_id, event_type, query_text, results_count, telemetry_v) values (t, 'f-B', 'catalog_search', 'whey', 3, 2);
  insert into widget_events (tenant_id, session_id, event_type, product_id, telemetry_v) values (t, 'f-B', 'product_select', p, 2);
  insert into widget_events (tenant_id, session_id, event_type, product_id, results_count, telemetry_v) values (t, 'f-B', 'search', p, 0, 2);
  -- C: usou só a lista e clicou
  insert into widget_events (tenant_id, session_id, event_type, telemetry_v) values (t, 'f-C', 'list_open', 2);
  insert into widget_events (tenant_id, session_id, event_type, state, city, results_count, location_source, telemetry_v) values (t, 'f-C', 'list_search', 'SP', 'Santos', 4, 'none', 2);
  insert into widget_events (tenant_id, session_id, event_type, action, telemetry_v) values (t, 'f-C', 'reseller_click', 'call', 2);
  -- D: digitou algo fora do catálogo
  insert into widget_events (tenant_id, session_id, event_type, query_text, results_count, telemetry_v) values (t, 'f-D', 'search', 'zzxyz', 0, 2);
  -- E: só escolheu um produto
  insert into widget_events (tenant_id, session_id, event_type, product_id, telemetry_v) values (t, 'f-E', 'product_select', p, 2);
  -- F: só clique (dado antigo)
  insert into widget_events (tenant_id, session_id, event_type, action, telemetry_v) values (t, 'f-F', 'reseller_click', 'site', 1);
  -- G: página de produto do cliente (sem product_select), buscou, tinha revendedor, clicou
  insert into widget_events (tenant_id, session_id, event_type, product_id, results_count, telemetry_v) values (t, 'f-G', 'search', p, 1, 2);
  insert into widget_events (tenant_id, session_id, event_type, product_id, action, telemetry_v) values (t, 'f-G', 'reseller_click', p, 'directions', 2);
  -- H: abriu a lista e não fez mais nada
  insert into widget_events (tenant_id, session_id, event_type, telemetry_v) values (t, 'f-H', 'list_open', 2);

  begin
    insert into widget_events (tenant_id, session_id, event_type, telemetry_v) values (t, 'f-X', 'page_view', 2);
  exception when check_violation then bad := true; end;
  if not bad then raise exception 'event_type desconhecido deveria ser barrado'; end if;
end $$;
reset role;

-- relatório como membro
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000aa', true);
do $$
declare f jsonb := panel_funnel('00000000-0000-4000-8000-000000000a01', 30);
begin
  if (f->>'visitas')::int <> 8 then raise exception 'visitas esperado 8, veio %', f->>'visitas'; end if;
  if (f->>'digitaram')::int <> 3 then raise exception 'digitaram esperado 3 (A, B, D), veio %', f->>'digitaram'; end if;
  if (f->>'visitas_com_clique')::int <> 4 then raise exception 'visitas_com_clique esperado 4 (A, C, F, G), veio %', f->>'visitas_com_clique'; end if;
  if (f->'produto'->>'escolheram')::int <> 4 then raise exception 'escolheram esperado 4 (A, B, E, G), veio %', f->'produto'->>'escolheram'; end if;
  if (f->'produto'->>'localizacao')::int <> 3 then raise exception 'localizacao esperado 3 (A, B, G), veio %', f->'produto'->>'localizacao'; end if;
  if (f->'produto'->>'com_revendedor')::int <> 2 then raise exception 'com_revendedor esperado 2 (A, G), veio %', f->'produto'->>'com_revendedor'; end if;
  if (f->'produto'->>'clicaram')::int <> 2 then raise exception 'clicaram (produto) esperado 2 (A, G), veio %', f->'produto'->>'clicaram'; end if;
  if (f->'lista'->>'abriram')::int <> 2 then raise exception 'lista.abriram esperado 2 (C, H), veio %', f->'lista'->>'abriram'; end if;
  if (f->'lista'->>'filtraram')::int <> 1 then raise exception 'lista.filtraram esperado 1 (C), veio %', f->'lista'->>'filtraram'; end if;
  if (f->'lista'->>'clicaram')::int <> 1 then raise exception 'lista.clicaram esperado 1 (C), veio %', f->'lista'->>'clicaram'; end if;
  -- os degraus do caminho do produto só podem cair
  if not ((f->'produto'->>'escolheram')::int >= (f->'produto'->>'localizacao')::int
      and (f->'produto'->>'localizacao')::int >= (f->'produto'->>'com_revendedor')::int
      and (f->'produto'->>'com_revendedor')::int >= (f->'produto'->>'clicaram')::int) then
    raise exception 'funil do produto não é decrescente';
  end if;
  -- termos: "whey" achou produto (2x); "zzxyz" não achou (1x)
  if jsonb_array_length(f->'termos') <> 2 then raise exception 'termos esperado 2, veio %', f->'termos'; end if;
  if (f->'termos'->0->>'termo') <> 'whey' or (f->'termos'->0->>'buscas')::int <> 2 or (f->'termos'->0->>'achou')::boolean is not true then
    raise exception 'termo whey errado: %', f->'termos'->0;
  end if;
  if (f->'termos'->1->>'termo') <> 'zzxyz' or (f->'termos'->1->>'achou')::boolean is not false then
    raise exception 'termo zzxyz errado: %', f->'termos'->1;
  end if;
end $$;

-- janela: evento antigo sai (envelhece como dono do banco; membro não altera eventos)
reset role;
update widget_events set created_at = now() - interval '40 days' where session_id = 'f-A';
set local role authenticated;
do $$
begin
  if (panel_funnel('00000000-0000-4000-8000-000000000a01', 30)->>'visitas')::int <> 7 then raise exception 'janela de 30 dias deveria excluir f-A (7 visitas)'; end if;
  if (panel_funnel('00000000-0000-4000-8000-000000000a01', 90)->>'visitas')::int <> 8 then raise exception 'janela de 90 dias deveria incluir f-A'; end if;
end $$;

-- o relatório antigo NÃO é afetado pelos tipos novos (buscas = só 'search')
do $$
declare o jsonb := panel_overview('00000000-0000-4000-8000-000000000a01', 90);
begin
  if (o->'kpis'->>'buscas')::int <> 4 then raise exception 'panel_overview.buscas esperado 4 (A, B, D, G), veio %', o->'kpis'->>'buscas'; end if;
  if (o->'kpis'->>'cliques')::int <> 4 then raise exception 'panel_overview.cliques esperado 4, veio %', o->'kpis'->>'cliques'; end if;
end $$;

-- não-membro recebe NULL
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000bb', true);
do $$ begin
  if panel_funnel('00000000-0000-4000-8000-000000000a01', 30) is not null then raise exception 'não-membro leu panel_funnel'; end if;
end $$;
reset role;

-- anônimo não executa
set local role anon;
do $$ declare ok boolean := false; begin
  begin perform panel_funnel('00000000-0000-4000-8000-000000000a01', 30); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'anon executou panel_funnel'; end if;
end $$;
reset role;

rollback;
select 'OK 10';
