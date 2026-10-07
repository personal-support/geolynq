-- Testa a migration 20261012000000 (panel_ai_readings): RLS por cliente, anon sem acesso e limites de custo. Faz rollback; imprime "OK 12".
-- Rodar DEPOIS de 02 (usa os usuários aa/bb e os clientes fabrica-teste/demo).
\set ON_ERROR_STOP on
begin;
select set_config('t.ft', (select id::text from tenants where slug = 'fabrica-teste'), true);
select set_config('t.dm', (select id::text from tenants where slug = 'demo'), true);
delete from panel_ai_readings; -- começa vazio (dentro da transação; o rollback devolve o que havia)

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000aa', true);
do $$
declare ft uuid := current_setting('t.ft')::uuid; dm uuid := current_setting('t.dm')::uuid; bloqueado boolean := false; i int;
begin
  insert into panel_ai_readings (tenant_id, dias, conteudo, modelo) values (ft, 30, '{"resumo":"x"}', 'm');
  if (select count(*) from panel_ai_readings where tenant_id = ft) <> 1 then raise exception 'membro deveria ler a própria leitura'; end if;
  -- não grava no cliente alheio (RLS)
  begin
    insert into panel_ai_readings (tenant_id, dias, conteudo, modelo) values (dm, 30, '{"resumo":"x"}', 'm');
  exception when insufficient_privilege or check_violation then bloqueado := true; end;
  if not bloqueado then raise exception 'membro gravou leitura em cliente alheio'; end if;
  -- 2ª leitura logo em seguida: barrada pelo gatilho
  bloqueado := false;
  begin
    insert into panel_ai_readings (tenant_id, dias, conteudo, modelo) values (ft, 7, '{"resumo":"y"}', 'm');
  exception when others then bloqueado := sqlerrm like 'limite_leitura_ia%'; end;
  if not bloqueado then raise exception 'gatilho não barrou a 2ª leitura em 2 minutos'; end if;
end $$;
reset role;

-- limite diário: 30 por 24 h (inserido como dono, espaçado, para não bater no limite de 2 minutos)
do $$
declare ft uuid := current_setting('t.ft')::uuid; bloqueado boolean := false; i int;
begin
  delete from panel_ai_readings;
  alter table panel_ai_readings disable trigger panel_ai_readings_limit_trg;
  for i in 1..30 loop
    insert into panel_ai_readings (tenant_id, dias, conteudo, modelo, created_at) values (ft, 30, '{"resumo":"x"}', 'm', now() - (i * interval '10 minutes'));
  end loop;
  alter table panel_ai_readings enable trigger panel_ai_readings_limit_trg;
  begin
    insert into panel_ai_readings (tenant_id, dias, conteudo, modelo) values (ft, 30, '{"resumo":"z"}', 'm');
  exception when others then bloqueado := sqlerrm like 'limite_leitura_ia%'; end;
  if not bloqueado then raise exception 'gatilho não barrou a 31ª leitura do dia'; end if;
end $$;

-- membro de OUTRO cliente não lê; anônimo não acessa
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000bb', true);
do $$ begin
  if (select count(*) from panel_ai_readings) <> 0 then raise exception 'usuário de outro cliente leu leituras'; end if;
end $$;
reset role;
set local role anon;
do $$ declare ok boolean := false; begin
  begin perform count(*) from panel_ai_readings; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'anon acessou panel_ai_readings'; end if;
end $$;
reset role;
rollback;
select 'OK 12';
