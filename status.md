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
- [x] Credencial Supabase (`Supabase account`) — host corrigido pelo usuário
      (era `.../rest/v1/` no campo Host, causando 403; corrigido pra só
      `https://vshlsisnuaugeceafipt.supabase.co`) e vinculada manualmente
      no nó "Criar Produtos no Supabase" que faltava. Todos os 5 nós de
      gravação Supabase estão com credencial válida agora.
- [x] Planilha real subida ao Google Drive e convertida para Google Sheets —
      "GeoLynq — Planilha Modelo Catálogo"
      (id `18rF_rlwS-wYHASnW9Tbd-FQI0Ko9s1lUHTTSe5T8s_g`) — os 3 nós "Ler Aba ..."
      apontam pra ela. Usuário compartilhou o arquivo com o e-mail da service
      account do n8n (corrigiu erro 403 PERMISSION_DENIED na leitura)
- [x] Tenant de teste criado no Supabase: `demo`
      (id `3596b3c6-8389-42af-b575-4bbdd69f2f2d`, status `active`)
- [x] **Primeiro teste ponta a ponta rodado com sucesso (execução #97):**
      products=1, resellers=1, addresses=1 (com lat/long reais via Nominatim,
      CEP validado via ViaCEP), product_reseller_coverage=1
- [x] **Bug encontrado e corrigido:** `import_batches` ficava em 0 mesmo com a
      execução toda "success". Causa: o nó "Consolidar Erros de Validação e
      Gravação" (merge, 7 entradas — uma por ramo de erro/linha inválida) fica
      com TODAS as entradas vazias quando não há nenhum erro; o n8n pula nós
      cujas entradas chegam todas vazias, então "Montar Resumo da Importação"
      e "Registrar Lote de Importação" nunca executavam no caminho 100%
      bem-sucedido — exatamente o caso mais comum. Corrigido com
      `alwaysOutputData: true` no nó de merge, forçando-o a sempre rodar
      (mesmo com item sintético vazio) para garantir que todo run grave uma
      linha em `import_batches`, com ou sem erro. Fonte atualizada em
      `docs/n8n-geolynq-import-catalogo.workflow.ts`.
- [ ] **Re-rodar o teste** pra confirmar que `import_batches` grava a linha
      agora (a correção ainda não foi validada com uma nova execução)
- [ ] Risco estrutural conhecido, não testado ainda: o pipeline é uma cadeia
      única (Produtos → Revendedores → Cobertura → Resumo). Se uma aba inteira
      vier com 0 linhas válidas (ex: todas as linhas de Produtos inválidas),
      as etapas seguintes (Revendedores, Cobertura, e o próprio resumo) podem
      não executar — mesma classe de bug do item acima, só que em outros elos
      da cadeia. Só valida com um teste real usando dados com erro proposital
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
