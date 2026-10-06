# GeoLynq — instruções para o Claude

**Ao começar qualquer sessão: leia `status.md` primeiro.** É o checkpoint do projeto (onde paramos,
o que está no ar, pendências, armadilhas e referência rápida). Atualize-o ao concluir cada passo.

## O que é
Widget "Onde encontrar" (Web Component) que mostra ao consumidor o revendedor mais próximo de um produto
do fabricante, com telemetria de buscas e lacunas de cobertura. Multi-tenant, Supabase (PostGIS + RLS),
n8n para importação de catálogo, EasyPanel/Hostinger para hospedagem. Blueprint em `docs/blueprint.md`.

## Mapa do repositório
- `apps/widget` — Web Component (vanilla TS, Vite), Dockerfile e `nginx.conf` (serve widget e demo)
- `apps/demo` — site de amostra "Pódio" (gerador Node sem dependências; marca fictícia)
- `apps/admin` — painel do cliente (Next.js 16, `proxy.ts`; construído e testado, ver README; ainda não publicado)
- `packages/shared` — tipos e clients Supabase
- `supabase/migrations` — SQL idempotente aplicado à mão em produção
- `supabase/tests` — Postgres local (mini-Supabase) para testar migrations e relatórios sem tocar na produção
- `docs/` — blueprint, schema v2, workflow n8n versionado, planilha-modelo
- `docs/operacao-e-mercado.md` — fluxo ponta a ponta, onboarding de cliente, pesquisa de mercado, viabilidade e preço (hipóteses a validar)

## Como trabalhar com o usuário (Junior Lopes)
- Responda em **português simples e direto**; estruture, dê passos acionáveis, sem jargão solto.
- Ele **não usa PC**: só a VPS Hostinger e o EasyPanel. Para passos na VPS: explique o que e por quê,
  entregue comandos prontos (um bloco por vez, com o resultado esperado) e peça a saída de volta.
- Seja crítico, não bajulador: aponte riscos e o que **não** foi verificado. Nunca afirme que algo
  funciona sem ter visto funcionar; diga o que foi simulado e o que foi real.
- **Peça OK antes** de gravar no banco de produção ou de abrir PR. Não crie PR sem pedido explícito.
- **Nunca** peça nem cole segredos (service_role, URL/token do gatilho de deploy). A chave
  `sb_publishable_…` é pública e pode aparecer.

## Regras técnicas
- Desenvolva e dê push só na branch `claude/bold-cray-vbbdyb`. Push na branch **publica o widget
  sozinho** (webhook → EasyPanel): rode tipos, testes e E2E antes de empurrar.
- Testes: `npm run typecheck -w @geolynq/widget`, `npm test -w @geolynq/widget`; E2E exige build com
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e depois `npm run e2e -w @geolynq/widget`.
- Mudança de `nginx.conf`: teste com nginx real (o Dockerfile também roda `nginx -t`).
- Conector Supabase: `execute_sql` trava em `DELETE`/`DROP`/`DO $$`; use SELECT/INSERT/CREATE OR REPLACE e
  deixe DROP/DELETE para o usuário no SQL Editor. Confira o estado após qualquer timeout.
- O sandbox não alcança `*.supabase.co` nem os domínios do usuário; testes HTTP reais vêm da VPS dele.
