-- ============================================================
-- Leitura do período por IA — histórico guardado por cliente
--
-- POR QUE: o painel gera, sob demanda, um texto curto (resumo, destaques, ações) a partir dos números do período. Guardamos cada leitura
-- para (1) mostrar a última sem gastar de novo, (2) ter histórico e (3) controlar custo. Os NÚMEROS nunca vêm da IA: o painel confere
-- cada número escrito contra os dados antes de gravar (ver apps/admin/lib/ia.ts).
--
-- SEGURANÇA: RLS por cliente (membro lê e grava só o do próprio cliente; anon não acessa). Um gatilho limita o custo: no máximo 1 leitura
-- a cada 2 minutos e 30 por dia por cliente. Idempotente.
-- ============================================================

create table if not exists public.panel_ai_readings (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  dias        int  not null check (dias between 1 and 365),
  conteudo    jsonb not null,
  modelo      text not null check (char_length(modelo) <= 80),
  tokens_in   int,
  tokens_out  int,
  criado_por  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  constraint panel_ai_readings_conteudo_ck check (jsonb_typeof(conteudo) = 'object' and pg_column_size(conteudo) <= 20000)
);

create index if not exists panel_ai_readings_tenant_idx on public.panel_ai_readings (tenant_id, dias, created_at desc);

alter table public.panel_ai_readings enable row level security;

drop policy if exists panel_ai_readings_select on public.panel_ai_readings;
create policy panel_ai_readings_select on public.panel_ai_readings for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists panel_ai_readings_insert on public.panel_ai_readings;
create policy panel_ai_readings_insert on public.panel_ai_readings for insert to authenticated
  with check (public.is_tenant_member(tenant_id));

revoke all on public.panel_ai_readings from public, anon;
grant select, insert on public.panel_ai_readings to authenticated;

create or replace function public.panel_ai_readings_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.panel_ai_readings r where r.tenant_id = new.tenant_id and r.created_at > now() - interval '2 minutes') then
    raise exception 'limite_leitura_ia: aguarde alguns minutos' using errcode = 'P0001';
  end if;
  if (select count(*) from public.panel_ai_readings r where r.tenant_id = new.tenant_id and r.created_at > now() - interval '24 hours') >= 30 then
    raise exception 'limite_leitura_ia: limite diário' using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists panel_ai_readings_limit_trg on public.panel_ai_readings;
create trigger panel_ai_readings_limit_trg before insert on public.panel_ai_readings
  for each row execute function public.panel_ai_readings_limit();
