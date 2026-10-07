-- Testa panel_recent e panel_resellers (migration 20261008000000). Pré-requisito: 02_fixture e 03_eventos_simulados (fabrica-teste).
-- Usuário a = membro de fabrica-teste; usuário b = membro só do demo (não pode ler o fabrica-teste). Imprime "OK 07".
\set ON_ERROR_STOP on
begin;
do $$ declare ft uuid := (select id from tenants where slug = 'fabrica-teste'); begin
  perform set_config('t.ft', ft::text, true);
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000aa', true);
do $$
declare ft uuid := current_setting('t.ft')::uuid; r jsonb; n int; tot_cliques int; soma int;
begin
  r := panel_recent(ft, 5);
  if jsonb_array_length(r) <> 5 then raise exception 'panel_recent(5) deveria devolver 5, veio %', jsonb_array_length(r); end if;
  if (r->0->>'quando')::timestamptz < (r->4->>'quando')::timestamptz then raise exception 'panel_recent fora de ordem (mais recente primeiro)'; end if;
  if jsonb_array_length(panel_recent(ft, 999)) > 50 then raise exception 'panel_recent deve limitar a 50'; end if;
  if jsonb_array_length(panel_recent(ft, 0)) <> 1 then raise exception 'panel_recent(0) deve ser tratado como 1'; end if;

  r := panel_resellers(ft, 30);
  select count(*) into n from public.resellers where tenant_id = ft and status = 'active';
  if jsonb_array_length(r) <> n then raise exception 'panel_resellers deve listar todos os revendedores ativos (% x %)', jsonb_array_length(r), n; end if;
  select coalesce(sum((x->>'contatos')::int), 0) into soma from jsonb_array_elements(r) x;
  select count(*) into tot_cliques from public.widget_events
   where tenant_id = ft and event_type = 'reseller_click' and reseller_id is not null and created_at >= now() - interval '30 days';
  if soma <> tot_cliques then raise exception 'soma de contatos por revendedor (%) deve bater com os cliques do período (%)', soma, tot_cliques; end if;
  select coalesce(sum((x->>'whatsapp')::int + (x->>'ligar')::int + (x->>'rota')::int + (x->>'site')::int), 0) into soma from jsonb_array_elements(r) x;
  if soma > tot_cliques then raise exception 'quebra por ação não pode exceder o total'; end if;
  if (r->0->>'contatos')::int < (r->(jsonb_array_length(r)-1)->>'contatos')::int then raise exception 'panel_resellers deve vir ordenado por contatos desc'; end if;
end $$;

-- usuário que não pertence ao cliente recebe NULL
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000bb', true);
do $$ declare ft uuid := current_setting('t.ft')::uuid; begin
  if panel_recent(ft, 5) is not null then raise exception 'não-membro leu panel_recent'; end if;
  if panel_resellers(ft, 30) is not null then raise exception 'não-membro leu panel_resellers'; end if;
end $$;
reset role;

-- anônimo não executa
set local role anon;
do $$ declare ok boolean := false; begin
  begin perform panel_recent(current_setting('t.ft')::uuid, 5); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'anon executou panel_recent'; end if;
  ok := false;
  begin perform panel_resellers(current_setting('t.ft')::uuid, 30); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'anon executou panel_resellers'; end if;
end $$;
reset role;
rollback;
\echo OK 07
