# Status — GeoLynq

## Última atualização
2026-10-23

## Estado em 2026-10-23 (retomar daqui)
- **Queda da VPS Hostinger** (`srv1887859`, 179.198.116.157): parou entre 15:18 e 15:52 (BRT)
  sem causa registrada; religada (`ct_start`) e reiniciada pelo usuário. Depois disso, no
  EasyPanel: Traefik, EasyPanel, n8n, geolynq_admin, geolynq_landing rodando (1/1).
  `geolynq_widget` ficou em 0/1 após a queda (motivo não identificado; logs do EasyPanel via
  MCP dão 400) e **voltou a 1/1 depois de Implantar pelo painel**. Conferido pelo usuário em
  23/10: `https://widget.geolynq.personalsupport.tech/healthz` responde OK e `/v1/embed.js`
  entrega o bundle (aponta para `geolynq-prod`, chave publishable). Redeploy pelo MCP é
  bloqueado pelo classificador de permissões ("Production Deploy"): usar o painel ou liberar a
  regra `mcp__EasyPanel__execute_destructive`. Backup semanal da VPS: último em 16/10.
- **Supabase `geolynq-prod`**: ficou Unhealthy (SQL com timeout, depois ECONNREFUSED);
  voltou depois de Restart project no painel. Postgres sobe limpo (sem crash).
- **n8n novo (VPS, https://n8n.personalsupport.tech, conector `n8n-novo`)**: credenciais
  criadas pelo usuário (`Supabase account` e `Google Service Account account`, conta de serviço
  `tiana-moda-afro@…`, que serve outros projetos: criar uma só do GeoLynq depois). Ligadas ao
  Import Catálogo v2 (id `8hXMMiLGaFTa8bw6`, 7 nós) e à gravação do Cadastro por CNPJ
  (`gTDZOrphnSqujiux`, nó provision_tenant) e aos 2 nós Supabase do Aviso de novo contato
  (`nhiCkFN9GAllOdsJ`). **Import v2 testado em 23/10** no tenant de teste
  `88a5496b-…` (Fábrica Teste): 33 linhas, 0 falhas, `partial` só pelo aviso de foto
  `http://` do TST-002 (esperado). O n8n antigo (AWS, conector `n8n`) tem os mesmos workflows.
- **Conta de serviço Google própria do GeoLynq: FEITA em 23/10.**
  `geolynq-importador@tiana-moda-afro.iam.gserviceaccount.com` (mesmo projeto Google Cloud, mas
  identidade separada da `tiana-moda-afro@…`). Leitora da planilha de teste "Fábrica Teste
  (dados hipotéticos)" e da pasta "GeoLynq — Testes (n8n)". A credencial "Google Service
  Account account" do n8n novo foi trocada para ela; **Import v2 reexecutado (execução 3):
  33 linhas, 0 falhas, mesmo resultado**. Para cada cliente real: compartilhar a planilha dele
  com esse e-mail (leitora basta).
  **Pendências de limpeza:** apagar o `.json` baixado da pasta Downloads e, no Google Cloud,
  a chave que foi criada em 23/10 para a conta antiga `tiana-moda-afro` (a mais recente).
- **Resend: FEITO em 24/10.** Credencial `Resend API key` (tipo Bearer Auth, chave só do
  GeoLynq, "Sending access" no domínio `personalsupport.tech`) ligada ao nó "Enviar e-mail
  (Resend)". Teste manual no workflow "Aviso de novo contato" (execução 4): e-mail aceito
  pelo Resend, contato de 13/10 marcado como avisado. Para o teste o destinatário ficou só
  `personalsupport@hotmail.com` e foi **revertido** para os dois originais (hotmail e
  danilo.coletivaweb@gmail.com). **O workflow segue inativo**: ativar (toggle no n8n) para o
  aviso rodar a cada 5 min. Não foi conferido se a caixa recebeu o e-mail (spam/domínio).
- **Contas**: Drive/n8n = `gestao.junior.lopes@gmail.com`; Vercel NÃO é usado no projeto
  (hospedagem é EasyPanel). Conector GitHub da sessão precisa de sessão nova após a troca de
  conta; git por linha de comando funciona.
- **Cuidado**: `listProjectsAndServices` do EasyPanel devolve as variáveis de ambiente de
  todos os serviços (chaves). Preferir `inspectAppService` só do serviço do GeoLynq.

## Fase atual
Fase 4 — widget construído e **validado contra o Supabase real** (2026-10-01): nível SQL
via MCP + chamadas HTTP reais com a chave publishable (ver "Validação da Fase 4 contra o
Supabase real"). **Fase 4.5 em andamento:** empacotamento pronto no repo
(`apps/widget/Dockerfile`, `apps/widget/nginx.conf`, `.dockerignore`); falta criar o app
no EasyPanel e apontar `widget.geolynq.personalsupport.tech`.

## Por onde retomar
**Pausa em 2026-10-01** — usuário retoma depois. Fase 4 fechada e validada; nada em
andamento nem pendente de limpeza.

**Como trabalhar com o usuário (combinado nesta sessão):** ele não usa PC, só a VPS
Hostinger (`root@srv1887859`, EasyPanel). Para qualquer passo na VPS: primeiro explicar em
português simples o que será feito e por quê, depois entregar comandos prontos para colar
(um bloco por vez, com o resultado esperado), e pedir a saída de volta. Nada de jargão
solto nem de falar de fase futura sem contexto. O que roda no ambiente de nuvem da
sessão não alcança `*.supabase.co`; testes HTTP contra o Supabase são feitos pela VPS.

1. Fase 4.5 — hospedar o bundle em `widget.geolynq.personalsupport.tech`.
   **Pronto no repo:** `apps/widget/Dockerfile` (build context = raiz do repo; multi-stage
   node:22-alpine → nginx:1.27-alpine), `apps/widget/nginx.conf` (só `/v1/*` e `/healthz`;
   cache 5 min; gzip; resto 404), `.dockerignore`. URL e chave publishable do
   `geolynq-prod` entram como `ARG` com default no Dockerfile (públicas por design; nunca
   service_role).
   **Falta (na VPS/EasyPanel, usuário):** criar o app apontando pro repo GitHub
   `personal-support/geolynq` (privado → EasyPanel precisa de acesso), branch
   `claude/bold-cray-vbbdyb` enquanto não houver merge na `main`, build por Dockerfile
   `apps/widget/Dockerfile` com contexto na raiz, porta 80, domínio
   `widget.geolynq.personalsupport.tech` (SSL Let's Encrypt automático). Depois validar:
   `curl -I https://widget.geolynq.personalsupport.tech/v1/embed.js` (200, JS, cache 300).
   **Não verificado:** a imagem nunca foi construída de verdade (sem daemon Docker no
   ambiente de nuvem) nem a sintaxe do nginx.conf; só os passos do build foram simulados
   (npm ci filtrado + build = bundle 15,09 kB OK). Os rótulos exatos da UI do EasyPanel
   também não foram conferidos (easypanel.io bloqueado no egress do ambiente).
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
