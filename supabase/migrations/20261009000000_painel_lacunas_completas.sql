-- ============================================================
-- Painel — lacunas completas (tela Lacunas, filtros e exportação CSV)
--
-- POR QUE: panel_overview devolve só as 30 maiores lacunas (a visão geral usa as 6 primeiras). A tela "Lacunas" somava essas 30 e
-- chamava de total: com muitas combinações produto x cidade, o total ficava MENOR que o real e a lista, truncada, sem aviso.
-- AGORA: panel_gaps devolve o total exato (mesma definição de "sem cobertura" do panel_overview) e até 500 combinações.
-- Mesma regra das demais funções do painel: SECURITY INVOKER (RLS vale), NULL para quem não é membro, sem EXECUTE para anon. Só leitura.
-- ============================================================

create or replace function public.panel_gaps(p_tenant_id uuid, p_days int default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
  v_from timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
  v_result jsonb;
begin
  if not public.is_tenant_member(p_tenant_id) then
    return null;
  end if;

  with cur as (
    select e.product_id, e.city, e.state, e.session_id
      from public.widget_events e
     where e.tenant_id = p_tenant_id
       and e.created_at >= v_from
       and e.event_type = 'search'
       and e.product_id is not null
       and coalesce(e.results_count, 0) = 0
  ),
  g as (
    select p.id as product_id, p.sku, p.name as produto,
           coalesce(nullif(btrim(c.city), ''), 'Local não identificado') as cidade,
           nullif(btrim(c.state), '') as uf,
           count(*) as buscas,
           count(distinct c.session_id) as sessoes
      from cur c join public.products p on p.id = c.product_id
     group by p.id, p.sku, p.name, 4, 5
  )
  select jsonb_build_object(
    'dias', v_days,
    'total_buscas', coalesce((select sum(buscas) from g), 0),
    'combinacoes', (select count(*) from g),
    'itens', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select product_id, sku, produto, cidade, uf, buscas, sessoes
          from g order by buscas desc, cidade, produto limit 500) x), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.panel_gaps(uuid, int) from public, anon;
grant execute on function public.panel_gaps(uuid, int) to authenticated, service_role;
