-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- 17 — Candidatos a revendedor e CNAEs de canal (migration 20261025000000). Transação com ROLLBACK; imprime "OK 17".
-- Hermético: cria o próprio cliente de teste, rede e candidatos (nada de `demo`).
-- 1) propose_channel_cnaes: conta cada revendedor ATIVO uma vez por CNAE (principal ou secundário), respeita 5% e 3+ revendedores,
--    marca o CNAE "guarda-chuva" como ruidoso e não mexe no que a pessoa já confirmou;
-- 2) reseller_receita_resumo: separa sem CNPJ, pendentes, não encontrados, inativos e usados;
-- 3) panel_candidates: casa a cidade sem acento/caixa, esconde quem já é revendedor (mesma raiz), conta só abertos, limita a lista;
-- 4) panel_candidate_status: owner altera, viewer não, estranho recebe null; andamento inválido dá erro;
-- 5) restrições e permissões: CNPJ inválido, UF minúscula e CEP malformado são recusados; anônimo e viewer não escrevem.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'owner17@teste'),
  ('00000000-0000-4000-8000-0000000000e2', 'viewer17@teste'),
  ('00000000-0000-4000-8000-0000000000e3', 'estranho17@teste');
insert into public.tenants (id, name, slug, status) values ('00000000-0000-4000-8000-0000000017aa', 'Cliente 17', 'cliente-17', 'trial');
insert into public.tenant_users (tenant_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000017aa', '00000000-0000-4000-8000-0000000000e1', 'owner'),
  ('00000000-0000-4000-8000-0000000017aa', '00000000-0000-4000-8000-0000000000e2', 'viewer');

-- rede de teste: 8 revendedores com CNPJ válido (um alfanumérico) + 1 sem CNPJ
create temp table r17 (n int, id uuid, cnpj text);
do $s$
declare
  t constant uuid := '00000000-0000-4000-8000-0000000017aa';
  cnpjs text[] := array['11222333000181', '45997418000153', '33000167000101', '60701190000104', '07526557000100', '90400888000142', 'AB12CD34000184', 'ZX9Q7M21000111'];
  i int; novo uuid;
begin
  for i in 1 .. 8 loop
    insert into public.resellers (tenant_id, name, type, status, cnpj) values (t, 'R17-' || i, 'loja_fisica', 'active', cnpjs[i]) returning id into novo;
    insert into r17 values (i, novo, cnpjs[i]);
  end loop;
  insert into public.resellers (tenant_id, name, type, status) values (t, 'R17-sem-cnpj', 'online', 'active');
end
$s$;

-- Receita: 1-4 ativos (4763602 principal); 5 ativo (4729699 principal, 4763602 secundário e o 4729699 repetido de propósito);
-- 6 BAIXADA (fica de fora); 7 não encontrado; 8 sem consulta (pendente)
insert into public.reseller_receita (reseller_id, tenant_id, cnpj, situacao, cnae_principal, cnaes_secundarios, erro)
select r.id, '00000000-0000-4000-8000-0000000017aa', r.cnpj, v.sit, v.cp, v.sec, v.erro
  from r17 r join (values
    (1, 'ATIVA',   '4763602', array['4729699', '9313100'], null),
    (2, 'ATIVA',   '4763602', array['9313100'],            null),
    (3, 'ATIVA',   '4763602', array['9313100'],            null),
    (4, 'ATIVA',   '4763602', array[]::text[],             null),
    (5, 'ATIVA',   '4729699', array['4763602', '4729699'], null),
    (6, 'BAIXADA', '4763602', array[]::text[],             null),
    (7, null,      null,      array[]::text[],             'nao_encontrado')
  ) v(n, sit, cp, sec, erro) on v.n = r.n;

do $t$
declare
  t constant uuid := '00000000-0000-4000-8000-0000000017aa';
  r record; j jsonb;
begin
  -- 1) proposta: 5 ativos consultados; 4763602 em 5 (4 principal + 1 secundário), 9313100 em 3, 4729699 em 2
  select * into r from public.propose_channel_cnaes(t) where cnae = '4763602';
  assert r.n_revendedores = 5, '4763602 deveria estar em 5 revendedores, veio ' || r.n_revendedores;
  assert r.n_principal = 4 and r.peso = 3, 'peso/principais do 4763602: ' || r.n_principal || '/' || r.peso;
  assert r.participacao = 1.000, 'participação do 4763602 deveria ser 100%: ' || r.participacao;
  assert r.status = 'proposto' and not r.ruidoso, '4763602 deveria vir proposto e não ruidoso';
  select * into r from public.propose_channel_cnaes(t) where cnae = '9313100';
  assert r.n_revendedores = 3 and r.peso = 1, '9313100 (só secundário): ' || r.n_revendedores || '/' || r.peso;
  assert not exists (select 1 from public.propose_channel_cnaes(t) where cnae = '4729699'), '4729699 está em 2 revendedores (< 3): não deveria entrar';
  select * into r from public.propose_channel_cnaes(t, 0.05, 2) where cnae = '4729699';
  assert r.n_revendedores = 2 and r.ruidoso, '4729699 com mínimo 2 deveria entrar e vir marcado como ruidoso';
  assert (select participacao from public.propose_channel_cnaes(t) where cnae = '9313100') = 0.600, '9313100 está em 3 dos 5 ativos consultados (60%)';

  -- o que a pessoa confirmou não é sobrescrito
  update public.tenant_channel_cnaes set status = 'confirmado', peso = 2 where tenant_id = t and cnae = '4763602';
  perform * from public.propose_channel_cnaes(t);
  assert (select peso from public.tenant_channel_cnaes where tenant_id = t and cnae = '4763602') = 2, 'recalcular não pode mexer no que foi confirmado';

  -- 2) resumo das exclusões: 9 revendedores ativos = 1 sem CNPJ + 1 pendente + 1 não encontrado + 1 inativo + 5 usados
  j := public.reseller_receita_resumo(t);
  assert (j ->> 'revendedores')::int = 9 and (j ->> 'sem_cnpj')::int = 1 and (j ->> 'pendentes')::int = 1
     and (j ->> 'nao_encontrados')::int = 1 and (j ->> 'inativos')::int = 1 and (j ->> 'usados')::int = 5
     and (j ->> 'cnpj_invalido')::int = 0 and (j ->> 'consulta_falhou')::int = 0, 'resumo diverge: ' || j;
end
$t$;

-- candidatos: 9 em Santos/SP (um com a raiz de um revendedor do cliente, um "não vende", um "sem interesse"), 1 em Mirassol/SP,
-- 1 em Santos/RJ (outra UF, não pode aparecer). Cidades gravadas em MAIÚSCULAS e com acento, como vêm da Receita.
insert into public.reseller_candidates (tenant_id, cnpj, nome_fantasia, cnae, uf, municipio, bairro, cep, score, status) values
  ('00000000-0000-4000-8000-0000000017aa', '19283746000188', 'Alfa Suplementos',   '4763602', 'SP', 'SANTOS',  'Gonzaga',     '11060001', 40, 'novo'),
  ('00000000-0000-4000-8000-0000000017aa', '86420975000194', 'Beta Academia',      '9313100', 'SP', 'SANTOS',  'Boqueirão',   '11055100', 30, 'novo'),
  ('00000000-0000-4000-8000-0000000017aa', '24681012000197', 'Gama Nutrição',      '4763602', 'SP', 'SANTOS',  'Embaré',      '11040000', 35, 'contatado'),
  ('00000000-0000-4000-8000-0000000017aa', '13579113000135', 'Delta Esportes',     '4763602', 'SP', 'SANTOS',  'Aparecida',   '11030400', 20, 'novo'),
  ('00000000-0000-4000-8000-0000000017aa', '98765432000198', 'Épsilon Fit',        '4729699', 'SP', 'SANTOS',  'Vila Mathias','11013000', 10, 'novo'),
  ('00000000-0000-4000-8000-0000000017aa', '77123456000173', 'Zeta Natural',       '4729699', 'SP', 'SANTOS',  'Ponta da Praia','11030000', 12, 'nao_vende'),
  ('00000000-0000-4000-8000-0000000017aa', '55800012000192', 'Eta Vitaminas',      '4763602', 'SP', 'SANTOS',  'Marapé',      '11070000', 33, 'sem_interesse'),
  ('00000000-0000-4000-8000-0000000017aa', '12345678000276', 'Teta Saúde',         '4763602', 'SP', 'MIRASSOL','Centro',      '15130000', 25, 'novo'),
  ('00000000-0000-4000-8000-0000000017aa', '11222333000262', 'Filial do revendedor 1', '4763602', 'SP', 'SANTOS', 'Centro',   '11010000', 99, 'novo'),   -- mesma raiz (11222333) do revendedor 1
  ('00000000-0000-4000-8000-0000000017aa', '60701190000287', null,                 '4763602', 'RJ', 'SANTOS',  null,          null,       5,  'novo');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000e2', true);   -- viewer

do $t$
declare
  t constant uuid := '00000000-0000-4000-8000-0000000017aa';
  j jsonb; g jsonb; ok boolean; id1 uuid;
begin
  -- 3) candidatos por cidade (viewer lê). "santos" sem acento/caixa casa com SANTOS; Mirassol vem junto; RJ não entra em SP.
  j := public.panel_candidates(t, '[{"uf":"SP","cidade":"Santos"},{"uf":"SP","cidade":"mirassol"},{"uf":"SP","cidade":"Praia Grande"}]'::jsonb);
  assert jsonb_array_length(j) = 2, 'deveria haver 2 cidades com candidatos (Praia Grande não tem): ' || j;
  g := (select x from jsonb_array_elements(j) x where x ->> 'cidade' = 'Santos');
  -- Santos/SP: 7 gravados - o da mesma raiz do revendedor 1 = 7 (Alfa, Beta, Gama, Delta, Épsilon, Zeta, Eta); abertos = 5 (sem Zeta e Eta)
  assert (g ->> 'abertos')::int = 5, 'abertos em Santos: ' || (g ->> 'abertos');
  assert (g #>> '{por_status,novo}')::int = 4 and (g #>> '{por_status,contatado}')::int = 1
     and (g #>> '{por_status,nao_vende}')::int = 1 and (g #>> '{por_status,sem_interesse}')::int = 1, 'por_status: ' || (g -> 'por_status');
  assert not exists (select 1 from jsonb_array_elements(g -> 'itens') i where i ->> 'nome' = 'Filial do revendedor 1'), 'a filial de um revendedor da rede não pode aparecer';
  assert not exists (select 1 from jsonb_array_elements(g -> 'itens') i where i ->> 'cnpj' = '60701190000287'), 'candidato de outra UF não pode aparecer';
  -- ordem: abertos primeiro, maior score primeiro (Alfa 40, Gama 35, Beta 30, Delta 20, Épsilon 10), depois os fechados (Eta 33, Zeta 12); o padrão mostra 6
  assert (select string_agg(i ->> 'nome', ',' order by o) from jsonb_array_elements(g -> 'itens') with ordinality t(i, o)) =
         'Alfa Suplementos,Gama Nutrição,Beta Academia,Delta Esportes,Épsilon Fit,Eta Vitaminas', 'ordem dos itens (limite padrão de 6; fechados por último)';
  -- limite
  g := (select x from jsonb_array_elements(public.panel_candidates(t, '[{"uf":"SP","cidade":"SANTOS"}]'::jsonb, 3)) x);
  assert jsonb_array_length(g -> 'itens') = 3 and (g ->> 'abertos')::int = 5, 'o limite só corta a lista, não a contagem';
  -- cidade vazia/entrada inválida não quebra
  assert public.panel_candidates(t, '[]'::jsonb) = '[]'::jsonb and public.panel_candidates(t, null) = '[]'::jsonb and public.panel_candidates(t, '{"a":1}'::jsonb) = '[]'::jsonb, 'entradas inválidas';
  -- descrição do CNAE só quando o catálogo conhece (4763602 está no catálogo de suplementos)
  assert (select i ->> 'cnae_desc' from jsonb_array_elements(g -> 'itens') i where i ->> 'nome' = 'Alfa Suplementos') is not null or not exists (select 1 from public.cnae_catalog where cnae = '4763602'), 'descrição do CNAE';

  -- 4) viewer não altera
  id1 := (select id from public.reseller_candidates where tenant_id = t and cnpj = '19283746000188');
  ok := false;
  begin perform public.panel_candidate_status(t, id1, 'contatado'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'viewer não deveria alterar o andamento';
  ok := false;
  begin update public.reseller_candidates set status = 'vende' where id = id1; if not found then ok := true; end if; exception when insufficient_privilege then ok := true; end;
  assert ok, 'viewer não deveria escrever direto na tabela';
end
$t$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000e1', true);   -- owner
do $t$
declare
  t constant uuid := '00000000-0000-4000-8000-0000000017aa';
  id1 uuid := (select id from public.reseller_candidates where tenant_id = '00000000-0000-4000-8000-0000000017aa' and cnpj = '19283746000188');
  g jsonb; ok boolean;
begin
  assert public.panel_candidate_status(t, id1, 'contatado') is true, 'owner deveria conseguir alterar';
  assert (select status from public.reseller_candidates where id = id1) = 'contatado', 'status não mudou';
  assert (select status_por from public.reseller_candidates where id = id1) = '00000000-0000-4000-8000-0000000000e1' and (select status_em from public.reseller_candidates where id = id1) is not null, 'quem/quando não gravou';
  ok := false;
  begin perform public.panel_candidate_status(t, id1, 'ganhei'); exception when invalid_parameter_value then ok := true; end;
  assert ok, 'andamento inválido deveria dar erro';
  assert public.panel_candidate_status(t, '00000000-0000-4000-8000-00000000ffff', 'vende') is false, 'id inexistente deveria devolver false';
  -- marcar "sem interesse" tira da contagem de abertos
  perform public.panel_candidate_status(t, id1, 'sem_interesse');
  g := (select x from jsonb_array_elements(public.panel_candidates(t, '[{"uf":"SP","cidade":"Santos"}]'::jsonb)) x);
  assert (g ->> 'abertos')::int = 4, 'abertos deveria cair para 4: ' || (g ->> 'abertos');
  -- o service_role ainda é o único que escreve nas outras tabelas
  ok := false;
  begin insert into public.tenant_channel_cnaes (tenant_id, cnae) values (t, '1111111'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'authenticated não deveria escrever em tenant_channel_cnaes';
  ok := false;
  begin perform * from public.propose_channel_cnaes(t); exception when insufficient_privilege then ok := true; end;
  assert ok, 'authenticated não deveria executar propose_channel_cnaes';
end
$t$;

-- estranho: recebe null (leitura) e null (escrita), sem erro
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000e3', true);
do $t$
declare t constant uuid := '00000000-0000-4000-8000-0000000017aa';
begin
  assert public.panel_candidates(t, '[{"uf":"SP","cidade":"Santos"}]'::jsonb) is null, 'estranho deveria receber null';
  assert public.panel_candidate_status(t, (select id from public.reseller_candidates limit 1), 'vende') is null, 'estranho não altera';
  assert not exists (select 1 from public.reseller_candidates), 'RLS: estranho não deveria enxergar candidatos';
  assert not exists (select 1 from public.tenant_channel_cnaes), 'RLS: estranho não deveria enxergar CNAEs de canal';
end
$t$;

-- anônimo
set local role anon;
do $t$
declare ok boolean := false;
begin
  begin perform public.panel_candidates('00000000-0000-4000-8000-0000000017aa', '[]'::jsonb); exception when insufficient_privilege then ok := true; end;
  assert ok, 'anônimo não deveria executar panel_candidates';
end
$t$;

-- 5) restrições (como dono do banco)
reset role;
do $t$
declare t constant uuid := '00000000-0000-4000-8000-0000000017aa'; ok boolean;
begin
  ok := false; begin insert into public.reseller_candidates (tenant_id, cnpj, cnae, uf, municipio) values (t, '11222333000180', '4763602', 'SP', 'SANTOS'); exception when check_violation then ok := true; end;
  assert ok, 'CNPJ com DV errado deveria ser recusado';
  ok := false; begin insert into public.reseller_candidates (tenant_id, cnpj, cnae, uf, municipio) values (t, '11222333000181', '4763602', 'sp', 'SANTOS'); exception when check_violation then ok := true; end;
  assert ok, 'UF em minúsculas deveria ser recusada';
  ok := false; begin insert into public.reseller_candidates (tenant_id, cnpj, cnae, uf, municipio, cep) values (t, '11222333000181', '4763602', 'SP', 'SANTOS', '11.060-001'); exception when check_violation then ok := true; end;
  assert ok, 'CEP com máscara deveria ser recusado (só 8 dígitos)';
  ok := false; begin insert into public.reseller_candidates (tenant_id, cnpj, cnae, uf, municipio) values (t, '19283746000188', '4763602', 'SP', 'SANTOS'); exception when unique_violation then ok := true; end;
  assert ok, 'o mesmo CNPJ não pode entrar duas vezes no mesmo cliente';
  -- apagar o cliente leva tudo junto (CASCADE)
  delete from public.tenants where id = t;
  assert not exists (select 1 from public.reseller_candidates where tenant_id = t) and not exists (select 1 from public.reseller_receita where tenant_id = t)
     and not exists (select 1 from public.tenant_channel_cnaes where tenant_id = t), 'CASCADE deveria limpar tudo';
end
$t$;
rollback;
\echo OK 17
