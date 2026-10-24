-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- ============================================================
-- Endurecimento de segurança (24/10/2026)
--
-- 1) PAPEL "viewer" NÃO ESCREVIA NA TELA, MAS ESCREVIA PELA API: as políticas tenant_admin_all_* deixavam QUALQUER membro do cliente
--    (inclusive viewer) inserir, alterar e apagar revendedores, produtos, endereços, cobertura e importações do próprio cliente
--    com o token de login, direto na API REST. Agora: todos os membros LEEM (members_read_*), só owner/admin ESCREVEM (a política
--    antiga passa a exigir o papel). O painel não escreve nessas tabelas (a importação usa o service_role do n8n, que ignora RLS).
-- 2) PRIVILÉGIOS DE TABELA enxutos: TRUNCATE, REFERENCES e TRIGGER não passam por RLS e não devem existir para anon/authenticated;
--    anon só mantém o que o widget usa (ler catálogo/rede ativos e INSERT de eventos); authenticated não escreve em tenants,
--    tenant_users, commercial_opportunities nem widget_events.
-- 3) FUNÇÕES DE GATILHO não precisam ser executáveis por ninguém pela API.
-- 4) spatial_ref_sys (tabela do PostGIS no schema public): RLS ligado, só leitura.
-- 5) Tabelas só do service_role (candidate_optout, reseller_receita) ganham política explícita de negar tudo (documenta a intenção).
--
-- NÃO FEITO DE PROPÓSITO: mover o PostGIS para outro schema (as funções e colunas do widget dependem dele no public; risco de quebrar
-- a busca por distância para ganho pequeno) e "leaked password protection" (configuração do Auth; só no plano Pro).
--
-- Como aplicar: SQL Editor ou conector (só ALTER POLICY/CREATE POLICY/REVOKE; sem DROP). Idempotente.
-- Teste: supabase/tests/19_endurecimento_seguranca.sql
-- ============================================================

-- 1) leitura para todos os membros; escrita só para owner/admin ------------------------------------------------------------
create policy members_read_addresses on public.addresses for select to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.tenant_id = addresses.tenant_id and tu.user_id = auth.uid()));
create policy members_read_import_batches on public.import_batches for select to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.tenant_id = import_batches.tenant_id and tu.user_id = auth.uid()));
create policy members_read_coverage on public.product_reseller_coverage for select to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.tenant_id = product_reseller_coverage.tenant_id and tu.user_id = auth.uid()));
create policy members_read_products on public.products for select to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.tenant_id = products.tenant_id and tu.user_id = auth.uid()));
create policy members_read_resellers on public.resellers for select to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.tenant_id = resellers.tenant_id and tu.user_id = auth.uid()));

alter policy tenant_admin_all_addresses on public.addresses to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.tenant_id = addresses.tenant_id and tu.user_id = auth.uid() and tu.role in ('owner', 'admin')))
  with check (exists (select 1 from public.tenant_users tu where tu.tenant_id = addresses.tenant_id and tu.user_id = auth.uid() and tu.role in ('owner', 'admin')));
alter policy tenant_admin_all_import_batches on public.import_batches to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.tenant_id = import_batches.tenant_id and tu.user_id = auth.uid() and tu.role in ('owner', 'admin')))
  with check (exists (select 1 from public.tenant_users tu where tu.tenant_id = import_batches.tenant_id and tu.user_id = auth.uid() and tu.role in ('owner', 'admin')));
alter policy tenant_admin_all_coverage on public.product_reseller_coverage to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.tenant_id = product_reseller_coverage.tenant_id and tu.user_id = auth.uid() and tu.role in ('owner', 'admin')))
  with check (exists (select 1 from public.tenant_users tu where tu.tenant_id = product_reseller_coverage.tenant_id and tu.user_id = auth.uid() and tu.role in ('owner', 'admin')));
alter policy tenant_admin_all_products on public.products to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.tenant_id = products.tenant_id and tu.user_id = auth.uid() and tu.role in ('owner', 'admin')))
  with check (exists (select 1 from public.tenant_users tu where tu.tenant_id = products.tenant_id and tu.user_id = auth.uid() and tu.role in ('owner', 'admin')));
alter policy tenant_admin_all_resellers on public.resellers to authenticated
  using (exists (select 1 from public.tenant_users tu where tu.tenant_id = resellers.tenant_id and tu.user_id = auth.uid() and tu.role in ('owner', 'admin')))
  with check (exists (select 1 from public.tenant_users tu where tu.tenant_id = resellers.tenant_id and tu.user_id = auth.uid() and tu.role in ('owner', 'admin')));

-- 2) privilégios de tabela ----------------------------------------------------------------------------------------------
revoke truncate, references, trigger on
  public.addresses, public.commercial_opportunities, public.import_batches, public.product_reseller_coverage, public.products,
  public.resellers, public.tenant_users, public.tenants, public.widget_events
  from anon, authenticated;
revoke insert, update, delete on
  public.addresses, public.commercial_opportunities, public.import_batches, public.product_reseller_coverage, public.products,
  public.resellers, public.tenant_users, public.tenants
  from anon;
revoke update, delete on public.widget_events from anon;
revoke insert, update, delete on public.tenants, public.tenant_users, public.commercial_opportunities, public.widget_events from authenticated;

-- 3) funções de gatilho: ninguém as chama pela API ------------------------------------------------------------------------
revoke execute on function public.widget_events_limit() from public, anon, authenticated;
revoke execute on function public.panel_ai_readings_limit() from public, anon, authenticated;
revoke execute on function public.widget_events_sem_dado_pessoal() from public, anon, authenticated;

-- 5) tabelas só do service_role: política explícita de negar tudo ---------------------------------------------------------
create policy negar_tudo on public.candidate_optout for all to anon, authenticated using (false) with check (false);
create policy negar_tudo on public.reseller_receita for all to anon, authenticated using (false) with check (false);
