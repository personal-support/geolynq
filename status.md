# Status — GeoLynq

## Última atualização
2026-09-11

## Fase atual
Fase 3 concluída e validada (pipeline de importação) — decisão do usuário
sobre quando ativar e seguir pra Fase 4 (widget)

## Por onde retomar
1. Decidir se ativa o workflow `geolynq-import-catalogo` no n8n (`active: true`)
   e se quer trocar `create` por `upsert` nos nós Supabase (ver "Decisões em
   aberto" abaixo)
2. Se seguir, começar a Fase 4 — widget (Web Component)

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
- [x] **Fase 3 — pipeline de importação de catálogo, validado ponta a ponta**
  - `docs/geolynq-catalogo-modelo.xlsx`: 3 abas (Produtos, Revendedores, Cobertura)
    com cabeçalhos + 1 linha de exemplo preenchida
  - Planilha real subida ao Google Drive e convertida pra Google Sheets:
    "GeoLynq — Planilha Modelo Catálogo"
    (id `18rF_rlwS-wYHASnW9Tbd-FQI0Ko9s1lUHTTSe5T8s_g`), compartilhada com a
    service account do n8n
  - Workflow `geolynq-import-catalogo` criado no n8n (**rascunho, não
    ativado** — funcional e testado):
    https://automacoes-n8n.tvywld.easypanel.host/workflow/2ZPDQymNwVSENTIf
    (22 nós — leitura das 3 abas, validação linha a linha com erro específico
    por linha, geocodificação ViaCEP + Nominatim, gravação em products/
    resellers/addresses/product_reseller_coverage via Supabase node, resumo
    em import_batches). Código-fonte versionado em
    `docs/n8n-geolynq-import-catalogo.workflow.ts`
  - Credencial Supabase (`Supabase account`) configurada e vinculada nos 5
    nós de gravação; tenant de teste `demo` criado
    (id `3596b3c6-8389-42af-b575-4bbdd69f2f2d`)
  - **3 execuções reais de teste (#97, #98, #99)** encontraram e validaram a
    correção de 2 bugs estruturais no workflow:
    1. `import_batches` nunca era gravado no caminho 100% sem erro (nó de
       merge era pulado quando todas as 7 entradas de erro ficavam vazias)
    2. Falha total numa aba (ex: todas as linhas de Produtos com SKU
       duplicado) travava silenciosamente o processamento das abas
       seguintes (Revendedores, Cobertura), sem avisar no resumo
    - Ambos corrigidos com `alwaysOutputData: true` nos nós de gravação que
      funcionam como "porta" da cadeia (Criar Produtos, Criar Revendedores,
      Criar Endereços, e o merge de erros)
    - Execução #99 confirmou o comportamento correto após as correções:
      erro específico por linha, processamento das abas seguintes mesmo com
      falha anterior, resumo completo e preciso em `import_batches`

## Decisões em aberto (usuário decide ao retomar)
- [ ] Ativar o workflow (`active: true`) — hoje é rascunho testado, funcional
- [ ] Trocar `create` por `upsert` nos nós Supabase se reimportar a mesma
      planilha (atualizando linhas existentes) for um fluxo esperado — hoje
      duplicata é tratada como erro por linha, por design (blueprint Fase 3,
      item 4)

## Pendente
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
  **Nota:** data registrada como 13/11/2026 na entrada anterior deste arquivo; usuário confirmou 10/11/2026 numa sessão anterior. Mantendo 10/11 como referência — vale conferir a data exata de expiração direto no console AWS antes de aproximar-se do prazo.
