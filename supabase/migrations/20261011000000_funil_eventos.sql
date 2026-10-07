-- ============================================================
-- Eventos de funil do widget v2 + relatório do funil no painel
--
-- POR QUE: até aqui só gravávamos "busca com produto/local" e "clique em revendedor". O fabricante também precisa ver o que vem
-- ANTES: o que as pessoas digitam, qual produto escolhem, se usam a lista de revendedores e com quais filtros. Sem isso não dá
-- para dizer onde as pessoas desistem.
--
-- NOVOS event_type (todos anônimos; nenhum leva coordenada, CEP ou bairro):
--   catalog_search  texto digitado no campo de busca que ACHOU produtos (query_text = termo, results_count = nº de produtos)
--   product_select  clicou em "Onde encontrar" num produto (product_id)
--   list_open       abriu a "Lista de revendedores" (product_id se veio de um produto)
--   list_search     aplicou filtros na lista (state/city/product_id; results_count = revendedores achados)
-- Os relatórios antigos filtram por 'search' e 'reseller_click' e NÃO mudam. (Texto digitado sem produto continua sendo
-- 'search' com product_id nulo = "procuraram e você não tem".)
--
-- panel_funnel(tenant, dias): SECURITY INVOKER (RLS vale), NULL para quem não é membro, sem EXECUTE para anon. Só leitura.
-- Unidade = visita (session_id distinto; a visita vive só na memória da página). Idempotente.
-- Aplicar em 2 etapas se o conector der timeout: (1) a constraint; (2) a função.
-- ============================================================

-- Etapa 1 — aceitar os novos tipos
alter table public.widget_events drop constraint if exists widget_events_event_type_check;
alter table public.widget_events
  add constraint widget_events_event_type_check
  check (event_type in ('search', 'reseller_click', 'catalog_search', 'product_select', 'list_open', 'list_search'));

-- Etapa 2 — relatório
-- Cada degrau do "caminho do produto" está contido no anterior (por construção), então os números só podem cair:
--   escolheram = visitas com product_select OU com busca já feita para um produto (página de produto do site do cliente)
--   localizacao = visitas que informaram onde estão e buscaram revendedor para um produto (evento 'search' com product_id)
--   com_revendedor = dessas, as que tinham ao menos um revendedor físico no raio
--   clicaram = dessas, as que clicaram em um revendedor
create or replace function public.panel_funnel(p_tenant_id uuid, p_days int default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
  v_out jsonb;
begin
  if not public.is_tenant_member(p_tenant_id) then
    return null;
  end if;

  with cur as (
    select e.session_id, e.event_type, e.product_id, e.results_count, e.query_text
      from public.widget_events e
     where e.tenant_id = p_tenant_id
       and e.session_id is not null
       and e.created_at >= now() - make_interval(days => v_days)
  ),
  inter     as (select distinct session_id from cur),
  typed     as (select distinct session_id from cur where event_type = 'catalog_search' or (event_type = 'search' and product_id is null)),
  prod      as (select distinct session_id from cur where event_type = 'product_select' or (event_type = 'search' and product_id is not null)),
  loc       as (select distinct session_id from cur where event_type = 'search' and product_id is not null),
  cov       as (select distinct session_id from cur where event_type = 'search' and product_id is not null and coalesce(results_count, 0) > 0),
  click_any as (select distinct session_id from cur where event_type = 'reseller_click'),
  lst       as (select distinct session_id from cur where event_type = 'list_open'),
  lst_f     as (select distinct session_id from cur where event_type = 'list_search' and session_id in (select session_id from lst)),
  terms     as (
    select lower(query_text) as termo,
           count(*)::int as buscas,
           bool_or(event_type = 'catalog_search') as achou
      from cur
     where (event_type = 'catalog_search' or (event_type = 'search' and product_id is null))
       and nullif(btrim(query_text), '') is not null
     group by 1
     order by 2 desc, 1
     limit 10
  )
  select jsonb_build_object(
    'dias', v_days,
    'visitas', (select count(*) from inter),
    'digitaram', (select count(*) from typed),
    'visitas_com_clique', (select count(*) from click_any),
    'produto', jsonb_build_object(
      'escolheram', (select count(*) from prod),
      'localizacao', (select count(*) from loc),
      'com_revendedor', (select count(*) from cov),
      'clicaram', (select count(*) from cov where session_id in (select session_id from click_any))
    ),
    'lista', jsonb_build_object(
      'abriram', (select count(*) from lst),
      'filtraram', (select count(*) from lst_f),
      'clicaram', (select count(*) from lst where session_id in (select session_id from click_any))
    ),
    'termos', coalesce((select jsonb_agg(to_jsonb(t) order by t.buscas desc, t.termo) from terms t), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.panel_funnel(uuid, int) from public, anon;
grant execute on function public.panel_funnel(uuid, int) to authenticated, service_role;
