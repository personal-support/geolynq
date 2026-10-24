<!--
  GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
  Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
  total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
  Unauthorized copying, replication, redistribution or commercial use is prohibited.
-->
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
- `docs/golive-new-millen.md` — **roteiro do go-live da New Millen** (portões, pedido de dados, cadastro, importação, acessos, testes, plano de volta); `docs/seguranca-e-backup.md` — segurança e backup diário pela VPS

## Como trabalhar com o usuário (Junior Lopes)
- Responda em **português simples e direto**; estruture, dê passos acionáveis, sem jargão solto.
- Ele **não usa PC**: só a VPS Hostinger e o EasyPanel. Para passos na VPS: explique o que e por quê,
  entregue comandos prontos (um bloco por vez, com o resultado esperado) e peça a saída de volta.
- Seja crítico, não bajulador: aponte riscos e o que **não** foi verificado. Nunca afirme que algo
  funciona sem ter visto funcionar; diga o que foi simulado e o que foi real.
- **Peça OK antes** de gravar no banco de produção ou de abrir PR. Não crie PR sem pedido explícito.
- **Nunca** peça nem cole segredos (service_role, URL/token do gatilho de deploy). A chave
  `sb_publishable_…` é pública e pode aparecer.

## Autoria e direitos (decisão do usuário, 2026-10-13)
- O desenvolvedor é **Jucimar Lopes (Personal Support)**; cópia, réplica e comercialização são proibidas sem autorização escrita (ver `LICENSE`). Quem comercializa e emite nota é a DCM
  Marketing Digital — nos textos públicos de venda aparece a DCM, não a Personal Support. **Nunca** colocar CPF no repositório (é público).
- **Todo arquivo novo** que aceite comentário leva este cabeçalho (primeira coisa do arquivo; em HTML/XML, logo depois do `<!doctype>`/`<?xml?>`; nunca antes de `#!`):
  `GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.` / `Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,` /
  `total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.` / `Unauthorized copying, replication, redistribution or commercial use is prohibited.`
  (cópia pronta: o topo deste arquivo). Não vai em JSON, imagens, fontes, `.xlsx`/`.tsv` (quebraria leitura). O aviso **não pode alterar comportamento**: só comentário.

## Ao começar uma sessão (lições de 2026-10-15)
- Rode `git fetch` e compare as branches: o `status.md` mais novo pode estar em **outra branch** (em 2026-10-15 era a `claude/keen-johnson-c0x5hs`; a `bold-cray` estava 34 commits atrás).
  Depois leia `status.md` **e** `docs/plano-2026-10-15.md` antes de chamar qualquer ferramenta de infraestrutura.
- **EasyPanel: nunca** chame `listProjectsAndServices` (devolve as variáveis de ambiente, com chaves, de TODOS os projetos da conta). Use `getDockerContainers`/`inspectAppService`
  só em `personalsupport_saas`. Se uma ferramenta devolver segredo sem querer, não repita o valor em nenhum lugar e avise o usuário.

## Estado das branches (2026-10-24, noite)
- A `main` é a **branch de referência**: contém todo o código e a documentação atuais (inclui candidatos a revendedor, endurecimento de segurança, backup e o roteiro de go-live). Foi avançada por fast-forward a partir da `claude/tender-goodall-fmpm7m`.
  **Push na `main` NÃO publica nada no EasyPanel**, mas dispara o workflow `.github/workflows/deploy-widget.yml` quando muda `apps/widget/**`: os testes rodam e o passo "deploy" falha na hora porque o secret `EASYPANEL_WIDGET_DEPLOY_URL` não existe (3 execuções iguais em 24/10). É ruído, não é deploy. Não criar esse secret sem antes apontar o EasyPanel para a `main` (senão o webhook reconstrói a branch antiga).
- **Os serviços do EasyPanel ainda publicam das branches antigas** (widget/demo: `bold-cray`; painel/landing: `keen-johnson`; as duas estão em `d7f39dc`, igual ao que roda em produção). Mudanças só de banco, documentação ou scripts da VPS não precisam avançar essas branches.
  Trocar os serviços para a `main` é uma decisão à parte do usuário (muda o que dispara deploy).
- Cada serviço do EasyPanel com repositório privado tem a **própria chave SSH** (Gerar Chave SSH + GitHub → Settings → Deploy keys, só leitura).
- **Documentos privados** (briefing do Danilo, acordo Junior ↔ DCM, que têm divisão de resultado e custos) **não ficam no repositório**, que é público: foram entregues ao usuário como `.docx`. O contrato-padrão com o cliente (`docs/contrato-minuta-prestacao-servico.md`) e o roteiro (`docs/golive-new-millen.md`) ficam no repositório.

## Regras técnicas
- Desenvolva na branch que a sessão indicar e só avance as branches de deploy quando o usuário pedir publicação:
  push em `claude/bold-cray-vbbdyb` **publica o widget e o demo sozinho** (webhook → EasyPanel) e em
  `claude/keen-johnson-c0x5hs` vale para painel/landing (este com `deployAppService`/Implantar). Rode tipos, testes e
  E2E antes de empurrar. Depois de publicar, mantenha a `main` igual (fast-forward). **Nunca** `--force` na `main`.
- Testes: `npm run typecheck -w @geolynq/widget`, `npm test -w @geolynq/widget`; E2E exige build com
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e depois `npm run e2e -w @geolynq/widget`.
- Mudança de `nginx.conf`: teste com nginx real (o Dockerfile também roda `nginx -t`).
- Conector Supabase: `execute_sql` trava em `DELETE`/`DROP`/`DO $$`; use SELECT/INSERT/CREATE OR REPLACE e
  deixe DROP/DELETE para o usuário no SQL Editor. Confira o estado após qualquer timeout.
- O sandbox não alcança `*.supabase.co` nem os domínios do usuário; testes HTTP reais vêm da VPS dele.
