-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- ============================================================
-- Retenção de dados (Fase 2.2 do docs/plano-2026-10-15.md) — RASCUNHO, NÃO APLICADO EM PRODUÇÃO
--
-- Por quê: a landing (apps/landing/privacidade.html) promete guardar contatos por 30 dias e o widget descreve a medição anônima, mas nenhum job
-- apaga nada. O único contato em produção é de 2026-10-13 e completa 30 dias em 2026-11-12.
--
-- Valores (PROPOSTAS aguardando aprovação do usuário — plano, seção 2.1):
--   * leads          : apagar com mais de 30 dias (já prometido na landing)
--   * widget_events  : apagar registros individuais com mais de 12 meses (o painel só guarda histórico enquanto o registro existir)
--
-- Como aplicar (pelo SQL Editor do Supabase, NÃO pelo conector: o execute_sql do MCP trava em DO/DELETE):
--   1. Se o passo 1 abaixo der erro, ligue "pg_cron" em Database > Extensions e rode o resto.
--   2. Rode o arquivo inteiro. É idempotente: pode rodar de novo.
--   3. Teste sem apagar nada: `select public.retencao_simular();` (só conta).
--   4. Confira o job: `select jobname, schedule, active from cron.job where jobname = 'retencao-geolynq';`
--   5. Depois do 1º disparo (06:17 UTC): `select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;`
-- ============================================================

-- 1. Extensão (no Supabase o pg_cron vive em pg_catalog; o schema `cron` é criado por ela)
create extension if not exists pg_cron with schema pg_catalog;

-- 2. Simulação: quantas linhas seriam apagadas agora (não apaga nada)
create or replace function public.retencao_simular()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'leads_a_apagar', (select count(*) from public.leads where created_at < now() - interval '30 days'),
    'widget_events_a_apagar', (select count(*) from public.widget_events where created_at < now() - interval '12 months'),
    'leads_total', (select count(*) from public.leads),
    'widget_events_total', (select count(*) from public.widget_events),
    'em', now()
  );
$$;

-- 3. Limpeza de verdade. Devolve quantas linhas apagou (fica no log do pg_cron).
create or replace function public.retencao_limpar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n_leads int;
  n_eventos int;
begin
  delete from public.leads where created_at < now() - interval '30 days';
  get diagnostics n_leads = row_count;

  delete from public.widget_events where created_at < now() - interval '12 months';
  get diagnostics n_eventos = row_count;

  return jsonb_build_object('leads_apagados', n_leads, 'widget_events_apagados', n_eventos, 'em', now());
end;
$$;

-- Só o dono (postgres) e o pg_cron executam; nada de anon/authenticated chamando por /rest/v1/rpc.
revoke all on function public.retencao_simular() from public, anon, authenticated;
revoke all on function public.retencao_limpar() from public, anon, authenticated;

-- 4. Agenda: todo dia às 06:17 UTC (03:17 em Brasília). pg_cron 1.6 troca o job se o nome já existir.
select cron.schedule('retencao-geolynq', '17 6 * * *', $job$select public.retencao_limpar()$job$);
