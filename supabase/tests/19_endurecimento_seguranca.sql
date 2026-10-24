-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- 19 — Endurecimento de segurança (migrations 20261028000000 e 20261028010000). ROLLBACK; imprime "OK 19". Hermético.
-- 1) viewer LÊ tudo do cliente, mas NÃO insere/altera/apaga revendedores, produtos, endereços, cobertura e importações;
-- 2) owner e admin escrevem só no PRÓPRIO cliente; estranho não vê nada;
-- 3) anon continua lendo o catálogo/rede ATIVOS e inserindo eventos, mas não escreve em mais nada, não faz TRUNCATE e não chama gatilhos;
-- 4) authenticated não escreve em tenants, tenant_users, widget_events, commercial_opportunities e não faz TRUNCATE.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000a01', 'owner19@teste'), ('00000000-0000-4000-8000-000000000a02', 'admin19@teste'),
  ('00000000-0000-4000-8000-000000000a03', 'viewer19@teste'), ('00000000-0000-4000-8000-000000000a04', 'estranho19@teste');
insert into public.tenants (id, name, slug, status) values
  ('00000000-0000-4000-8000-0000000019aa', 'Cliente 19', 'cliente-19', 'active'),
  ('00000000-0000-4000-8000-0000000019bb', 'Outro 19', 'outro-19', 'active');
insert into public.tenant_users (tenant_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000019aa', '00000000-0000-4000-8000-000000000a01', 'owner'),
  ('00000000-0000-4000-8000-0000000019aa', '00000000-0000-4000-8000-000000000a02', 'admin'),
  ('00000000-0000-4000-8000-0000000019aa', '00000000-0000-4000-8000-000000000a03', 'viewer');
insert into public.resellers (id, tenant_id, name, type, status) values ('00000000-0000-4000-8000-0000000019c1', '00000000-0000-4000-8000-0000000019aa', 'Rev 19', 'loja_fisica', 'active'),
  ('00000000-0000-4000-8000-0000000019c2', '00000000-0000-4000-8000-0000000019bb', 'Rev outro', 'loja_fisica', 'active');
insert into public.products (id, tenant_id, name, sku) values ('00000000-0000-4000-8000-0000000019d1', '00000000-0000-4000-8000-0000000019aa', 'Prod 19', 'P19');
insert into public.addresses (tenant_id, reseller_id, city, state) values ('00000000-0000-4000-8000-0000000019aa', '00000000-0000-4000-8000-0000000019c1', 'Santos', 'SP');
insert into public.product_reseller_coverage (tenant_id, product_id, reseller_id) values ('00000000-0000-4000-8000-0000000019aa', '00000000-0000-4000-8000-0000000019d1', '00000000-0000-4000-8000-0000000019c1');
insert into public.import_batches (tenant_id) values ('00000000-0000-4000-8000-0000000019aa'), ('00000000-0000-4000-8000-0000000019bb');

-- ---------------------------------------------------------------- viewer
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000a03","role":"authenticated"}', true);
do $t$
declare
  t constant uuid := '00000000-0000-4000-8000-0000000019aa';
  o constant uuid := '00000000-0000-4000-8000-0000000019bb';
  ok boolean; n int;
begin
  -- lê tudo do próprio cliente (e nada do outro)
  assert (select count(*) from public.resellers where tenant_id = t) = 1, 'viewer lê os revendedores do cliente';
  assert (select count(*) from public.import_batches where tenant_id = o) = 0, 'viewer não lê importações de outro cliente';
  assert (select count(*) from public.products where tenant_id = t) = 1, 'viewer lê produtos';
  assert (select count(*) from public.addresses where tenant_id = t) = 1, 'viewer lê endereços';
  assert (select count(*) from public.product_reseller_coverage where tenant_id = t) = 1, 'viewer lê cobertura';
  assert (select count(*) from public.import_batches where tenant_id = t) = 1, 'viewer lê importações';
  -- não escreve
  ok := false; begin insert into public.resellers (tenant_id, name, type) values (t, 'Invasor', 'online'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'viewer não deveria inserir revendedor';
  ok := false; begin insert into public.products (tenant_id, name, sku) values (t, 'Invasor', 'X'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'viewer não deveria inserir produto';
  ok := false; begin insert into public.import_batches (tenant_id) values (t); exception when insufficient_privilege then ok := true; end;
  assert ok, 'viewer não deveria inserir importação';
  update public.resellers set name = 'Hackeado' where tenant_id = t; get diagnostics n = row_count;
  assert n = 0, 'viewer não deveria alterar revendedor (alterou ' || n || ')';
  delete from public.resellers where tenant_id = t; get diagnostics n = row_count;
  assert n = 0, 'viewer não deveria apagar revendedor';
  delete from public.products where tenant_id = t; get diagnostics n = row_count;
  assert n = 0, 'viewer não deveria apagar produto';
  delete from public.product_reseller_coverage where tenant_id = t; get diagnostics n = row_count;
  assert n = 0, 'viewer não deveria apagar cobertura';
  update public.addresses set city = 'X' where tenant_id = t; get diagnostics n = row_count;
  assert n = 0, 'viewer não deveria alterar endereço';
end
$t$;

-- ---------------------------------------------------------------- admin e owner
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000a02","role":"authenticated"}', true);
do $t$
declare
  t constant uuid := '00000000-0000-4000-8000-0000000019aa';
  o constant uuid := '00000000-0000-4000-8000-0000000019bb';
  ok boolean; n int; novo uuid;
begin
  insert into public.resellers (tenant_id, name, type) values (t, 'Novo do admin', 'online') returning id into novo;
  update public.resellers set name = 'Editado' where id = novo; get diagnostics n = row_count;
  assert n = 1, 'admin deveria alterar';
  delete from public.resellers where id = novo; get diagnostics n = row_count;
  assert n = 1, 'admin deveria apagar';
  -- só no próprio cliente
  ok := false; begin insert into public.resellers (tenant_id, name, type) values (o, 'Em outro cliente', 'online'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'admin não deveria inserir em outro cliente';
  update public.resellers set name = 'Hackeado' where tenant_id = o; get diagnostics n = row_count;
  assert n = 0, 'admin não deveria alterar outro cliente';
  -- e não consegue se promover: tenant_users e tenants não aceitam escrita
  ok := false; begin update public.tenant_users set role = 'owner' where user_id = '00000000-0000-4000-8000-000000000a03'; exception when insufficient_privilege then ok := true; end;
  assert ok, 'authenticated não deveria escrever em tenant_users';
  ok := false; begin update public.tenants set status = 'cancelled' where id = t; exception when insufficient_privilege then ok := true; end;
  assert ok, 'authenticated não deveria escrever em tenants';
  ok := false; begin delete from public.widget_events; exception when insufficient_privilege then ok := true; end;
  assert ok, 'authenticated não deveria apagar eventos';
  ok := false; begin truncate public.widget_events; exception when insufficient_privilege then ok := true; end;
  assert ok, 'authenticated não deveria fazer TRUNCATE';
  ok := false; begin truncate public.resellers; exception when insufficient_privilege then ok := true; end;
  assert ok, 'authenticated não deveria fazer TRUNCATE em revendedores';
  ok := false; begin perform public.widget_events_limit(); exception when insufficient_privilege then ok := true; end;
  assert ok, 'ninguém deveria chamar a função de gatilho pela API';
end
$t$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000a01","role":"authenticated"}', true);
do $t$
declare t constant uuid := '00000000-0000-4000-8000-0000000019aa'; n int; novo uuid;
begin
  insert into public.products (tenant_id, name, sku) values (t, 'Novo do dono', 'P19B') returning id into novo;
  update public.products set name = 'Editado' where id = novo; get diagnostics n = row_count;
  assert n = 1, 'owner deveria alterar produto';
  delete from public.products where id = novo; get diagnostics n = row_count;
  assert n = 1, 'owner deveria apagar produto';
end
$t$;

-- ---------------------------------------------------------------- estranho
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000a04","role":"authenticated"}', true);
do $t$
begin
  assert (select count(*) from public.import_batches) = 0, 'estranho não lê importações';
end
$t$;

-- ---------------------------------------------------------------- anônimo (o widget)
set local role anon;
do $t$
declare
  t constant uuid := '00000000-0000-4000-8000-0000000019aa';
  ok boolean; n int;
begin
  assert (select count(*) from public.products where tenant_id = t) = 1, 'anon continua lendo o catálogo de cliente ativo';
  assert (select count(*) from public.addresses where tenant_id = t) = 1, 'anon continua lendo endereços de cliente ativo';
  assert (select count(*) from public.import_batches) = 0, 'anon não lê importações';
  insert into public.widget_events (tenant_id, session_id, event_type, created_at) values (t, 'teste-19', 'search', now());
  ok := false; begin update public.widget_events set query_text = 'x'; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon não deveria alterar eventos';
  ok := false; begin delete from public.widget_events; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon não deveria apagar eventos';
  ok := false; begin truncate public.widget_events; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon não deveria fazer TRUNCATE';
  ok := false; begin insert into public.resellers (tenant_id, name, type) values (t, 'Anon', 'online'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon não deveria inserir revendedor';
  ok := false; begin insert into public.tenants (name, slug) values ('x', 'x-19'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon não deveria inserir cliente';
  ok := false; begin perform public.panel_ai_readings_limit(); exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon não deveria chamar função de gatilho';
  -- a API do widget continua funcionando
  assert (select count(*) from public.widget_search_products(t, 'prod', 5)) = 1, 'widget_search_products devolve o produto ao anon';
  assert (select count(*) from public.widget_find_products(t, 'prod', 5, 0)) = 1, 'widget_find_products devolve o produto ao anon';
  assert (select count(*) from public.widget_get_tenant_v2('cliente-19')) = 1, 'widget_get_tenant_v2 devolve o cliente ativo ao anon';
  assert (select count(*) from public.widget_list_resellers(t, '00000000-0000-4000-8000-0000000019d1', null, null, null, null, null, 10, 0)) >= 1, 'widget_list_resellers devolve a loja ao anon';
  assert (select count(*) from public.widget_list_places(t)) >= 1, 'widget_list_places devolve as cidades ao anon';
end
$t$;

-- ---------------------------------------------------------------- spatial_ref_sys (só quando o dono do teste é o dono da tabela)
reset role;
do $t$
begin
  if exists (select 1 from pg_class c where c.relname = 'spatial_ref_sys' and c.relrowsecurity) then
    set local role anon;
    assert (select count(*) from public.spatial_ref_sys where srid = 4326) = 1, 'anon deveria ler o SRID 4326';
    begin insert into public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) values (990001, 'x', 1, 'x', 'x'); assert false, 'anon não deveria escrever em spatial_ref_sys';
    exception when insufficient_privilege then null; end;
    reset role;
  end if;
end
$t$;
rollback;
\echo OK 19
