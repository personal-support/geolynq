-- ============================================================
-- Painel — "últimas buscas" (ao vivo) e desempenho por revendedor
--
-- POR QUE: na apresentação, o cliente busca no site e, segundos depois, vê a busca no painel; e a equipe comercial precisa saber
-- QUEM da rede gera contato (e quem está parado). Os dados já existem em widget_events (reseller_id nos cliques).
-- Como as demais funções do painel: SECURITY INVOKER (o RLS continua valendo), devolvem NULL para quem não é membro do cliente,
-- sem EXECUTE para anon. Só leitura. Idempotente.
-- ============================================================

create or replace function public.panel_recent(p_tenant_id uuid, p_limit int default 12)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if not public.is_tenant_member(p_tenant_id) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.quando desc)
      from (
        select e.created_at as quando,
               e.event_type as tipo,
               left(e.query_text, 60) as termo,
               p.name as produto,
               e.city as cidade,
               e.state as uf,
               e.results_count as resultado,
               e.online_count as online,
               e.action as acao,
               r.name as revendedor
          from public.widget_events e
          left join public.products p on p.id = e.product_id
          left join public.resellers r on r.id = e.reseller_id
         where e.tenant_id = p_tenant_id
         order by e.created_at desc
         limit least(greatest(coalesce(p_limit, 12), 1), 50)
      ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.panel_resellers(p_tenant_id uuid, p_days int default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
begin
  if not public.is_tenant_member(p_tenant_id) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.contatos desc, x.nome)
      from (
        select r.id,
               r.name as nome,
               r.type as tipo,
               a.city as cidade,
               a.state as uf,
               count(e.id)::int                                    as contatos,
               (count(e.id) filter (where e.action = 'whatsapp'))::int  as whatsapp,
               (count(e.id) filter (where e.action = 'call'))::int      as ligar,
               (count(e.id) filter (where e.action = 'directions'))::int as rota,
               (count(e.id) filter (where e.action = 'site'))::int      as site,
               max(e.created_at)                                   as ultimo_contato
          from public.resellers r
          left join public.addresses a on a.reseller_id = r.id
          left join public.widget_events e
                 on e.reseller_id = r.id
                and e.tenant_id = r.tenant_id
                and e.event_type = 'reseller_click'
                and e.created_at >= now() - make_interval(days => v_days)
         where r.tenant_id = p_tenant_id and r.status = 'active'
         group by r.id, r.name, r.type, a.city, a.state
      ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.panel_recent(uuid, int)    from public, anon;
revoke all on function public.panel_resellers(uuid, int) from public, anon;
grant execute on function public.panel_recent(uuid, int)    to authenticated, service_role;
grant execute on function public.panel_resellers(uuid, int) to authenticated, service_role;
