<!--
  GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
  Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
  total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
  Unauthorized copying, replication, redistribution or commercial use is prohibited.
-->
# @geolynq/admin — painel do cliente (Fase 5)

Next.js 16 (App Router, `proxy.ts`), Tailwind 4, Supabase Auth + RLS. Em português (pt-BR).
O painel **não usa `service_role`**: o usuário logado lê pelo papel `authenticated` e o banco (RLS) isola cada cliente.

## Telas
| Rota | O que mostra |
|---|---|
| `/login` | e-mail e senha (Supabase Auth). Só quem está em `tenant_users` enxerga dados |
| `/dashboard` | frase do período ("N buscas ficaram sem revendedor por perto"), 4 indicadores, **mapa de cobertura**, maiores lacunas, tendência, produtos mais buscados, buscas fora do catálogo, ações |
| `/dashboard/lacunas` | todas as combinações produto × cidade sem revendedor físico a 100 km, regiões, buscas fora do catálogo |
| `/dashboard/rede` | revendedores (filtro por nome/UF/tipo), completude do cadastro, quem está fora da busca por distância |
| `/dashboard/catalogo` | produtos × revendedores, produtos sem revendedor, revendedores sem produto |
| `/dashboard/importacoes` | histórico de lotes e o que corrigir (erros e avisos por aba/linha) |
| `/dashboard/widget` | situação do widget, snippet de instalação e pré-visualização |

Os relatórios vêm de 2 funções do banco (`panel_overview`, `panel_catalog`) em
`supabase/migrations/20261006000000_painel_relatorios.sql`. **Aplicar a migration no Supabase antes de publicar o painel.**

## Variáveis (públicas, entram no build)
| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto `geolynq-prod` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave **publishable** (`sb_publishable_…`). Nunca `service_role` |
| `NEXT_PUBLIC_WIDGET_SCRIPT_URL` | (opcional) bundle do widget; padrão `https://widget.geolynq.personalsupport.tech/v2/embed.js` (o mesmo widget da demonstração; o v1 continua no ar para quem já o embutiu) |

## Períodos
Seletor no alto da Visão geral e das Lacunas: **7, 30 e 90 dias** (janela móvel, como sempre) e o menu **Outros períodos**: Hoje, Esta semana (segunda a hoje), Semana passada,
Este mês, Mês anterior, Este ano e **Personalizado** (datas inicial e final, no máximo 366 dias). O período vai na URL (`?p=mes`, `?p=personalizado&de=AAAA-MM-DD&ate=AAAA-MM-DD`; o antigo `?dias=7|30|90`
continua valendo), então o endereço pode ser salvo ou compartilhado. Regras: calendário em horário de Brasília; semana começa na segunda; a comparação usa os MESMOS dias do período anterior
(um mês pela metade é comparado com os mesmos dias do mês anterior); "Hoje" e dias únicos mostram o gráfico por hora; datas inválidas caem em 30 dias com um aviso.
Não existe "Ano anterior": os dados são guardados por 12 meses (retenção). Código: `lib/periodo.ts` (puro, testado em `e2e/periodo.test.mts`); banco: funções `panel_*_r` (migration `20261024030000_painel_periodo_calendario.sql`,
exige aplicá-la ANTES de publicar o painel). As telas Rede, Catálogo, Importações e Widget não dependem de período.

## Leitura do período por IA (variáveis SECRETAS, só do servidor)
Definir no EasyPanel, serviço `geolynq_admin`, aba Ambiente (em tempo de execução; **sem** prefixo `NEXT_PUBLIC_`, nunca no Dockerfile nem no repositório):

| Nome | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | chave da API da Anthropic (de preferência uma chave só da GeoLynq, com limite de gasto no console da Anthropic) |
| `ANTHROPIC_MODEL` | nome do modelo a usar (obrigatório; trocar aqui muda custo e qualidade sem mexer no código) |
| `ANTHROPIC_BASE_URL` | (opcional; só testes) padrão `https://api.anthropic.com` |

Sem `ANTHROPIC_API_KEY` o cartão "Leitura do período" nem aparece. Requer a migration `20261012000000_leitura_ia.sql`. Regras: números vêm do SQL e são
conferidos contra os dados antes de aparecer (`lib/ia.ts`); no máximo 1 leitura a cada 2 minutos e 30 por dia por cliente.
Testes da lógica pura: `node --experimental-strip-types apps/admin/e2e/ia.test.mts` e `node --experimental-strip-types apps/admin/e2e/periodo.test.mts`.

## Rodar e testar
```bash
npm run build -w @geolynq/admin && npm run typecheck -w @geolynq/admin && npm run lint -w @geolynq/admin
```
**E2E em Chromium real** (`npm run e2e -w @geolynq/admin`): sobe o servidor de produção e um mini-Supabase
(`e2e/mock-supabase.cjs`) cujos relatórios vêm das **funções SQL reais** num Postgres local, com RLS. Montagem do banco
em `supabase/tests/README.md`; o build precisa usar as mesmas variáveis do teste:
```bash
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_test
npm run build -w @geolynq/admin
E2E_STANDALONE=1 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npm run e2e -w @geolynq/admin   # servidor "standalone" = o da imagem Docker
```
Cobre: login/erro/`?next` externo, isolamento entre clientes, números da tela = números do banco, filtros, períodos de calendário (hoje, semana, mês, ano, personalizado, comparados com a contagem direta no banco), menu de períodos no celular, mapa, faixa de demonstração, aviso de base pequena,
sem rolagem lateral no celular, cookies `httpOnly`, CSP, sair. Capturas em `E2E_OUT` (padrão `/tmp/geolynq-e2e`).

## Publicar (EasyPanel, projeto `personalsupport_saas`)
App novo `geolynq_admin`: Fonte Git `git@github.com:personal-support/geolynq.git` (a mesma deploy key), Dockerfile
`apps/admin/Dockerfile`, caminho de build `/`, porta `3000`, domínio `painel.geolynq.personalsupport.tech` (o DNS `*.geolynq`
já cobre). O Dockerfile traz URL e chave publishable como `ARG` com padrão do `geolynq-prod`.

## Criar o acesso de um cliente
1. Supabase → Authentication → Users → **Add user** (e-mail + senha, marcar *Auto Confirm User*).
2. Vincular ao cliente (SQL Editor): `insert into public.tenant_users (tenant_id, user_id, role) select t.id, u.id, 'owner' from public.tenants t, auth.users u where t.slug = '<slug>' and u.email = '<email>';`
3. A senha é combinada com o cliente fora do chat. Troca de senha: pelo Dashboard do Supabase (fluxo "esqueci a senha" ainda não existe no painel).

## Decisões e limites conhecidos
- Mapa usa os blocos públicos do OpenStreetMap (atribuição exibida). Uso comercial em escala exige servidor de mapas próprio ou pago.
- Sem "esqueci a senha", sem convite de usuário, sem edição de catálogo no painel (o catálogo entra pela importação).
- "Lista de candidatos a revendedor" (Receita) é a próxima fase (B3); a tela de lacunas já a sinaliza como "em breve".
- Dados de uso só aparecem com o widget **ativo** (cliente `active`) e a telemetria v2.
