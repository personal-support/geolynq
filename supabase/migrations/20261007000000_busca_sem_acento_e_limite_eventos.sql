-- ============================================================
-- Precisão dos dados reais — (3) busca de produto sem acento e (4) limite de eventos do widget
--
-- (3) POR QUE: o widget buscava com `ilike`, que é sensível a acento: "proteina" não achava "Proteína". Pior: a busca
--     sem resultado era gravada como "fora do catálogo", e o painel mostrava uma lacuna de catálogo que não existe.
--     AGORA: RPC `widget_search_products` compara sem acento e sem diferença de maiúscula/minúscula.
--     Sem extensão (não depende de `unaccent`): usa `translate` com a lista de letras do português.
--     SECURITY INVOKER: a RLS pública (só produto ativo de tenant ativo) continua valendo, igual à consulta antiga.
--
-- (4) POR QUE: `widget_events` aceita INSERT anônimo (é o widget). Sem limite, um robô infla as buscas e estraga o painel.
--     AGORA: trigger BEFORE INSERT que, para `anon`/`authenticated`:
--       - força `created_at = now()` (o cliente não escolhe a data do evento);
--       - descarta em silêncio (sem erro, o robô não recebe sinal) o evento que passar de:
--           20 eventos/minuto e 200/hora por session_id, e 600 eventos/minuto por cliente (tenant).
--     `service_role`/`postgres` (importações, simulados, manutenção) não são limitados.
--     LIMITE CONHECIDO: o robô que troca de `session_id` a cada evento só é barrado pelo teto do cliente (600/min); um
--     robô que fique abaixo disso ainda passa. Barrar por IP exige guardar o IP (LGPD) ou um WAF na frente; fica para depois.
--     Os limites são hipóteses (um acesso real gera 2–10 eventos); ajuste na função com dados reais.
--
-- Idempotente. Aplicável em partes (conector MCP tem limite de 60 s).
-- ============================================================

-- ---------- (3) busca sem acento ----------
create or replace function public.norm_busca(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select translate(lower(coalesce(p_text, '')),
                   'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
                   'aaaaaaeeeeiiiiooooouuuucnyy');
$$;

create or replace function public.widget_search_products(
  p_tenant_id uuid,
  p_term text,
  p_limit int default 8
)
returns table (id uuid, sku text, name text, category text)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with q as (
    select replace(replace(replace(public.norm_busca(left(btrim(coalesce(p_term, '')), 80)), '\', '\\'), '%', '\%'), '_', '\_') as t
  )
  select p.id, p.sku, p.name, p.category
  from public.products p, q
  where p.tenant_id = p_tenant_id
    and q.t <> ''
    and (public.norm_busca(p.name) like '%' || q.t || '%' or public.norm_busca(p.sku) like '%' || q.t || '%')
  order by p.name asc
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all on function public.norm_busca(text) from public;
grant execute on function public.norm_busca(text) to anon, authenticated, service_role;
revoke all on function public.widget_search_products(uuid, text, int) from public;
grant execute on function public.widget_search_products(uuid, text, int) to anon, authenticated, service_role;

-- ---------- (4) limite de eventos ----------
-- SECURITY DEFINER porque o `anon` não tem SELECT em widget_events (a contagem precisa enxergar as linhas). Dentro dela
-- `current_user` vira o dono; por isso o papel de quem chamou vem de `current_setting('role')`, que o PostgREST ajusta
-- por requisição (SET LOCAL ROLE) e que não muda dentro de SECURITY DEFINER. Nada de contagem exposto ao público.
create or replace function public.widget_events_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_sessao_min   constant int := 20;
  c_sessao_hora  constant int := 200;
  c_tenant_min   constant int := 600;
  n int;
begin
  if coalesce(current_setting('role', true), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  new.created_at := now();

  select count(*) into n from public.widget_events e
   where e.tenant_id = new.tenant_id and e.created_at >= now() - interval '1 minute';
  if n >= c_tenant_min then return null; end if;

  if new.session_id is not null then
    select count(*) into n from public.widget_events e
     where e.tenant_id = new.tenant_id and e.session_id = new.session_id and e.created_at >= now() - interval '1 hour';
    if n >= c_sessao_hora then return null; end if;

    select count(*) into n from public.widget_events e
     where e.tenant_id = new.tenant_id and e.session_id = new.session_id and e.created_at >= now() - interval '1 minute';
    if n >= c_sessao_min then return null; end if;
  end if;

  return new;
end;
$$;

revoke all on function public.widget_events_limit() from public;

-- `create or replace trigger` (PG 14+) em vez de DROP + CREATE: o conector MCP trava em DROP.
create or replace trigger widget_events_limit
  before insert on public.widget_events
  for each row execute function public.widget_events_limit();
