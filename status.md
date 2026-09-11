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

## Pendente
- [ ] Fase 3 — planilha-modelo + workflow n8n `geolynq-import-catalogo`
      (leitura, geocodificação ViaCEP/Nominatim, gravação em products/resellers/
      addresses/product_reseller_coverage, log por linha em import_batches)

## Decisões tomadas nesta fase
- Primeiro projeto Supabase saiu na região errada (ca-central-1) — pausado, não apagado
- Sem geolynq-dev por enquanto — free tier da org só permite 2 projetos ativos
- Blueprint e schema atualizados para v2 nesta sessão (branding GeoLynq consolidado,
  subdomínio wildcard `*.geolynq.personalsupport.tech`, `widget_events.session_id`
  novo, tabela `commercial_opportunities` definida desde já — só usar na Fase 10)
- `packages/shared` cobre as 10 tabelas do schema v2 para não reabrir o pacote de
  tipos a cada fase nova

## Bloqueios
- [ ] n8n atual roda em conta AWS free tier — acesso expira em 13/11/2026 (prazo fixo do plano gratuito, não depende de crédito). Precisa migrar o workflow pra VPS Hostinger antes dessa data, com folga — Danilo pode fechar o 1º cliente nesse mesmo período.
