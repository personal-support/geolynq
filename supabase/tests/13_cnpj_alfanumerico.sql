-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- 13 — CNPJ alfanumérico (migration 20261024010000). Tudo dentro de uma transação com ROLLBACK; imprime "OK 13" se passar.
-- Pré-requisito: todas as migrations aplicadas (inclui a 20261024010000). Rodar como superusuário (ex.: postgres).
begin;

-- versão ANTIGA da validação (só dígitos), copiada da migration 20261003000000, para comparar com a nova
create function pg_temp.cnpj_antigo(p text) returns boolean language plpgsql immutable strict as $f$
declare d text := regexp_replace(p, '\D', '', 'g'); w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2]; w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2]; s int; i int; r int;
begin
  if length(d) <> 14 or d ~ '^(.)\1{13}$' then return false; end if;
  s := 0; for i in 1..12 loop s := s + substr(d, i, 1)::int * w1[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  if r <> substr(d, 13, 1)::int then return false; end if;
  s := 0; for i in 1..13 loop s := s + substr(d, i, 1)::int * w2[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  return r = substr(d, 14, 1)::int;
end $f$;

do $t$
declare
  v_n int := 0; v_dif int := 0; x text; v_res jsonb; v_tenant uuid; v_raiz text; v_prov jsonb; v_ok boolean;
begin
  -- 1. exemplo oficial da Receita (12.ABC.345/01DE-35) e variações
  assert public.is_valid_cnpj('12ABC34501DE35'), 'exemplo oficial deveria ser válido';
  assert public.is_valid_cnpj('12.ABC.345/01DE-35'), 'com máscara deveria ser válido';
  assert public.is_valid_cnpj('12abc34501de35'), 'minúsculas deveriam ser aceitas';
  assert not public.is_valid_cnpj('12ABC34501DE36'), 'DV errado deveria ser inválido';
  assert not public.is_valid_cnpj('12ABC34501DEAB'), 'letras nos dígitos verificadores não valem';
  assert not public.is_valid_cnpj('12ABC34501DE3'), '13 posições não vale';
  assert not public.is_valid_cnpj('12ABC34501DE355'), '15 posições não vale';
  assert not public.is_valid_cnpj('AAAAAAAAAAAAAA'), 'tudo igual não vale';
  assert not public.is_valid_cnpj('11111111111111'), 'tudo igual não vale';
  assert public.is_valid_cnpj('00385181000111'), 'CNPJ numérico de teste deveria continuar válido';
  assert public.cnpj_normalizar('12.abc.345/01de-35') = '12ABC34501DE35', 'normalização';
  assert public.cnpj_normalizar(null) = '', 'normalização de nulo';

  -- 2. regressão: em CNPJs só numéricos, a função nova dá o mesmo resultado da antiga
  for i in 1..20000 loop
    x := lpad((floor(random() * 1e14))::bigint::text, 14, '0');
    if public.is_valid_cnpj(x) is distinct from pg_temp.cnpj_antigo(x) then v_dif := v_dif + 1; end if;
  end loop;
  assert v_dif = 0, format('divergência em %s CNPJs numéricos aleatórios', v_dif);
  -- numéricos VÁLIDOS: a base de 12 dígitos recebe o DV que a função antiga aceita
  for i in 1..3000 loop
    x := lpad((floor(random() * 1e12))::bigint::text, 12, '0');
    <<busca>>
    for d1 in 0..9 loop for d2 in 0..9 loop
      if pg_temp.cnpj_antigo(x || d1 || d2) then
        v_n := v_n + 1;
        assert public.is_valid_cnpj(x || d1 || d2), 'numérico válido na antiga deveria ser válido na nova: ' || x || d1 || d2;
        exit busca;
      end if;
    end loop; end loop;
  end loop;
  assert v_n > 2000, 'amostra de numéricos válidos pequena demais: ' || v_n;

  -- 3. 40 vetores alfanuméricos gerados por implementação independente (python; pesos 2..9 da direita para a esquerda)
  foreach x in array array['K9P34Y6N3WD268','5RQ4F5ZR37E361','P3E2Z8IQ9Y7J64','ZB6CN6Z43DVY04','RKTTNJFBF5JX05','VLSI47WQAL9V06','Q24ZKLMVT45H46','U43JSIOM1TMA34','7V3DI8FPPV5A08','SPZH8RZHQMOE89','95B9EE0VBGI003','9QYNK8W3TZPP88','PP6UP3C4DSA710','L3609Y6N14DO21','9GMNU77VTUUJ02','596LGUAX1DXN32','9Y1XJ5GXNAME68','YYWLECFPECXV05','M11HUGCMSMN548','E6EUCLDU0UM585','7OCUBRL5PTP540','AA819T9UM9ZZ86','8106X8RCD1GD08','IWFKGYQ83MTX66','QW8Y9XW1SB0936','B9U7Z3KXXZU606','Z3FCH26WSZ1408','SKWWCHSWYUWF36','XGZCS8Q7PSK407','FR4DJ79N9G8T30','E6PVAEARWPLQ14','CMK5N1LZTS1O65','LXIW47E65GH233','BH8RGP9YWVK580','H3BR4H15G5E418','G7T0LZQH82XF40','7AG3BCJJXDIS05','WBHM1G201WZC67','WUFS6RVYPWJD90','ELC8PM3804GR21'] loop
    assert public.is_valid_cnpj(x), 'vetor alfanumérico deveria ser válido: ' || x;
    assert not public.is_valid_cnpj(substr(x, 1, 13) || ((substr(x, 14, 1)::int + 1) % 10)::text), 'DV adulterado deveria falhar: ' || x;
  end loop;

  -- 4. import_reseller: aceita CNPJ com letras, reimportar atualiza (não duplica), rejeita DV errado
  insert into public.tenants (name, slug, status) values ('Teste CNPJ alfa', 'teste-cnpj-alfa', 'trial') returning id into v_tenant;
  v_res := public.import_reseller(v_tenant, '{"name":"Loja Alfa","type":"farmacia","cnpj":"12.abc.345/0001-88"}'::jsonb);
  assert (v_res ->> 'cnpj') = '12ABC345000188', 'cnpj gravado deve vir normalizado em maiúsculas: ' || (v_res ->> 'cnpj');
  assert (v_res ->> 'inserted')::boolean, 'primeira importação deve inserir';
  v_res := public.import_reseller(v_tenant, '{"name":"Loja Alfa (renomeada)","type":"farmacia","cnpj":"12ABC345000188"}'::jsonb);
  assert not (v_res ->> 'inserted')::boolean, 'reimportar deve atualizar, não duplicar';
  assert (select count(*) from public.resellers where tenant_id = v_tenant) = 1, 'deve haver 1 revendedor';
  v_ok := false;
  begin
    perform public.import_reseller(v_tenant, '{"name":"Loja Ruim","type":"farmacia","cnpj":"12ABC345000189"}'::jsonb);
  exception when sqlstate '22023' then v_ok := true; end;
  assert v_ok, 'DV errado deveria ser recusado pelo import_reseller';
  -- numérico continua funcionando
  v_res := public.import_reseller(v_tenant, '{"name":"Loja Num","type":"farmacia","cnpj":"00.385.181/0001-11"}'::jsonb);
  assert (v_res ->> 'cnpj') = '00385181000111', 'numérico com máscara';

  -- 5. o CHECK da tabela também segura (inserção direta, sem passar pela função)
  v_ok := false;
  begin
    insert into public.resellers (tenant_id, name, type, status, cnpj) values (v_tenant, 'Direto ruim', 'farmacia', 'active', '12ABC345000199');
  exception when check_violation then v_ok := true; end;
  assert v_ok, 'CHECK de resellers deveria recusar CNPJ com DV errado';
  v_ok := false;
  begin
    insert into public.resellers (tenant_id, name, type, status, cnpj) values (v_tenant, 'Minúscula', 'farmacia', 'active', '12abc345000188');
  exception when check_violation then v_ok := true; end;
  assert v_ok, 'CHECK deve exigir maiúsculas (a função normaliza antes de gravar)';

  -- 6. provision_tenant com matriz alfanumérica; filial (final 0002) é recusada; raiz repetida é recusada
  v_prov := public.provision_tenant('cliente-alfa', 'Cliente Alfa',
    '{"cnpj_matriz":"AB.1CD.2EF/0001-70","razao_social":"ALFA LTDA","situacao_cadastral":"ativa"}'::jsonb);
  assert (v_prov ->> 'cnpj_raiz') = 'AB1CD2EF', 'raiz alfanumérica: ' || (v_prov ->> 'cnpj_raiz');
  assert (select cnpj_matriz from public.tenant_profiles where cnpj_raiz = 'AB1CD2EF') = 'AB1CD2EF000170', 'matriz gravada';
  v_ok := false;
  begin
    perform public.provision_tenant('cliente-filial', 'Filial', '{"cnpj_matriz":"12ABC345000269","razao_social":"X","situacao_cadastral":"ativa"}'::jsonb);
  exception when sqlstate '22023' then v_ok := true; end;
  assert v_ok, 'filial (0002) deveria ser recusada';
  v_ok := false;
  begin
    perform public.provision_tenant('cliente-alfa-2', 'Alfa 2', '{"cnpj_matriz":"AB1CD2EF000170","razao_social":"ALFA LTDA","situacao_cadastral":"ativa"}'::jsonb);
  exception when sqlstate '23505' then v_ok := true; end;
  assert v_ok, 'raiz repetida deveria ser recusada';
end
$t$;

rollback;
\echo OK 13
