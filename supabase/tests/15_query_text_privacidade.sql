-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- 15 — Texto digitado com cara de dado pessoal não é gravado (migration 20261024020000). Transação com ROLLBACK; imprime "OK 15".
-- Pré-requisito: migrations aplicadas e um tenant `demo` (docs/schema-locator-v2.sql cria).
begin;
do $t$
declare
  v_tenant uuid := (select id from public.tenants where slug = 'demo');
  v_txt text;
  caso text;
begin
  assert v_tenant is not null, 'tenant demo não existe no banco de teste';

  -- devem virar NULL
  foreach caso in array array['02636-060', '02636060', 'joao@email.com', '(13) 99999-8888', '13999998888', '123.456.789-09',
                              'cartão 4111 1111 1111 1111', 'meu cep é 11060-001 santos', 'a@b'] loop
    insert into public.widget_events (tenant_id, session_id, event_type, query_text) values (v_tenant, 'teste-15', 'search', caso)
      returning query_text into v_txt;
    assert v_txt is null, 'deveria descartar: ' || caso;
  end loop;

  -- devem ficar como estão
  foreach caso in array array['whey protein isolado 900g', 'OM3-120', 'BCAA 2:1:1 120 cápsulas', 'whey 900', 'creatina', 'pasta de amendoim',
                              'colágeno 300g', 'barra de proteína (caixa com 12 un)'] loop
    insert into public.widget_events (tenant_id, session_id, event_type, query_text) values (v_tenant, 'teste-15', 'search', caso)
      returning query_text into v_txt;
    assert v_txt = caso, 'não deveria mexer em: ' || caso || ' (ficou ' || coalesce(v_txt, 'NULL') || ')';
  end loop;

  -- nulo continua nulo e o evento é gravado
  insert into public.widget_events (tenant_id, session_id, event_type, query_text) values (v_tenant, 'teste-15', 'product_select', null)
    returning query_text into v_txt;
  assert v_txt is null;

  -- o evento é contado mesmo sem o texto
  assert (select count(*) from public.widget_events where session_id = 'teste-15') = 18, 'todos os eventos deveriam ter sido gravados';
end
$t$;
rollback;
\echo OK 15
