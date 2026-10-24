-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- ============================================================
-- Privacidade do texto digitado na busca (widget_events.query_text) — segunda barreira, no banco
--
-- Por quê: o widget grava o que o visitante digita no campo de busca. O widget v2 já descarta termo que pareça dado pessoal
-- (termForTelemetry), mas (a) o v1 não descartava e (b) qualquer pessoa com a chave pública pode inserir texto direto na API.
-- Em 2026-10-24 havia 2 eventos reais com CEP completo digitado ("02636-060"), o que contradiz o aviso de privacidade (só 5 dígitos do CEP).
--
-- O que faz: antes de gravar, se query_text tiver "@" (e-mail) ou uma sequência de 6+ dígitos com separadores (telefone, CPF, CEP, cartão),
-- o texto vira NULL. O evento continua sendo contado (a busca existiu); só o texto é descartado.
-- A regra é a mesma do widget (apps/widget/src/util.ts, termForTelemetry). Nomes de pessoas não dá para detectar: limite conhecido.
--
-- Como aplicar: SQL Editor ou conector (CREATE OR REPLACE; sem DROP). Idempotente. Teste local: supabase/tests/15_query_text_privacidade.sql.
-- Desfazer: drop trigger widget_events_sem_dado_pessoal on public.widget_events;
-- ============================================================
create or replace function public.widget_events_sem_dado_pessoal()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.query_text is not null
     and (new.query_text ~ '@' or new.query_text ~ '[0-9][0-9 .()/-]{5,}[0-9]') then
    new.query_text := null;
  end if;
  return new;
end;
$$;

create or replace trigger widget_events_sem_dado_pessoal
  before insert on public.widget_events
  for each row execute function public.widget_events_sem_dado_pessoal();
