-- Testa panel_gaps (migration 20261009000000) contra panel_overview, no cliente fabrica-teste. Imprime "OK 08".
\set ON_ERROR_STOP on
begin;
select set_config('t.ft', (select id::text from tenants where slug = 'fabrica-teste'), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000aa', true);
do $$
declare ft uuid := current_setting('t.ft')::uuid; g jsonb; o jsonb; soma int;
begin
  foreach soma in array array[7, 30, 90] loop
    g := panel_gaps(ft, soma);
    o := panel_overview(ft, soma);
    if (g->>'total_buscas')::int <> (o->'kpis'->>'sem_cobertura')::int then
      raise exception '% dias: total de panel_gaps (%) deve bater com kpis.sem_cobertura (%)', soma, g->>'total_buscas', o->'kpis'->>'sem_cobertura';
    end if;
    if (g->>'combinacoes')::int <> jsonb_array_length(g->'itens') then raise exception '% dias: combinacoes <> itens (< 500)', soma; end if;
    if (select coalesce(sum((x->>'buscas')::int), 0) from jsonb_array_elements(g->'itens') x) <> (g->>'total_buscas')::int then
      raise exception '% dias: soma dos itens deve ser o total', soma;
    end if;
    -- as maiores do overview são as mesmas, na mesma ordem (até o corte de 30), quando há mais de 0
    if jsonb_array_length(o->'lacunas') > 0 and (g->'itens'->0->>'buscas') <> (o->'lacunas'->0->>'buscas') then
      raise exception '% dias: a maior lacuna difere do overview', soma;
    end if;
  end loop;
end $$;

-- não-membro recebe NULL
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000bb', true);
do $$ begin
  if panel_gaps(current_setting('t.ft')::uuid, 30) is not null then raise exception 'não-membro leu panel_gaps'; end if;
end $$;
reset role;

-- anônimo não executa
set local role anon;
do $$ declare ok boolean := false; begin
  begin perform panel_gaps(current_setting('t.ft')::uuid, 30); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'anon executou panel_gaps'; end if;
end $$;
reset role;
rollback;
\echo OK 08
