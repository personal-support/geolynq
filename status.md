# Status — GeoLynq

## Última atualização
2026-09-11

## Fase atual
Fase 3 — Pipeline de dados (n8n)

## Concluído
- [x] Fase 0 — GitHub criado, subdomínio wildcard configurado
- [x] Fase 1 — Supabase geolynq-prod provisionado (sa-east-1), schema aplicado (10 tabelas, RLS ativo)
- [x] Fase 2 — estrutura do projeto
  - Monorepo com npm workspaces (`apps/*`, `packages/*`)
  - `apps/admin`: Next.js 16 (App Router, TypeScript, Tailwind)
  - `packages/shared`: client Supabase (browser + service_role) e tipos TS de todas
    as 10 tabelas do schema v2, incluindo `commercial_opportunities` (Fase 10)
  - `.env.example` documentando as 4 variáveis (sem valores)
  - `docs/` com blueprint, schema v2 e doc da Fase 10 salvos no repo (fonte de
    verdade versionada, não depende mais de upload manual a cada sessão)
  - Build (`npm run build`) e typecheck (`tsc --noEmit`) validados sem erro
  - Varredura de segredos (`git diff --staged | grep KEY|SECRET|PASSWORD|TOKEN`)
    rodada antes do commit — sem chave real, só placeholders vazios
- [x] Fase 3 (parcial) — planilha-modelo + workflow n8n `geolynq-import-catalogo`
  - `docs/geolynq-catalogo-modelo.xlsx`: 3 abas (Produtos, Revendedores, Cobertura)
    com cabeçalhos + 1 linha de exemplo preenchida, prontas para virar a planilha
    real no Google Sheets
  - Workflow criado no n8n (rascunho, **não ativado**):
    https://automacoes-n8n.tvywld.easypanel.host/workflow/2ZPDQymNwVSENTIf
    (22 nós — leitura das 3 abas, validação linha a linha com erro específico
    por linha, geocodificação ViaCEP + Nominatim, gravação em products/
    resellers/addresses/product_reseller_coverage via Supabase node, resumo
    final em import_batches). Código-fonte do workflow versionado em
    `docs/n8n-geolynq-import-catalogo.workflow.ts`

## Pendente
- [x] Credencial Supabase (`Supabase account`) já criada no n8n e vinculada em
      4 dos 5 nós de gravação (Revendedores, Endereços, Cobertura, Import Batch)
- [x] Planilha real subida ao Google Drive e convertida para Google Sheets —
      "GeoLynq — Planilha Modelo Catálogo"
      (id `18rF_rlwS-wYHASnW9Tbd-FQI0Ko9s1lUHTTSe5T8s_g`) — os 3 nós "Ler Aba ..."
      já apontam pra ela (`documentId` mode `id`, não mais placeholder)
- [x] Tenant de teste criado no Supabase: `demo`
      (id `3596b3c6-8389-42af-b575-4bbdd69f2f2d`, status `active`) — já
      preenchido no nó "Parâmetros da Importação" (substituindo o placeholder)
- [ ] Único passo manual que falta antes de ativar `geolynq-import-catalogo`:
  Abrir o nó **"Criar Produtos no Supabase"** na UI do n8n e selecionar a
  credencial **"Supabase account"** no dropdown. A API do n8n não permite essa
  vinculação para esta sessão (`credential not found or not accessible` — a
  credencial pertence a outro escopo de permissão que a sessão MCP não
  enxerga), só a UI resolve. O mapeamento de colunas (fieldId) desse nó já
  estava corrompido de uma tentativa anterior e foi corrigido via API.
- [ ] Depois de vincular a credencial: rodar 1x manualmente (botão "Iniciar
      Importação"), conferir `import_batches` no Supabase antes de liberar
- [ ] Atenção no primeiro teste: os 3 nós "Ler Aba ..." usam a credencial
      Google `googleApi` em modo **service account** — se a leitura falhar por
      permissão, é porque a planilha (criada com a conta pessoal
      gestao.junior.lopes@gmail.com) precisa ser compartilhada com o e-mail
      da service account usada por essa credencial no n8n
- [ ] Fase 4 — widget (Web Component)

## Decisões tomadas nesta fase
- Primeiro projeto Supabase saiu na região errada (ca-central-1) — pausado, não apagado
- Sem geolynq-dev por enquanto — free tier da org só permite 2 projetos ativos
- Blueprint e schema atualizados para v2 nesta sessão (branding GeoLynq consolidado,
  subdomínio wildcard `*.geolynq.personalsupport.tech`, `widget_events.session_id`
  novo, tabela `commercial_opportunities` definida desde já — só usar na Fase 10)
- `packages/shared` cobre as 10 tabelas do schema v2 para não reabrir o pacote de
  tipos a cada fase nova
- Fase 3 segue rodando no n8n atual (AWS free tier) — sem migração antecipada pra
  VPS Hostinger. Migrar só perto do prazo de expiração (ver Bloqueios)

## Bloqueios
- [ ] n8n atual roda em conta AWS free tier — acesso expira em 10/11/2026 (prazo fixo do plano gratuito, não depende de crédito). Precisa migrar o workflow pra VPS Hostinger antes dessa data, com folga — Danilo pode fechar o 1º cliente nesse mesmo período.
  **Nota:** data registrada como 13/11/2026 na entrada anterior deste arquivo; usuário confirmou 10/11/2026 nesta sessão. Mantendo 10/11 como referência — vale conferir a data exata de expiração direto no console AWS antes de aproximar-se do prazo.
