# Status — GeoLynq

## Última atualização
2026-10-02 — **pausa**: usuário volta depois. Tudo commitado e enviado (branch `claude/bold-cray-vbbdyb`).

## Fase atual
Fases 0 a 4.5 e 4.1 **concluídas e no ar**: widget em `https://widget.geolynq.personalsupport.tech/v1/embed.js`
e site de amostra "Pódio" em `https://demo.geolynq.personalsupport.tech`, com catálogo fictício
(12 produtos, 12 revendedores), raio de busca de 100 km e deploy automático por push.
**Próximo grande passo: Fase 5 — painel admin** (onde o cliente vê buscas e lacunas de cobertura).
**Visão do produto (confirmada 2026-10-02, `docs/operacao-e-mercado.md` seção 13):** (1) **Widget** no "onde encontrar"
do site do fabricante = serviço + sensor de demanda; (2) **Plataforma web** para o time comercial = ver o cenário atual,
descobrir lacunas e agir (candidatos, alertas, status), alimentada por 3 fontes (navegação no widget, base do cliente,
universo da Receita); (3) **motor de dados + backoffice** (cadastro por CNPJ, segmentos/CNAE, importação, verificação mensal).

## Por onde retomar (em ordem)
1. **Fechar o teste da demo** no navegador e no celular. Já confirmado: Whey + CEP de Santos com
   dados reais (raio e ordenação ok). **Falta olhar:** glutamina (só SP, ~55 km), hipercalórico
   (sem revendedor → mensagem do raio), página de produto (widget já no item), celular, fontes.
   Depois zerar os eventos de teste (SQL Editor): `delete from public.widget_events where tenant_id =
   '3596b3c6-8389-42af-b575-4bbdd69f2f2d';` (hoje há 1 evento; pode rodar mais de uma vez)
2. **Polimento opcional do widget:** subtítulo "6 revendedores perto de Santos/SP" conta a loja online;
   o certo seria "5 perto de Santos/SP e 1 loja online".
3. **Cliente real à vista: New Millen** (relato do Danilo, 2026-10-02): quer o GeoLynq; paga **R$ 1.600/mês**
   ao Gofind; reclama que o Gofind usa **notas fiscais** (atualização leva meses) e que o widget não é
   intuitivo. **Decisão: sem plano básico**; o gancho é o **Radar de Cobertura** (onde está, como está,
   onde não está, como chegar). Detalhes, oferta (Radar R$ 1.690 · Radar+Expansão R$ 2.690 · piloto
   R$ 1.290 por 12 meses) e perguntas ao Danilo em `docs/operacao-e-mercado.md` seção 10.
   **Cuidado:** o Gofind também vende análise de demanda; o diferencial é frescor + intenção real +
   "como chegar" + usabilidade.
4. **Plano de construção (revisto de novo em 2026-10-02; ver seções 11 e 12 de `docs/operacao-e-mercado.md`):**
   **Princípio:** o perfil de mercado de **cada cliente** vem da Receita no cadastro (CNPJ → CNAE → segmento →
   canais → territórios) e todo o sistema o respeita; a New Millen é só a cliente inicial (Baixada Santista era
   só a região da demo; Gofind dela ≤ 500 acessos/mês). **Foco fixo:** fabricantes que dependem de ponto de venda
   (lojas, representantes, distribuidores; físico ou online). Ordem: ~~B1 Telemetria v2~~ (**FEITO e no ar em 2026-10-02**, ver
   "Concluído") → **B0 Perfil do tenant por CNPJ** (**B0.1 estrutura APLICADA em 2026-10-02**; **B0.2 FEITO (função `provision_tenant` + segmento "suplementos"); próximo: B0.3 workflow n8n de cadastro por CNPJ + importador com CNPJ/upsert**, depois B0.4 (só quando o Junior mandar os dados da New Millen) e B0.5 workflow n8n/importador; desenho em `docs/b0-cadastro-por-cnpj.md`; cadastro, taxonomia de segmentos → CNAEs de canal, territórios, **CNPJ como chave de revendedor**
   `unique(tenant_id, cnpj)`, verificação mensal de situação cadastral) → **B3 Candidatos por tenant** (base da
   Receita na VPS, recorte por tenant no Supabase) → **prova de valor com a New Millen no território dela** →
   **B2 Painel** (visões B2C lojas e B2B distribuidores/representantes) → **B4 Relatório mensal automático**.
   **Cuidados:** o CNAE do fabricante não diz quem o revende (sugerir + confirmar); "não consta na sua base",
   nunca "não vende"; Google proíbe guardar geocodificação >30 dias; Nominatim público proíbe uso pesado; contato é
   da equipe do cliente, sem disparo em massa (LGPD). Teto de preço do Junior para a New Millen: R$ 1.000/mês
   (piloto R$ 990). **Perguntas abertas:** CNPJ e território da New Millen, canais que ela usa, primeiras
   verticais da taxonomia.
5. **Fase 5 — painel admin** (`apps/admin`, Next.js 16): login por tenant, status da última importação
   (`import_batches`), lista de produtos/revendedores, preview do widget e dashboard de buscas e
   lacunas (queries do blueprint, Fase 5). **Antes de colocar no ar:** subir o patch do `next`
   (16.3.4 tem alerta crítico; corrigido na 16.3.8).
6. **Antes do 1º cliente real** (New Millen pode fechar em breve):
   - **Supabase para o plano Pro** (US$ 25/mês): o grátis pausa após 1 semana sem uso e derrubaria o widget;
   - **geocodificação:** cache CEP→coordenadas no banco, **atribuição ao OpenStreetMap no widget** (a
     política do Nominatim exige; hoje não exibimos) e plano para instância própria/paga em volume
     (Nominatim público: máx. 1 req/s, sem uso pesado);
   - **aviso de privacidade + contrato** (LGPD: cliente = controlador, GeoLynq = operador), com revisão jurídica;
   - monitor de disponibilidade (uptime) dos 2 hosts;
   - trocar o deploy automático por push pela versão **com testes** (workflow pronta, ver abaixo);
   - decidir a reimportação de revendedores (duplicam) e resolver;
   - rate limit em `widget_events` (qualquer um com a chave pública insere);
   - limpar o `demo` (revendedor duplicado + telefone `13999990000`, que pode ser real).
7. **Prazo duro: o n8n na AWS free tier expira em 10/11/2026.** Migrar o workflow
   `geolynq-import-catalogo` para a VPS Hostinger com folga (confirmar a data no console AWS).

**Como trabalhar com o usuário (combinado):** ele não usa PC, só a VPS Hostinger (`root@srv1887859`) e
o EasyPanel. Para qualquer passo na VPS ou no EasyPanel: primeiro explicar em português simples o que
será feito e por quê; depois comandos prontos para colar, um bloco por vez, com o resultado esperado,
e pedir a saída de volta. Sem jargão solto. Antes de gravar no banco de **produção** ou abrir PR,
pedir OK. Nunca pedir nem colar tokens/URLs de webhook em chat.

## Referência rápida
| O quê | Valor |
|---|---|
| Repositório | `github.com/personal-support/geolynq` (privado). Branch de trabalho `claude/bold-cray-vbbdyb`; a `main` **ainda não tem** o widget (PR nº 1 foi fechado sem merge) |
| Supabase (prod) | projeto `geolynq-prod`, ref `vshlsisnuaugeceafipt`, sa-east-1, URL `https://vshlsisnuaugeceafipt.supabase.co`. Projeto antigo `geolynq` (ca-central-1) está pausado |
| Tenant demo | slug `demo`, id `3596b3c6-8389-42af-b575-4bbdd69f2f2d` |
| VPS / DNS | Hostinger, IP `179.198.116.157`. DNS na Hostinger: A `*.geolynq` e A `geolynq` → IP da VPS (o curinga **não** cobre a raiz) |
| EasyPanel | `https://panel.personalsupport.tech` → projeto `geolynq` → app `widget` (serve os 2 hosts: `widget.` e `demo.`) |
| Deploy | push na branch → webhook do GitHub → Gatilho de Implantação do EasyPanel (HTTPS pelo domínio do painel). O Dockerfile faz `nginx -t`: config inválida derruba o build, não o container no ar |
| n8n | `https://automacoes-n8n.tvywld.easypanel.host`, workflow `geolynq-import-catalogo` (id `2ZPDQymNwVSENTIf`, trigger manual); planilha-modelo no Google Sheets id `18rF_rlwS-wYHASnW9Tbd-FQI0Ko9s1lUHTTSe5T8s_g` |
| Testes do widget | `npm run typecheck -w @geolynq/widget` · `npm test -w @geolynq/widget` (21) · E2E: buildar com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e então `npm run e2e -w @geolynq/widget` (46). Site: `node apps/demo/build.mjs` |
| Segredos | chave `sb_publishable_…` é pública (está no Dockerfile como `ARG`). `service_role` só no EasyPanel (admin futuro) e no n8n. A URL do gatilho de deploy é secreta |

## Armadilhas já enfrentadas (não repetir)
- **Conector Supabase `execute_sql`** dá timeout (60 s) em `DELETE`, `DROP` e blocos `DO $$`; `SELECT`,
  `INSERT` e `CREATE OR REPLACE FUNCTION` funcionam. Após timeout, **conferir o estado** (nada aplica
  pela metade em transação). `DROP`/`DELETE` ficam para o usuário no SQL Editor.
- **Sandbox da sessão** não alcança `*.supabase.co`, nem os domínios do usuário (403 do proxy), nem
  `easypanel.io`; não tem daemon Docker. Testes HTTP reais são feitos pela VPS do usuário. Dá para
  instalar nginx (`apt-get update && apt-get install -y nginx-light`) e testar `nginx.conf` de verdade;
  Chromium/Playwright funcionam (fontes do Google não carregam lá).
- **EasyPanel (PT-BR):** aba Fonte → **Git** (não "Github"), URL `git@github.com:…`, deploy key
  **somente leitura**; Construção → Dockerfile `apps/widget/Dockerfile`, caminho de build `/`.
- **DNS curinga** `*.geolynq` não cobre `geolynq.` sozinho; o `getent` da VPS guarda NXDOMAIN por até 10 min.
- **E2E** falha com timeout se o bundle for buildado sem as variáveis `VITE_*`.
- **Deploy com testes (para o 1º cliente):** `.github/workflows/deploy-widget.yml` só dispara em push na
  `main`; exige secret `EASYPANEL_WIDGET_DEPLOY_URL`, merge na `main` e Ramo `main` no EasyPanel, e o
  webhook do GitHub tem de ser removido ao ativá-la (senão publica 2x).

## Concluído
- [x] Fase 0 — GitHub criado. **DNS corrigido em 2026-10-02:** o wildcard registrado antes
  não existia de fato (NXDOMAIN). Criados na Hostinger (DNS em `dns-parking.com`) 2
  registros A → `179.198.116.157` (IP da VPS): `*.geolynq` e `geolynq`. O curinga NÃO
  cobre `geolynq.personalsupport.tech` (a raiz), por isso são dois registros. Verificado
  via DNS do Google (TTL 300). O `getent` da VPS pode devolver NXDOMAIN em cache por até
  10 min (SOA negativo = 600 s) — não afeta o Let's Encrypt
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

- [x] **Fase 4.5 — widget no ar** (2026-10-02). EasyPanel `panel.personalsupport.tech`,
      projeto `geolynq`, app `widget`: Fonte Git (SSH, deploy key `easypanel-vps`
      **read-only**), branch `claude/bold-cray-vbbdyb`, Dockerfile `apps/widget/Dockerfile`,
      domínio `widget.geolynq.personalsupport.tech` (HTTPS, porta 80). Verificado na VPS:
      `/v1/embed.js` 200 + gzip + `cache-control: public, max-age=300, must-revalidate` +
      CORS `*` + `nosniff`; `/healthz` `ok`; caminho inexistente 404; bundle contém a URL do
      Supabase (15.090 bytes). Primeiro build real do Dockerfile passou sem ajuste.
      Raiz `/` responde 404 **de propósito** (só `/v1/*` e `/healthz`). Robôs de varredura
      já sondam o domínio — esperado, nada exposto além do widget
- [x] **Deploy automático por push (versão enxuta)** (2026-10-02). Webhook do GitHub (repo →
      Settings → Webhooks; evento `push`; content-type json; sem secret; SSL ligado) apontando para
      o **Gatilho de Implantação** do app `widget` no EasyPanel, usando **HTTPS pelo domínio do
      painel** (`https://panel.personalsupport.tech/api/deploy/<token>`) e não o `http://IP:3000`
      que a tela mostra (token em texto puro). O token foi rotacionado por ter aparecido parcialmente
      num print; **nunca colar a URL em chat ou código**. Verificado: um push na branch gerou sozinho
      um deploy novo em EasyPanel → Implantações (nome = mensagem do commit; ~5 s com cache).
      Limites: qualquer push na branch publica (sem testes, sem filtro de caminho). Versão com
      testes pronta em `.github/workflows/deploy-widget.yml` (ver "Armadilhas já enfrentadas")
- [x] **Catálogo fictício do tenant `demo`** (2026-10-02, direto no `geolynq-prod`, só INSERT
      idempotente; nada existente foi alterado/apagado): +11 produtos (SKUs WPC-900, CRE-300,
      BCA-120, PRE-300, ALB-500, MVA-060, OM3-120, COL-300, GLU-300, BAR-012, HIP-3000 → total 12 com o
      WPI-900), +10 revendedores (Santos x2, Guarujá, São Paulo x3 incl. loja online, Campinas
      [distribuidor], Rio, Curitiba, BH) e 50 vínculos de cobertura. Coordenadas aproximadas
      ao nível do bairro, sem CEP. Telefones/WhatsApp **inválidos de propósito** (ex.
      `13900000001`) para ninguém mandar mensagem a um estranho numa demo; sites em
      `example.com`. Histórias de demo embutidas: Whey/Creatina em quase todo lugar; Glutamina
      só em SP; Barra só com distribuidor + online; **HIP-3000 sem nenhum revendedor** (caso
      "produto sem cobertura"). Validado como `anon` via `widget_nearest_resellers`
- [x] **Raio máximo de busca (100 km)** (2026-10-02). Banco: função nova
      `widget_resellers_in_radius(p_tenant_id, p_product_id, p_lat, p_lng, p_limit, p_max_km
      default 100)` (SECURITY INVOKER; execute só para anon/authenticated), arquivo
      `supabase/migrations/20261002000000_widget_max_radius.sql`. Regras: com localização só
      físico com distância <= raio (físico sem coordenadas fica de fora); `type = 'online'`
      sempre entra, sem distância e por último; sem localização não filtra. Widget: chama a
      RPC nova enviando `p_max_km = 100` (`MAX_RADIUS_KM` em `util.ts`), mensagens "Nenhum
      revendedor encontrado em até 100 km de <cidade>" e "Nenhum revendedor físico em até 100
      km… Veja as opções online:". **Telemetria:** `results_count` agora conta só físicos no raio
      (`countNearby`) — loja online aparece pro usuário mas não esconde a lacuna de cobertura
      local (o relatório "produto existe, ninguém vende perto" passa a funcionar). Validado
      como `anon` no banco real e por 30 verificações E2E (eram 22) + 13 unitários (eram 11).
      Por que nome novo e não substituir a função antiga: o `DROP` em transação deu timeout no
      conector (nada aplicado, banco intacto); com nome novo o widget publicado nunca fica sem
      função. A antiga foi removida à mão no SQL Editor depois que o widget novo entrou no ar
- [x] **Fase 4.1 — site de amostra "Pódio"** (2026-10-02; **NO AR** em https://demo.geolynq.personalsupport.tech).
      `apps/demo/`: gerador Node sem dependências (`build.mjs`, `products.json` espelhando os
      12 SKUs do tenant `demo`, `styles.css`) → HTML estático: home com o widget ao vivo no
      herói + catálogo por categoria + "Roteiro da demonstração" (5 passos para quem apresenta;
      inclui o snippet de instalação) e 12 páginas de produto com o widget já no item
      (`product="SKU"`). Marca/produtos fictícios, faixa "Site de demonstração" em todas as
      páginas, `noindex` (meta + `X-Robots-Tag` + `robots.txt`). Visual: rótulo de pote
      (Archivo larga + Hanken Grotesk + IBM Plex Mono via Google Fonts; cobalto `#1F3FFF`,
      amarelo `#FFD43B`, fundo `#F2F4EF`). Verificado em Chromium (desktop e 390 px, sem
      overflow horizontal) com Supabase simulado; **fontes não puderam ser conferidas** (o
      ambiente não baixa os arquivos de fonte; as capturas usaram fonte substituta).
      Hospedagem: **mesmo container do widget**, nginx por nome de host
      (`widget.geolynq…` → bundle; `demo.geolynq…` → site; host desconhecido/healthcheck →
      widget). `apps/widget/Dockerfile` agora também roda `node apps/demo/build.mjs` e faz
      `RUN nginx -t` (config inválida derruba o BUILD, não o container no ar). `nginx.conf`
      testado com nginx 1.24 real: 12 páginas 200, `/` 200, 404 próprio, `/v1/*` só no host do
      widget, 0 erros no log (isso pegou um bug: `/` dava 404 sem `index`)
      **Verificação em produção (usuário, 2026-10-02):** na VPS, `/` 200 (gzip, `no-cache`,
      `x-robots-tag: noindex, nofollow`), `/produto/wpc-900.html` 200, `/healthz` ok, widget
      segue 200 com `max-age=300`, `/v1/embed.js` no host do demo 404. No navegador, com
      ViaCEP/Nominatim/Supabase reais: Whey + CEP 11060-001 → "6 revendedores perto de
      Santos/SP" (Nutri Gonzaga 800 m, Orla Saúde 4,1 km, Pitangueiras 8,5 km, Paulista 55 km,
      Pinheiros 57 km, loja online por último sem distância), ou seja, raio de 100 km e
      ordenação funcionando de ponta a ponta. **Não coberto pelo print enviado:** glutamina,
      hipercalórico, página de produto com `product=`, celular, fontes
      **Polimento opcional visto no print:** o subtítulo diz "6 revendedores perto de…"
      contando a loja online (poderia ser "5 perto de… + 1 loja online"); a coluna do texto
      do herói fica vazia ao lado do resultado longo do widget
- [x] **Widget: atributo `product="SKU"`** abre direto na etapa de CEP (SKU inexistente cai
      na busca normal) e **correção de foco**: o widget não rouba mais o foco/rolagem da página
      no carregamento (antes focava o campo de busca ao montar). 36 verificações E2E (eram 30)
- [x] **B1 — Telemetria v2** (2026-10-02; autorizado pelo usuário; **no ar**). Banco (`geolynq-prod`, migration
      `supabase/migrations/20261002010000_widget_events_v2.sql`, só aditiva): 11 colunas novas em `widget_events`
      (`telemetry_v`, `neighborhood`, `lat_approx`, `lng_approx`, `cep5`, `location_source`, `nearest_km`,
      `physical_count`, `online_count`, `action`, `distance_km`) + CHECK `widget_events_v2_check` (formato e
      tamanho, inclusive `query_text` ≤ 200 e `session_id` ≤ 64, pois a tabela aceita INSERT anônimo). Linhas
      antigas ficaram com `telemetry_v = 1`. **Privacidade:** nunca o CEP inteiro (só `cep5`) nem coordenada exata
      (2 casas, ~1 km; a geocodificação reversa também recebe a coordenada arredondada). Widget: busca grava
      localização (CEP ou GPS), bairro, contagem física/online e distância ao físico mais próximo; `results_count`
      passa a ser = físicos no raio; clique grava a **ação** (`whatsapp`/`call`/`site`/`directions`) e a distância do
      revendedor; GPS ganha cidade/UF/bairro por **geocodificação reversa** (Nominatim, 2,5 s, falha silenciosa, em
      paralelo à busca). Validado: 21 unitários, **46 E2E**, e **os 8 eventos que o widget novo emite foram
      inseridos como `anon` no banco real** (rollback) + 3 casos inválidos recusados (`23514`). Não coberto: GPS
      real em navegador e a geocodificação reversa real (só simuladas)
- [x] **B0 — desenho do cadastro por CNPJ** (2026-10-02; **só desenho, nada aplicado**; ver `docs/b0-cadastro-por-cnpj.md`).
      Caso real **New Millen** (dados do Junior + fontes públicas): **NM Alimentos LTDA**, CNPJ matriz
      **00.385.181/0001-11** (Cajamar/SP; filial /0002-00 em São Paulo), ativa, aberta em 05/01/1995, EPP, CNAE
      principal **1099-6/07** (corrige o `/04` citado antes de memória: `/04` é gelo), segmento "suplementos em geral",
      território/canais "Todos" (interpretado como Brasil inteiro + todos os canais; **confirmar**). Vende em
      marketplaces, e-commerces, redes de farmácia e direto da fábrica. **Decisões:** cliente = raiz do CNPJ;
      revendedor = CNPJ de 14 dígitos (`unique(tenant_id, cnpj)`), rede = mesma raiz (abordar a matriz da rede, não
      cada loja); **CNAEs de canal aprendidos da própria base de revendedores do cliente** (medidos, não
      adivinhados) com a tabela curada só como ponto de partida; CNAE 4729-6/99 é guarda-chuva ruidoso → filtro por
      nome + score de aderência validado em amostra; online sem raio (lacuna de presença); código de atividade
      só entra depois de conferido na base/IBGE, nunca de memória. A API pública de CNPJ e o Gofind/Receita estão
      bloqueados no sandbox: a consulta real sai da VPS do usuário
- [x] **B0 — verificação com a API real e a VPS** (2026-10-02; `docs/b0-cadastro-por-cnpj.md` seção 10). BrasilAPI respondeu da VPS
      com os dados reais da New Millen (esquema confere). Achados: o **CNAE vem como número** (perde o zero à esquerda →
      `lpad(x::text,7,'0')`); há **2 códigos de município** (Receita 6285 × IBGE 3509205; o dump usa o da Receita); **e-mail
      nulo e telefone `000000000000`** → contato cadastral da Receita é fraco, o "como chegar" exige enriquecimento; `qsa`
      (sócios) é dado pessoal → não guardar. **VPS:** 95,8 GB (61,9 livres), 7,8 GB RAM, 2 vCPU → a base da Receita (~85 GB)
      **não cabe extraída**; ETL em **streaming** (um zip por vez, filtrando na leitura, de madrugada). Pendente:
      "Todos" = Brasil + todos os canais (**confirmado pelo Junior: Brasil inteiro, todos os canais, e não só New Millen**)
- [x] **B0.1 — estrutura aplicada em produção** (2026-10-02, autorizada; `supabase/migrations/20261003000000_b0_tenant_profile.sql`).
      Criados: `is_valid_cnpj()`, `tenant_profiles`, `cnae_catalog`, `segments`, `segment_channel_cnaes`, `tenant_segments`,
      `tenant_territories` (todas com RLS; escrita só service_role) e em `resellers` as colunas `cnpj` (14 dígitos puros + DV),
      `verification_status`, `verified_at` + índice único `(tenant_id, cnpj)`. **Verificado de verdade no banco:** validação de CNPJ,
      recusa de dígito errado/máscara/duplicado, 12 revendedores intactos, anônimo sem acesso às tabelas novas nem às colunas novas,
      RPCs do widget ainda respondendo como anônimo (3 resultados, 0,83 km), verificador de segurança sem alerta novo.
      **Não verificado:** o widget aberto no navegador depois da mudança. **Mudou de permissão:** `anon` só lê `resellers` em colunas
      listadas (id, tenant_id, name, type, status, phone, whatsapp, website, created_at, updated_at); coluna nova nasce fechada.
      **Armadilha do conector:** `DROP POLICY` e bloco longo dão timeout e **desfazem tudo** (a etapa 4 inteira foi revertida; refeita em
      blocos curtos só com `CREATE`); depois de timeout, confira o estado antes de repetir. Tipos novos em `packages/shared/types.ts`.
- [x] **B0.2a — `provision_tenant` aplicada** (2026-10-02; `supabase/migrations/20261003010000_b0_provision_tenant.sql`; detalhes e o que não foi
      verificado em `docs/b0-cadastro-por-cnpj.md` seção 7). Só `service_role` executa; cliente novo nasce `trial` (widget só serve `active`).
      Testada só com rollback; **nenhum cliente real cadastrado**. **A New Millen NÃO foi cadastrada:** o Junior avisa quando tiver os dados.
      Armadilha: o Supabase dá EXECUTE a anon/authenticated em função nova; sempre `revoke` explícito.
- [x] **B0.2b — catálogo de CNAEs e segmento "suplementos"** (2026-10-02; `supabase/migrations/20261003020000_b0_segment_suplementos.sql`). 16 códigos
      conferidos na API oficial do IBGE pela VPS do Junior (`servicodados.ibge.gov.br/api/v2/cnae/subclasses/{codigo}`; a rota `/api/cnae/v1` da BrasilAPI
      que eu sugeri não existe). 10 CNAEs de canal; **escolha e pesos são julgamento meu**, só ponto de partida até o perfil medido (B0.5). Dados reais
      gravados: 16 em `cnae_catalog`, 1 em `segments`, 10 em `segment_channel_cnaes`. Armadilha de teste: SELECT no mesmo comando que uma função que grava
      não enxerga o que ela gravou; teste em comando separado.

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
- [ ] **Reimportação de revendedores duplica registros.** `products` tem `unique(tenant_id, sku)`
      (duplicata vira erro por linha), mas `resellers` não tem constraint única — reimportar a mesma
      planilha cria revendedores duplicados em silêncio (visto no `demo`: 2× "Farmácia Saúde
      Total", execuções #97/#98). Opções: `unique(tenant_id, name)` + `upsert`, ou chave de negócio
      (nome + CEP). Resolver antes do 1º cliente real.
- [ ] Limpeza do `demo`: revendedor duplicado `814f5182-…` (sem cobertura, não aparece nas buscas) e
      telefone/WhatsApp `13999990000` dos 2 registros (pode ser número real → trocar por inválido ou
      pelo número do Danilo, para demonstrar o botão de WhatsApp)
- [ ] Loja online conta como cobertura? Hoje aparece ao usuário mas **não** entra no `results_count`
      (a lacuna local continua detectável). Mudar é uma linha em `countNearby` (`util.ts`)
- [ ] Busca de produto é sensível a acento ("proteina" não acha "Proteína"). Resolver com `unaccent` + RPC
      de busca quando houver catálogo real.
- [ ] Quando fazer o merge da branch na `main` (e apontar o EasyPanel para `main`)

## Pendente
- [ ] Decisão de negócio: oferta e preço para a New Millen (seção 10 de `docs/operacao-e-mercado.md`); a tabela
      antiga (Essencial R$ 247) **não vale mais**
- [ ] **B0 Perfil do tenant por CNPJ** — B0.1 (estrutura) feito; faltam B0.2 (`provision_tenant`, semente de segmento), B0.3 (n8n + importador
      com coluna CNPJ e upsert por `(tenant, cnpj)` — a reimportação ainda duplica até isso), B0.4 (New Millen real), B0.5 (ETL Receita na VPS)
- [ ] Widget: exibir atribuição "© OpenStreetMap" (exigência do Nominatim) e cachear CEP→coordenadas
- [ ] Supabase `geolynq-prod` ainda no plano grátis → Pro antes do 1º cliente pagante
- [ ] Fase 5 — painel admin (ver "Por onde retomar")
- [ ] Anti-spam em `widget_events` — rate limit no gateway/Nginx
- [ ] `public.spatial_ref_sys` (PostGIS) sem RLS — risco baixo (só sistemas de coordenadas), advisor
      marca como crítico; decidir entre `ENABLE ROW LEVEL SECURITY` ou mover PostGIS para o schema
      `extensions`
- [ ] `npm audit`: `next` 16.3.4 do `apps/admin` (RCE em `next/og`, corrigido na 16.3.8) e
      `brace-expansion` (high, transitivo) — subir antes do deploy do admin
- [ ] Migrar o n8n da AWS para a VPS Hostinger antes de 10/11/2026
- [ ] `docs/schema-locator-v2.sql` ainda tem as policies antigas; a fonte de verdade do banco é schema
      + `supabase/migrations/*` (inclui `widget_resellers_in_radius`)

## Decisões tomadas
- Widget fala com o PostgREST via `fetch`, sem supabase-js (bundle pequeno em site de terceiro)
- Leitura pública do widget: tabelas continuam fechadas; `tenants` só via RPC de 5 campos; busca de
  revendedores é RPC `SECURITY INVOKER` (RLS continua valendo)
- Chave no bundle: `sb_publishable_…`, só no header `apikey`; nunca `service_role`
- Raio padrão 100 km; loja online sempre elegível (sem distância, por último); `results_count` conta
  só físicos no raio
- Widget e demo no **mesmo container** (nginx por host), conforme o blueprint
- Deploy automático **enxuto** (qualquer push na branch publica) até o 1º cliente real
- Sem `geolynq-dev` por enquanto — free tier só permite 2 projetos ativos
- Fase 3 segue no n8n atual (AWS free tier); migrar perto do prazo
- Migrations aplicadas via `execute_sql` (não `apply_migration`, que deu timeout) → **não constam em
  `supabase_migrations`**; os arquivos em `supabase/migrations/` são idempotentes
- Primeiro projeto Supabase saiu na região errada (ca-central-1) — pausado, não apagado

## Bloqueios
- [ ] n8n atual roda em conta AWS free tier — acesso expira em **10/11/2026**. Migrar o workflow pra
      VPS Hostinger com folga. Conferir a data exata no console AWS.
- [ ] O ambiente de nuvem da sessão não alcança `*.supabase.co` nem os domínios do projeto (ver
      "Armadilhas"); é uma limitação do ambiente, contornada pela VPS do usuário. Liberar em Network
      access do ambiente (menu do ambiente → Edit) só se quiser testes HTTP reais daqui.
