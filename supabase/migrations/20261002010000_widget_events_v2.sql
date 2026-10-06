-- ============================================================
-- B1 — Telemetria v2 (widget_events)
--
-- POR QUE: os relatórios da plataforma (cenário atual, lacunas, "como chegar") precisam de dado que a v1 não guardava, e
-- dado de uso NÃO se reconstrói depois. Problemas da v1: cidade/UF nulas quando a localização vem do GPS; sem coordenada
-- aproximada (impossível mapa de calor); sem bairro; sem distância ao revendedor mais próximo; sem separar físico de online;
-- sem saber qual ação o usuário escolheu (WhatsApp, ligar, site, rota).
--
-- PRIVACIDADE: nada de CEP completo (só os 5 primeiros dígitos) nem coordenada precisa (arredondada a 2 casas, ~1 km).
--
-- COMPATIBILIDADE: 100% aditivo. Colunas novas são opcionais; o widget já publicado (v1) continua inserindo normalmente e as
-- linhas dele ficam com telemetry_v = 1. `results_count` segue existindo (a partir da v2 = nº de revendedores FÍSICOS no raio).
--
-- A tabela aceita INSERT anônimo (widget); por isso os limites de tamanho/formato abaixo são parte da proteção.
-- Idempotente. Aplicar em 2 etapas (colunas; constraints) por causa dos timeouts do conector MCP.
-- ============================================================

-- Etapa 1 — colunas
alter table public.widget_events
  add column if not exists telemetry_v    smallint not null default 1,
  add column if not exists neighborhood   text,
  add column if not exists lat_approx     double precision,
  add column if not exists lng_approx     double precision,
  add column if not exists cep5           text,
  add column if not exists location_source text,
  add column if not exists nearest_km     double precision,
  add column if not exists physical_count integer,
  add column if not exists online_count   integer,
  add column if not exists action         text,
  add column if not exists distance_km    double precision;

-- Etapa 2 — limites de formato e tamanho
alter table public.widget_events
  drop constraint if exists widget_events_v2_check,
  add constraint widget_events_v2_check check (
        telemetry_v between 1 and 100
    and (location_source is null or location_source in ('cep', 'gps', 'none'))
    and (action is null or action in ('whatsapp', 'call', 'site', 'directions'))
    and (cep5 is null or cep5 ~ '^[0-9]{5}$')
    and (lat_approx is null or lat_approx between -90 and 90)
    and (lng_approx is null or lng_approx between -180 and 180)
    and (nearest_km is null or nearest_km between 0 and 20000)
    and (distance_km is null or distance_km between 0 and 20000)
    and (physical_count is null or physical_count between 0 and 1000)
    and (online_count is null or online_count between 0 and 1000)
    and (neighborhood is null or char_length(neighborhood) <= 120)
    and (query_text is null or char_length(query_text) <= 200)
    and (city is null or char_length(city) <= 120)
    and (state is null or char_length(state) <= 60)
    and (session_id is null or char_length(session_id) <= 64)
  );
