# Status — GeoLynq

## Última atualização
2026-10-01

## Fase atual
Fase 4 — widget construído e **validado contra o Supabase real** (2026-10-01): nível SQL
via MCP + chamadas HTTP reais com a chave publishable (ver "Validação da Fase 4 contra o
Supabase real"). Próximo: Fase 4.5 (hospedar o bundle).

## Por onde retomar
**Pausa em 2026-10-01** — usuário retoma depois. Fase 4 fechada e validada; nada em
andamento nem pendente de limpeza.

**Como trabalhar com o usuário (combinado nesta sessão):** ele não usa PC, só a VPS
Hostinger (`root@srv1887859`, EasyPanel). Para qualquer passo na VPS: primeiro explicar em
português simples o que será feito e por quê, depois entregar comandos prontos para colar
(um bloco por vez, com o resultado esperado), e pedir a saída de volta. Nada de jargão
solto nem de falar de fase futura sem contexto. O que roda no ambiente de nuvem da
sessão não alcança `*.supabase.co`; testes HTTP contra o Supabase são feitos pela VPS.

1. Fase 4.5 — hospedar o bundle (`apps/widget/dist/v1/embed.js`) em
   `widget.geolynq.personalsupport.tech` (Nginx estático no EasyPanel; Fase 6 do blueprint)
2. Fase 4.1 — site de amostra com o widget instalado (`demo.geolynq.personalsupport.tech`)
3. Decidir a questão de reimportação (revendedores duplicam — ver "Decisões em aberto")

## Concluído
- [x] Fase 0 — GitHub criado, subdomínio wildcard configurado
- [x] Fase 1 — Supabase `geolynq-prod` (sa-east-1, org `gknjufnkbourddiufozo`), schema v2 aplicado
  - O projeto antigo `geolynq` (ca-central-1, vazio, criado na região errada) foi **pausado
    em 2026-10-01** — libera 1 das 2 vagas ativas do free tier
- [x] Fase 2 — monorepo (`apps/admin` Next.js, `packages/shared` client + tipos das 10 tabelas)
- [x] Fase 3 — pipeline de importação `geolynq-import-catalogo` no n8n (22 nós, validado
  em 3 execuções reais). **Trigger é manual por design** (Manual Trigger): não existe
  "ativar" (`active: true`) para esse workflow; roda por clique ou `execute_workflow`.
  Código-fonte versionado em `docs/n8n-geolynq-import-catalogo.workflow.ts`
- [x] **Fase 4 — widget** (`apps/widget`)
  - Web Component `<geolynq-widget tenant="slug" color="#hex">` com Shadow DOM, vanilla
    TS, **sem supabase-js** (fetch direto no PostgREST). Bundle `dist/v1/embed.js`:
    **15 kB / 5,7 kB gzip**, 100% ASCII (acentos escapados no build — site de cliente em
    ISO-8859-1 não corrompe o texto)
  - Fluxo: busca de produto → CEP (ViaCEP + Nominatim) ou geolocalização do navegador →
    revendedores por distância (PostGIS) → WhatsApp / Ligar / Site / Como chegar
  - Telemetria desde o dia 1 (Blueprint Fase 5/10): `search` (inclusive sem resultado:
    `product_id` null = produto fora do catálogo; `results_count` 0 = sem cobertura) e
    `reseller_click`, sempre com `session_id` (uuid em localStorage, 30 dias; cai pra
    memória se o storage estiver bloqueado)
  - Segurança: todo texto do banco entra por `textContent` (sem innerHTML); `color`
    validada como hex; site do revendedor só aceita http(s); termo de busca sanitizado
    contra injeção na sintaxe de filtro do PostgREST; links externos com
    `noopener noreferrer`; só a chave pública no bundle
  - Testes: 11 unitários (vitest) + **22 verificações E2E em Chromium** (`npm run e2e -w
    @geolynq/widget`) com Supabase/ViaCEP/Nominatim simulados — cobre isolamento contra
    CSS hostil do site, página ISO-8859-1, eventos, tenant inexistente e API fora do ar.
    O E2E achou 0 falhas; o teste unitário achou 1 bug (distância < 100 m), já corrigido
  - Banco (migration `supabase/migrations/20261001000000_widget_rls_fix_and_rpcs.sql`):
    ver "Bug encontrado" abaixo + RPCs `widget_get_tenant` e `widget_nearest_resellers`

## Validação da Fase 4 contra o Supabase real (2026-10-01, geolynq-prod)
Feita via conector MCP do Supabase, como role `anon`, com as mesmas consultas que o
widget emite; escritas dentro de transação com `rollback` (confirmado depois: tenant
`demo` `active`, 0 eventos, nenhuma transação aberta).
- [x] Migration aplicada em produção: `is_active_tenant`, `widget_get_tenant`,
      `widget_nearest_resellers` existem; policies `public_read_*`/`public_insert_events`
      usam `is_active_tenant`
- [x] `widget_get_tenant('demo')` → 1 linha (5 campos); slug inexistente → 0; `tenants`
      direto → 0 linhas
- [x] Busca `whey` e SKU `wpi-900` → 1 produto; termo inexistente → 0
- [x] `widget_nearest_resellers` com coordenadas do centro de Santos → "Farmácia Saúde
      Total" a 0,179 km; sem coordenadas → `distance_km` null; produto/tenant inexistente → 0
- [x] Insert como `anon` dos 3 formatos de evento (search sem produto, search com
      produto, reseller_click) passa nos CHECK/FK
- [x] Negativos: tenant falso → `42501` (RLS); `event_type` inválido → `23514` (CHECK);
      UPDATE/DELETE como `anon` em events/products/resellers/addresses/coverage → 0
      linhas; `widget_events`, `leads`, `import_batches`, `commercial_opportunities`,
      `tenant_users` → 0 linhas lidas
- [x] Tenant `suspended` → `widget_get_tenant`, products, resellers, addresses e RPC de
      revendedores retornam 0 (o "desligar cliente" funciona)
- [x] Chave `sb_publishable_…` só no header `apikey`, sem `Authorization` (conforme a doc
      do Supabase; o E2E também checa isso)
- [x] **Smoke test HTTP real**, rodado pelo usuário na VPS Hostinger com `curl` e a chave
      `sb_publishable_…` só no header `apikey`: `widget_get_tenant('demo')` 200,
      busca `whey` 200 (WPI-900), `widget_nearest_resellers` 200 (Farmácia Saúde Total a
      0,179 km), insert em `widget_events` 201. A publishable é aceita pelo PostgREST;
      não precisa trocar pela anon legada
- [x] Linha de teste (`smoke-test-vps`) apagada pelo usuário no SQL Editor; `widget_events` = 0 linhas (conferido)
- Nota: E2E (22 verificações) só passa se o bundle for buildado com `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY`; sem elas dá timeout em `input#gl-term` (comentário no script)
- Nota: `execute_sql` do MCP deu timeout (60 s) em blocos `DO $$` com UPDATE/DELETE; o
  banco ficou limpo nos dois casos. Comandos simples com `begin; … rollback;` funcionam

## Bug encontrado e corrigido nesta sessão (Fase 1 → impactava a Fase 4)
As policies `public_read_*` e `public_insert_events` do schema v2 usavam
`exists (select 1 from tenants …)`. Como `tenants` tem RLS e só a policy `tenant_users_self`,
o subselect rodava como `anon` sem enxergar nenhum tenant → **o `anon` lia 0 linhas de
products/resellers/addresses/coverage e não conseguia gravar eventos**, mesmo com dados
ativos. O widget como desenhado (anon key + RLS) teria aberto vazio em produção.
Corrigido com `public.is_active_tenant()` (SECURITY DEFINER) nas 5 policies; `tenants`
continua fechada para `anon` (o widget só enxerga 5 campos públicos via RPC).
Validado como role `anon` no geolynq-prod: lê produtos/revendedores/endereços/cobertura,
`tenants` direto = 0 linhas, RPCs retornam, insert de evento passa.
**`schema-locator-v2.sql` em `docs/` ainda tem as policies antigas** — a fonte de verdade
do banco agora é schema + migration acima.

## Decisões em aberto (usuário decide)
- [ ] **Reimportação de revendedores duplica registros.** `products` tem
      `unique(tenant_id, sku)` (duplicata vira erro por linha), mas `resellers` não tem
      constraint única — reimportar a mesma planilha cria revendedores duplicados em
      silêncio (já visto no tenant `demo`: 2× "Farmácia Saúde Total", das execuções #97/#98).
      O registro anterior neste arquivo dizia que duplicata era sempre erro — vale só
      para produtos e cobertura. Opções: `unique(tenant_id, name)` + `upsert`, ou chave
      de negócio (nome + CEP). Resolver antes do 1º cliente real.
- [ ] Busca de produto é sensível a acento ("proteina" não acha "Proteína"). Resolver com
      `unaccent` + RPC de busca quando houver catálogo real.

## Pendente
- [ ] Fase 4.1 — site de amostra (em paralelo à Fase 5)
- [ ] Fase 5 — painel admin
- [ ] Limpar os dados de teste do tenant `demo` (revendedor duplicado) antes de mostrar a cliente
- [ ] Anti-spam em `widget_events` (qualquer um com a anon key pode inserir) — rate limit
      no gateway/Nginx quando o widget estiver público
- [ ] `public.spatial_ref_sys` (PostGIS) sem RLS — risco baixo (só sistemas de coordenadas),
      advisor marca como crítico; decidir entre `ENABLE ROW LEVEL SECURITY` ou mover PostGIS
      para o schema `extensions`
- [ ] `npm audit`: **`next` 16.3.4 do `apps/admin` com alerta crítico** (RCE em
      `next/og` ImageResponse; corrigido na 16.3.8) — subir patch antes do deploy do admin.
      Mais `brace-expansion` (high, transitivo) com fix disponível

## Decisões tomadas
- Widget fala com o PostgREST via `fetch`, sem supabase-js (bundle pequeno em site de terceiro)
- Banco de leitura pública do widget: tabelas continuam fechadas; `tenants` só via RPC de
  5 campos; busca de revendedores é RPC `SECURITY INVOKER` (RLS continua valendo)
- Chave no bundle: `sb_publishable_…` (feita para navegador); nunca service_role
- Sem geolynq-dev por enquanto — free tier só permite 2 projetos ativos
- Fase 3 segue no n8n atual (AWS free tier); migrar pra VPS Hostinger perto do prazo
- Migration da Fase 4 aplicada via `execute_sql`, não `apply_migration` (3 timeouts da
  ferramenta, sem lock no banco) → **não consta no histórico `supabase_migrations`**;
  arquivo no repo é idempotente

## Bloqueios
- [ ] **Egress do ambiente de nuvem bloqueia `*.supabase.co`** (gateway responde 403 ao
      CONNECT) — impede testar o widget contra o banco real a partir desta sessão. Liberar em
      Network access do ambiente (menu do ambiente na barra de título da sessão → Edit),
      ou testar localmente. As tools MCP do Supabase funcionam (caminho diferente).
- [ ] n8n atual roda em conta AWS free tier — acesso expira em 10/11/2026. Migrar o
      workflow pra VPS Hostinger com folga. Conferir a data exata no console AWS.
