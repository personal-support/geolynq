-- ============================================================
-- Landing page — endurece a tabela `leads` (formulário público de contato)
--
-- Situação encontrada em produção (2026-10-13, só leitura): RLS ligado; policy `public_insert_leads` (INSERT, with check true);
-- 0 linhas; mas `anon` e `authenticated` têm TODOS os privilégios de tabela (SELECT/UPDATE/DELETE/TRUNCATE...). Sem policy
-- para SELECT/UPDATE/DELETE o RLS já barra, porém: (a) TRUNCATE não passa por RLS; (b) o INSERT público podia gravar
-- `status='converted'`, `source` arbitrário e textos sem limite.
--
-- O que esta migration faz (aditiva e idempotente; nenhum DROP de tabela/coluna):
--   1. tira todos os privilégios de anon/authenticated e devolve só INSERT nas 5 colunas que o formulário preenche
--      (id, source, status e created_at ficam com o padrão do banco);
--   2. limites de tamanho e formato mínimo de e-mail (CHECK, NOT VALID para não depender de linhas antigas);
--   3. policy de INSERT passa a exigir os valores padrão de status e source;
--   4. coluna `notified_at` para o aviso por n8n (a "fila" de quem ainda não foi avisado).
-- Leitura dos contatos: só pelo Table Editor do Supabase ou service_role (n8n). Sem painel, por design.
-- ============================================================

revoke all on table public.leads from anon, authenticated;
grant insert (name, company, email, phone, message) on table public.leads to anon;

alter table public.leads add column if not exists notified_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.leads'::regclass and conname = 'leads_tamanhos') then
    alter table public.leads add constraint leads_tamanhos check (
      char_length(name) between 2 and 120
      and (company is null or char_length(company) <= 120)
      and char_length(email) between 5 and 160
      and (phone is null or char_length(phone) <= 30)
      and (message is null or char_length(message) <= 1000)
      and char_length(source) <= 40
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.leads'::regclass and conname = 'leads_email_formato') then
    alter table public.leads add constraint leads_email_formato check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$') not valid;
  end if;
end $$;

drop policy if exists "public_insert_leads" on public.leads;
create policy "public_insert_leads" on public.leads
  for insert to anon
  with check (status = 'new' and source = 'landing_page');

create index if not exists leads_nao_avisados_idx on public.leads (created_at) where notified_at is null;
