-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- 18 — Candidatos: ranking que aprende com as marcações e palavras do ramo (migration 20261027000000). ROLLBACK; imprime "OK 18".
-- Hermético: cria o próprio cliente. Cobre:
-- 1) por atividade: com 5+ marcações decididas o ajuste vai de -6 a +6 (4 vendem e 2 não = +2; 1 vende e 4 não = -4; com 3 marcações = 0);
-- 2) por rede (mesma raiz de CNPJ): +6 se outra da rede vende, -10 se outra da rede foi marcada "não vende/sem interesse";
-- 3) palavras: sobem (+peso) e descem (-peso) pelo nome sem acento/caixa; vale o maior de cada tipo; a lista pode ser lida por todos e mudada só por owner/admin;
-- 4) o ranking (lista e cartão) usa score + ajuste e explica o motivo; desfazer a marcação volta ao normal (nada é gravado no score).
begin;

create function pg_temp.cnpj(b12 text) returns text language plpgsql immutable as $f$
declare v int[] := '{}'; i int; w int; t int; d1 int; d2 int;
begin
  for i in 1 .. 12 loop v := v || (ascii(substr(b12, i, 1)) - 48); end loop;
  w := 2; t := 0;
  for i in reverse 12 .. 1 loop t := t + v[i] * w; w := case when w < 9 then w + 1 else 2 end; end loop;
  d1 := case when t % 11 < 2 then 0 else 11 - t % 11 end;
  v := v || d1; w := 2; t := 0;
  for i in reverse 13 .. 1 loop t := t + v[i] * w; w := case when w < 9 then w + 1 else 2 end; end loop;
  d2 := case when t % 11 < 2 then 0 else 11 - t % 11 end;
  return b12 || d1 || d2;
end $f$;

create function pg_temp.ins(raiz text, ordem text, nome text, cnae text, st text, score int default 20) returns void language sql as $f$
  insert into public.reseller_candidates (tenant_id, cnpj, nome_fantasia, cnae, uf, municipio, score, status)
  values ('00000000-0000-4000-8000-0000000018aa', pg_temp.cnpj(raiz || ordem), nome, cnae, 'SP', 'SANTOS', score, st);
$f$;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000f1', 'owner18@teste'), ('00000000-0000-4000-8000-0000000000f2', 'viewer18@teste'), ('00000000-0000-4000-8000-0000000000f3', 'estranho18@teste');
insert into public.tenants (id, name, slug, status) values ('00000000-0000-4000-8000-0000000018aa', 'Cliente 18', 'cliente-18', 'trial');
insert into public.tenant_users (tenant_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000018aa', '00000000-0000-4000-8000-0000000000f1', 'owner'),
  ('00000000-0000-4000-8000-0000000018aa', '00000000-0000-4000-8000-0000000000f2', 'viewer');

-- atividade A (4763602): 4 vendem, 1 não vende, 1 sem interesse => +2 ; A7 é "novo"
select pg_temp.ins('20000001', '0001', 'A1', '4763602', 'vende'), pg_temp.ins('20000002', '0001', 'A2', '4763602', 'vende'),
       pg_temp.ins('20000003', '0001', 'A3', '4763602', 'vende'), pg_temp.ins('20000004', '0001', 'A4', '4763602', 'vende'),
       pg_temp.ins('20000005', '0001', 'A5', '4763602', 'nao_vende'), pg_temp.ins('20000006', '0001', 'A6', '4763602', 'sem_interesse'),
       pg_temp.ins('20000007', '0001', 'A7', '4763602', 'novo');
-- atividade B (9313100): 1 vende, 4 não => round(6*(1-4)/5) = -4 ; B6 é "novo"
select pg_temp.ins('30000001', '0001', 'B1', '9313100', 'vende'), pg_temp.ins('30000002', '0001', 'B2', '9313100', 'nao_vende'),
       pg_temp.ins('30000003', '0001', 'B3', '9313100', 'nao_vende'), pg_temp.ins('30000004', '0001', 'B4', '9313100', 'sem_interesse'),
       pg_temp.ins('30000005', '0001', 'B5', '9313100', 'sem_interesse'), pg_temp.ins('30000006', '0001', 'B6', '9313100', 'novo');
-- atividade C (4771701): só 3 marcações => sem ajuste ; C4 "novo"
select pg_temp.ins('10000001', '0001', 'C1', '4771701', 'vende'), pg_temp.ins('10000002', '0001', 'C2', '4771701', 'nao_vende'),
       pg_temp.ins('10000003', '0001', 'C3', '4771701', 'nao_vende'), pg_temp.ins('10000004', '0001', 'C4', '4771701', 'novo');
-- redes (atividade D, 4771702, com poucas marcações): raiz 40000001 (uma vende) e 40000002 (uma sem interesse)
select pg_temp.ins('40000001', '0001', 'Rede1 matriz', '4771702', 'vende'), pg_temp.ins('40000001', '0002', 'Rede1 filial', '4771702', 'novo'),
       pg_temp.ins('40000002', '0001', 'Rede2 matriz', '4771702', 'sem_interesse'), pg_temp.ins('40000002', '0002', 'Rede2 filial', '4771702', 'novo');
-- nomes para as palavras (atividade E, 4771702... usa 4639701 para não misturar)
select pg_temp.ins('50000001', '0001', 'ACADEMIA Forte', '4639701', 'novo'), pg_temp.ins('50000002', '0001', 'Moda Fit', '4639701', 'novo'),
       pg_temp.ins('50000003', '0001', 'Moda e Academia', '4639701', 'novo'), pg_temp.ins('50000004', '0001', 'Nutrição Total', '4639701', 'novo'),
       pg_temp.ins('50000005', '0001', 'Casa do Sol', '4639701', 'novo');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true);   -- viewer

create function pg_temp.ajuste_de(nome text) returns integer language sql as $f$
  select (i ->> 'ajuste')::int from jsonb_array_elements(public.panel_candidates_list('00000000-0000-4000-8000-0000000018aa', null, null, null, null, null, 500, 0) -> 'itens') i where i ->> 'nome' = nome;
$f$;
create function pg_temp.motivo_de(nome text) returns text language sql as $f$
  select i ->> 'motivo' from jsonb_array_elements(public.panel_candidates_list('00000000-0000-4000-8000-0000000018aa', null, null, null, null, null, 500, 0) -> 'itens') i where i ->> 'nome' = nome;
$f$;
create function pg_temp.score_de(nome text) returns integer language sql as $f$
  select (i ->> 'score')::int from jsonb_array_elements(public.panel_candidates_list('00000000-0000-4000-8000-0000000018aa', null, null, null, null, null, 500, 0) -> 'itens') i where i ->> 'nome' = nome;
$f$;

do $t$
declare
  t constant uuid := '00000000-0000-4000-8000-0000000018aa';
  ok boolean; j jsonb;
begin
  -- 1) por atividade
  assert pg_temp.ajuste_de('A7') = 2, 'A7 (atividade com 4 vendem e 2 não): ' || coalesce(pg_temp.ajuste_de('A7')::text, 'null');
  assert pg_temp.motivo_de('A7') like '%bom retorno%', 'motivo A7: ' || coalesce(pg_temp.motivo_de('A7'), 'null');
  assert pg_temp.ajuste_de('B6') = -4 and pg_temp.motivo_de('B6') like '%baixo retorno%', 'B6: ' || coalesce(pg_temp.ajuste_de('B6')::text, 'null');
  assert pg_temp.ajuste_de('C4') = 0 and pg_temp.motivo_de('C4') is null, 'C4 (só 3 marcações) não deveria ter ajuste';
  assert pg_temp.score_de('A7') = 22 and pg_temp.score_de('B6') = 16, 'score exibido = score + ajuste: ' || pg_temp.score_de('A7') || '/' || pg_temp.score_de('B6');

  -- 2) por rede
  assert pg_temp.ajuste_de('Rede1 filial') = 6 and pg_temp.motivo_de('Rede1 filial') like '%mesma rede já vende%', 'filial da rede que vende: ' || pg_temp.ajuste_de('Rede1 filial');
  assert pg_temp.ajuste_de('Rede2 filial') = -10 and pg_temp.motivo_de('Rede2 filial') like '%mesma rede foi marcada%', 'filial da rede sem interesse: ' || pg_temp.ajuste_de('Rede2 filial');
  assert pg_temp.ajuste_de('Rede1 matriz') = 0, 'quem já vende não ganha ajuste de rede de si mesmo';
  assert pg_temp.ajuste_de('Rede2 matriz') = 0, 'quem foi marcada não se pune duas vezes';

  -- 3) palavras: sem termos, nada muda
  assert pg_temp.ajuste_de('ACADEMIA Forte') = 0 and pg_temp.ajuste_de('Nutrição Total') = 0, 'sem palavras não há ajuste';
  assert public.panel_terms(t) = '[]'::jsonb, 'lista de palavras começa vazia';

  -- viewer não muda palavras
  ok := false;
  begin perform public.panel_term_set(t, 'academia', 'sobe'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'viewer não deveria mudar as palavras';
  ok := false;
  begin perform public.panel_term_remove(t, 'academia', 'sobe'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'viewer não deveria remover palavras';
end
$t$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);   -- owner

do $t$
declare
  t constant uuid := '00000000-0000-4000-8000-0000000018aa';
  ok boolean; j jsonb; ord text;
begin
  assert public.panel_term_set(t, '  Academia ', 'sobe', 6) is true, 'owner deveria conseguir';
  assert public.panel_term_set(t, 'MODA', 'desce', 8) is true;
  assert public.panel_term_set(t, 'Nutrição', 'sobe', 4) is true, 'termo com acento é guardado sem acento';
  assert public.panel_terms(t) = '[{"termo":"nutricao","tipo":"sobe","peso":4},{"termo":"moda","tipo":"desce","peso":8},{"termo":"academia","tipo":"sobe","peso":6}]'::jsonb
      or (select count(*) from jsonb_array_elements(public.panel_terms(t))) = 3, 'três palavras: ' || public.panel_terms(t)::text;
  assert exists (select 1 from jsonb_array_elements(public.panel_terms(t)) x where x ->> 'termo' = 'nutricao' and x ->> 'tipo' = 'sobe'), 'nutricao';

  assert pg_temp.ajuste_de('ACADEMIA Forte') = 6, 'academia sobe 6 (caixa e acento ignorados): ' || pg_temp.ajuste_de('ACADEMIA Forte');
  assert pg_temp.ajuste_de('Moda Fit') = -8, 'moda desce 8';
  assert pg_temp.ajuste_de('Moda e Academia') = -2, 'academia (+6) e moda (-8) somam -2: ' || pg_temp.ajuste_de('Moda e Academia');
  assert pg_temp.ajuste_de('Nutrição Total') = 4, 'nutrição sobe 4 (termo sem acento casa com nome com acento)';
  assert pg_temp.ajuste_de('Casa do Sol') = 0, 'sem palavra, sem ajuste';
  assert pg_temp.motivo_de('Moda e Academia') like '%palavra do ramo%' and pg_temp.motivo_de('Moda e Academia') like '%fora do ramo%', 'motivo com as duas palavras';

  -- vale o MAIOR peso de cada tipo (não soma duas palavras do mesmo tipo)
  perform public.panel_term_set(t, 'forte', 'sobe', 9);
  assert pg_temp.ajuste_de('ACADEMIA Forte') = 9, 'maior peso de "sobe" (9, não 6+9): ' || pg_temp.ajuste_de('ACADEMIA Forte');
  -- atualizar o peso de uma palavra existente
  perform public.panel_term_set(t, 'forte', 'sobe', 3);
  assert pg_temp.ajuste_de('ACADEMIA Forte') = 6, 'peso atualizado para 3: vale a academia (6)';

  -- ordem: o candidato com palavra sobe na frente do idêntico sem palavra (mesmo score base)
  j := public.panel_candidates_list(t, null, null, '4639701', 'novo', null, 50, 0);
  ord := (select string_agg(i ->> 'nome', ',' order by o) from jsonb_array_elements(j -> 'itens') with ordinality x(i, o));
  assert ord = 'ACADEMIA Forte,Nutrição Total,Casa do Sol,Moda e Academia,Moda Fit', 'ordem pelo score ajustado: ' || ord;

  -- o cartão da tela Lacunas também usa o ajuste e traz o motivo
  j := public.panel_candidates(t, '[{"uf":"SP","cidade":"Santos"}]'::jsonb, 3);
  assert (j -> 0 -> 'itens' -> 0 ->> 'ajuste') is not null, 'cartão traz o ajuste';

  -- remover palavra e entradas inválidas
  assert public.panel_term_remove(t, 'moda', 'desce') is true and pg_temp.ajuste_de('Moda Fit') = 0, 'remover volta ao normal';
  assert public.panel_term_remove(t, 'moda', 'desce') is false, 'remover de novo devolve false';
  ok := false; begin perform public.panel_term_set(t, 'a', 'sobe'); exception when invalid_parameter_value then ok := true; end; assert ok, 'palavra de 1 letra é inválida';
  ok := false; begin perform public.panel_term_set(t, 'ok', 'talvez'); exception when invalid_parameter_value then ok := true; end; assert ok, 'tipo inválido';
  ok := false; begin perform public.panel_term_set(t, 'ok', 'sobe', 99); exception when invalid_parameter_value then ok := true; end; assert ok, 'peso fora de 1 a 12';
  ok := false; begin perform public.panel_term_set(t, repeat('x', 41), 'sobe'); exception when invalid_parameter_value then ok := true; end; assert ok, 'palavra longa demais';

end
$t$;

-- desfazer as marcações volta o ranking (nada foi gravado no score): quem marca é o painel; aqui o dono do banco simula
reset role;
update public.reseller_candidates set status = 'novo' where tenant_id = '00000000-0000-4000-8000-0000000018aa' and nome_fantasia in ('A1', 'A2', 'A3', 'A4', 'A5', 'A6');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;
do $t$
begin
  assert pg_temp.ajuste_de('A7') = 0, 'desmarcar tira o ajuste da atividade: ' || pg_temp.ajuste_de('A7');
end
$t$;

-- limite de 60 palavras
reset role;
insert into public.tenant_candidate_terms (tenant_id, termo, tipo) select '00000000-0000-4000-8000-0000000018aa', 'termo ' || g, 'sobe' from generate_series(1, 60) g on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
do $t$
declare ok boolean := false;
begin
  begin perform public.panel_term_set('00000000-0000-4000-8000-0000000018aa', 'mais uma', 'desce'); exception when program_limit_exceeded then ok := true; end;
  assert ok, 'a palavra 61 deveria ser recusada';
end
$t$;

-- estranho: tudo null; anônimo: nada
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f3","role":"authenticated"}', true);
do $t$
declare t constant uuid := '00000000-0000-4000-8000-0000000018aa';
begin
  assert public.panel_terms(t) is null and public.panel_term_set(t, 'abc', 'sobe') is null and public.panel_term_remove(t, 'abc', 'sobe') is null, 'estranho recebe null';
  assert public.panel_candidates_list(t) is null, 'estranho não lista';
  assert not exists (select 1 from public.tenant_candidate_terms), 'RLS: estranho não vê palavras';
end
$t$;
set local role anon;
do $t$
declare ok boolean := false;
begin
  begin perform public.panel_terms('00000000-0000-4000-8000-0000000018aa'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'anônimo não deveria executar panel_terms';
end
$t$;
rollback;
\echo OK 18
