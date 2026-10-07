-- Testa a migration 20261010000000 (widget v2: tema, grade de produtos, lista de revendedores). Rodar DEPOIS das migrations.
-- Tudo como `anon` (o papel do visitante do site). Cria cliente próprio e faz rollback. Imprime "OK 09".
\set ON_ERROR_STOP on
begin;

insert into tenants (id, name, slug, status, widget_theme) values
  ('00000000-0000-4000-8000-0000000009a1', 'Marca V2', 'marca-v2-09', 'active', '{"primary":"#1F3FFF","radius":10}'),
  ('00000000-0000-4000-8000-0000000009a2', 'Marca Trial', 'marca-trial-09', 'trial', '{}'),
  ('00000000-0000-4000-8000-0000000009a3', 'Outra Marca', 'outra-marca-09', 'active', '{}');

insert into products (id, tenant_id, sku, name, category, active, image_url) values
  ('00000000-0000-4000-8000-0000000009b1', '00000000-0000-4000-8000-0000000009a1', 'WHY-1', 'Whey Protein Isolado', 'Proteínas', true,  'https://cdn.exemplo.com.br/whey.jpg'),
  ('00000000-0000-4000-8000-0000000009b2', '00000000-0000-4000-8000-0000000009a1', 'CRE-1', 'Creatina Monohidratada', 'Energia', true, 'http://inseguro.exemplo.com/c.jpg'),
  ('00000000-0000-4000-8000-0000000009b3', '00000000-0000-4000-8000-0000000009a1', 'OME-1', 'Ômega 3', 'Saúde e bem-estar', true, null),
  ('00000000-0000-4000-8000-0000000009b4', '00000000-0000-4000-8000-0000000009a1', 'OFF-1', 'Produto Inativo', 'Proteínas', false, null),
  ('00000000-0000-4000-8000-0000000009b5', '00000000-0000-4000-8000-0000000009a3', 'WHY-1', 'Whey de Outra Marca', 'Proteínas', true, 'https://cdn.outra.com/x.jpg');

insert into resellers (id, tenant_id, name, type, status, phone, whatsapp) values
  ('00000000-0000-4000-8000-0000000009c1', '00000000-0000-4000-8000-0000000009a1', 'Loja Santos',        'loja_fisica', 'active',   '1311111111', '13911111111'),
  ('00000000-0000-4000-8000-0000000009c2', '00000000-0000-4000-8000-0000000009a1', 'Farmácia São Paulo',  'farmacia',    'active',   '1122222222', '11922222222'),
  ('00000000-0000-4000-8000-0000000009c3', '00000000-0000-4000-8000-0000000009a1', 'Loja Online',        'online',      'active',   null,         null),
  ('00000000-0000-4000-8000-0000000009c4', '00000000-0000-4000-8000-0000000009a1', 'Loja Curitiba',      'loja_fisica', 'active',   '4133333333', '41933333333'),
  ('00000000-0000-4000-8000-0000000009c5', '00000000-0000-4000-8000-0000000009a1', 'Loja Desativada',    'loja_fisica', 'inactive', null,         null),
  ('00000000-0000-4000-8000-0000000009c6', '00000000-0000-4000-8000-0000000009a1', 'Loja Santos Dois',    'loja_fisica', 'active',   '1344444444', '13944444444'),
  ('00000000-0000-4000-8000-0000000009c7', '00000000-0000-4000-8000-0000000009a3', 'Loja de Outra Marca', 'loja_fisica', 'active',   null,         null);

insert into addresses (tenant_id, reseller_id, city, state, latitude, longitude) values
  ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000009c1', 'Santos',    'SP', -23.96, -46.33),
  ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000009c2', 'São Paulo', 'SP', -23.56, -46.65),
  ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000009c3', 'São Paulo', 'SP', -23.58, -46.67),
  ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000009c4', 'Curitiba',  'PR', -25.43, -49.27),
  ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000009c5', 'Santos',    'SP', -23.96, -46.33),
  ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000009c6', 'Santos',    'SP', -23.99, -46.30),
  ('00000000-0000-4000-8000-0000000009a3', '00000000-0000-4000-8000-0000000009c7', 'Santos',    'SP', -23.96, -46.33);

insert into product_reseller_coverage (tenant_id, product_id, reseller_id, priority) values
  ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000009b1', '00000000-0000-4000-8000-0000000009c1', 0),
  ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000009b1', '00000000-0000-4000-8000-0000000009c2', 0),
  ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000009b1', '00000000-0000-4000-8000-0000000009c3', 0),
  ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000009b2', '00000000-0000-4000-8000-0000000009c4', 0);

set local role anon;

-- ===== tenant + tema
do $$ declare t record; n int; begin
  select * into t from widget_get_tenant_v2('marca-v2-09');
  if t.id is null or (t.theme->>'primary') <> '#1F3FFF' or (t.theme->>'radius')::int <> 10 then raise exception 'tenant v2 deveria trazer o tema'; end if;
  select count(*) into n from widget_get_tenant_v2('marca-trial-09');
  if n <> 0 then raise exception 'cliente em trial não pode aparecer ao público'; end if;
  select count(*) into n from tenants;  -- `tenants` continua fechada para anon
  if n <> 0 then raise exception 'anon leu a tabela tenants'; end if;
end $$;

-- ===== grade de produtos
do $$ declare n int; tot bigint; a constant uuid := '00000000-0000-4000-8000-0000000009a1'; begin
  select count(*), max(total_count) into n, tot from widget_find_products(a);
  if n <> 3 or tot <> 3 then raise exception 'grade deveria ter 3 produtos ativos (tem %, total %)', n, tot; end if;
  if exists (select 1 from widget_find_products(a) where name = 'Produto Inativo') then raise exception 'produto inativo apareceu'; end if;
  if (select image_url from widget_find_products(a) where sku = 'WHY-1') <> 'https://cdn.exemplo.com.br/whey.jpg' then raise exception 'foto https deveria sair'; end if;
  if (select image_url from widget_find_products(a) where sku = 'CRE-1') is not null then raise exception 'foto http (insegura) deveria virar NULL'; end if;
  select count(*) into n from widget_find_products(a, 'OMEGA');   if n <> 1 then raise exception 'busca sem acento ômega: %', n; end if;
  select count(*) into n from widget_find_products(a, 'proteina'); if n <> 1 then raise exception 'busca por categoria sem acento: %', n; end if;
  select count(*) into n from widget_find_products(a, 'zzz');      if n <> 0 then raise exception 'termo sem resultado: %', n; end if;
  select count(*), max(total_count) into n, tot from widget_find_products(a, '', 2, 0);
  if n <> 2 or tot <> 3 then raise exception 'paginação: página de 2 com total 3 (veio % e %)', n, tot; end if;
  select count(*) into n from widget_find_products(a, '', 2, 2); if n <> 1 then raise exception 'segunda página deveria ter 1, veio %', n; end if;
  select count(*) into n from widget_find_products(a, '', 99999, -5); if n <> 3 then raise exception 'limites absurdos devem ser ajustados, veio %', n; end if;
  select count(*) into n from widget_find_products('00000000-0000-4000-8000-0000000009a3'); if n <> 1 then raise exception 'isolamento entre clientes: %', n; end if;
  select count(*) into n from widget_find_products('00000000-0000-4000-8000-0000000009a2'); if n <> 0 then raise exception 'trial não tem grade pública: %', n; end if;
end $$;

-- ===== lista de revendedores
do $$ declare n int; a constant uuid := '00000000-0000-4000-8000-0000000009a1'; b1 constant uuid := '00000000-0000-4000-8000-0000000009b1'; tot bigint; nm text; begin
  -- sem NENHUM filtro: não devolve nada (não despeja a rede)
  select count(*) into n from widget_list_resellers(a);
  if n <> 0 then raise exception 'sem filtro não pode listar a rede (veio %)', n; end if;
  -- só produto
  select count(*) into n from widget_list_resellers(a, b1);
  if n <> 3 then raise exception 'produto Whey: 2 físicas + 1 online = 3 (veio %)', n; end if;
  -- por UF: SP físicas ativas = Santos, Santos Dois, São Paulo; online fica de fora quando se filtra por UF
  select count(*) into n from widget_list_resellers(a, null, 'sp');
  if n <> 3 then raise exception 'UF SP: 3 físicas (veio %)', n; end if;
  if exists (select 1 from widget_list_resellers(a, null, 'SP') where type = 'online') then raise exception 'online não entra no filtro por UF'; end if;
  if exists (select 1 from widget_list_resellers(a, null, 'SP') where name = 'Loja Desativada') then raise exception 'revendedor inativo apareceu'; end if;
  -- UF + tipo online pedido de propósito
  select count(*) into n from widget_list_resellers(a, null, 'SP', null, 'online'); if n <> 1 then raise exception 'online pedido explicitamente: %', n; end if;
  -- cidade sem acento e sem maiúscula
  select count(*) into n from widget_list_resellers(a, null, null, 'SAO PAULO'); if n <> 1 then raise exception 'cidade sem acento: % (online fica de fora)', n; end if;
  select count(*) into n from widget_list_resellers(a, null, 'PR', 'curitiba'); if n <> 1 then raise exception 'PR/Curitiba: %', n; end if;
  -- tipo
  select count(*) into n from widget_list_resellers(a, null, 'SP', null, 'farmacia'); if n <> 1 then raise exception 'tipo farmácia: %', n; end if;
  -- produto + UF
  select count(*) into n from widget_list_resellers(a, b1, 'PR'); if n <> 0 then raise exception 'Whey no PR: nenhuma (veio %)', n; end if;
  -- paginação e total
  select count(*), max(total_count) into n, tot from widget_list_resellers(a, null, 'SP', null, null, null, null, 2, 0);
  if n <> 2 or tot <> 3 then raise exception 'paginação: 2 por página, total 3 (veio % e %)', n, tot; end if;
  select count(*) into n from widget_list_resellers(a, null, 'SP', null, null, null, null, 2, 2); if n <> 1 then raise exception 'segunda página: %', n; end if;
  -- localização sozinha conta como filtro e ordena por distância (Santos mais perto de Santos)
  select name into nm from widget_list_resellers(a, null, null, null, null, -23.96, -46.33, 5, 0) limit 1;
  if nm <> 'Loja Santos' then raise exception 'ordenação por distância: primeiro deveria ser Loja Santos (veio %)', nm; end if;
  if (select distance_km from widget_list_resellers(a, null, null, null, null, -23.96, -46.33, 5, 0) where name = 'Loja Santos') > 0.1 then raise exception 'distância de quem está no mesmo ponto'; end if;
  -- limite máximo de 20 por página
  select count(*) into n from widget_list_resellers(a, b1, null, null, null, null, null, 9999, 0); if n > 20 then raise exception 'máximo 20 por página (veio %)', n; end if;
  -- isolamento entre clientes
  select count(*) into n from widget_list_resellers('00000000-0000-4000-8000-0000000009a3', null, 'SP'); if n <> 1 then raise exception 'isolamento: %', n; end if;
  -- colunas fechadas ao público continuam fechadas (cnpj)
  begin
    perform cnpj from resellers limit 1;
    raise exception 'anon conseguiu ler resellers.cnpj';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== lugares para os filtros
do $$ declare j jsonb; a constant uuid := '00000000-0000-4000-8000-0000000009a1'; begin
  j := widget_list_places(a);
  if j->'ufs' <> '["PR", "SP"]'::jsonb then raise exception 'UFs: %', j->'ufs'; end if;
  if jsonb_array_length(j->'cidades') <> 3 then raise exception 'cidades físicas ativas distintas = Curitiba, Santos, São Paulo (veio %)', j->'cidades'; end if;
  if j::text like '%Online%' then raise exception 'online/ inativo vazou nos lugares'; end if;
end $$;

reset role;
rollback;
\echo OK 09
