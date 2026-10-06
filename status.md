# Status — GeoLynq

## Última atualização
2026-10-06 — **retomada + auditoria de infraestrutura** (só leitura; nada gravado em produção). Ver
"Auditoria de 2026-10-06" logo abaixo. Trabalho do dia na branch `claude/keen-johnson-c0x5hs`,
que contém tudo da `claude/bold-cray-vbbdyb` (merge feito em 2026-10-06).

## Rumo ao produto vendável (definido em 2026-10-06)
Decisão do usuário: **a New Millen ainda não é cliente** → trabalhar com **dados hipotéticos**
(`docs/dados-teste/`, tenant fictício `fabrica-teste`; o `demo` fica só como vitrine). Meta: um sistema que
funcione de verdade, seja robusto e valha a compra. "Pronto para vender" = todos os itens abaixo:
1. [x] **Pipeline provado ponta a ponta com dados de teste (2026-10-06):** cadastro por CNPJ gravando,
       importação v2 e reimportação sem duplicar, tudo conferido no banco. Falta só o teste de erros
       (linhas inválidas, CNPJ repetido) e o widget lendo o tenant de teste.
2. [~] **Painel (Fase 5):** o cliente entra e vê buscas, lacunas de cobertura e cliques por revendedor — é o
       que justifica o preço (o widget sozinho é commodity). **Construído e testado (2026-10-06); falta aplicar a
       migration no banco real, criar o 1º usuário e publicar no EasyPanel** (ver "Fase 5 — painel" abaixo).
3. [ ] **Operação segura:** Supabase **Pro** (o grátis pausa e derruba o widget), rate limit em
       `widget_events`, `spatial_ref_sys` com RLS, monitor de uptime, deploy com testes (`deploy-widget.yml`).
4. [ ] **Legal e geocodificação:** aviso de privacidade + contrato (LGPD), atribuição ao OpenStreetMap,
       cache de CEP/coordenadas.
5. [ ] **n8n fora da AWS** (prazo 10–13/11/2026) → VPS Hostinger/EasyPanel.
6. [ ] **Limpar o `demo`** (revendedor duplicado e telefone `13999990000`) antes de mostrar a qualquer cliente.

## Cliente de teste `fabrica-teste` (criado em 2026-10-06, com OK do usuário)
- Cadastrado pelo workflow n8n "Cadastro de Cliente por CNPJ" (execução nº 103, `gravar=true`, sucesso na 1ª
  tentativa): `tenant_id` `88a5496b-7837-4aee-a817-4cfbe7a1a011`, slug `fabrica-teste`, status **trial**,
  segmento `suplementos`, territórios SP e RJ. O CNPJ usado na consulta à Receita é o do Banco do Brasil
  (`00000000000191`, **só como stand-in**; a raiz `00000000` está ocupada por este tenant de teste).
  Quando a New Millen fechar, cadastrar com o CNPJ dela (raiz própria, sem conflito).
- Conferido no banco (somente leitura): `tenants` + `tenant_profiles` + segmento + territórios gravados;
  produtos e revendedores = 0. Como `anon`: `widget_get_tenant('fabrica-teste')` = 0 linhas (trial é invisível
  ao público), `demo` = 1, e `tenant_profiles` nem tem permissão para `anon`.
- Workflow 1 voltou para `gravar=false` (com os parâmetros do teste). Workflow 2 aponta para o tenant de
  teste (`exigir_cnpj=true`) e para a planilha do Drive `1Kh1LUORceoK8uqcQs63bVUj2ef0pBWDlcCYX80YApw8` (lendo
  as abas por nome). A planilha foi compartilhada pelo usuário com a conta de serviço do n8n (como Editor).
- **Importação v2 provada com dados reais de produção (2026-10-06):**
  - Exec. nº 104 (1ª): 5 produtos, 8 revendedores, 8 endereços (8/8 geocodificados, coordenadas coerentes) e
    20 coberturas gravados no tenant de teste. **Achou 1 defeito:** o `import_batches` não foi gravado (a
    execução terminava em "Gravar Cobertura" porque, sem erro, nenhum ramo acionava o merge).
  - **Conserto** (no n8n e em `docs/n8n-geolynq-import-catalogo-v2.workflow.ts`): o merge ganhou a 7ª entrada,
    alimentada pelo sucesso de "Gravar Cobertura" (que agora tem `alwaysOutputData`).
  - Exec. nº 105 (reimportação da mesma planilha): **0 duplicatas** (contagens e checksums dos ids de
    produtos, revendedores, endereços e coberturas idênticos antes/depois) e **1 lote** em `import_batches`
    (`success`, 33 linhas processadas, 0 falhas).
  - Observação menor: revendedor `online` também é geocodificado (cai no centro da cidade). Inofensivo (o widget
    ignora a distância de loja online), mas é consulta desperdiçada ao Nominatim; pular no futuro.
- **Teste de erros provado (2026-10-06, exec. nº 106 e 107):** planilha com 11 erros plantados + 2 linhas boas
  (`docs/dados-teste/fabrica-teste-ERROS-catalogo.xlsx`). Resultado: lote `partial`, 48 linhas processadas,
  **11 falhas, todas na aba/linha/mensagem certas** (produto sem SKU, SKU duplicado, CNPJ com DV errado, CNPJ
  repetido no lote, sem CNPJ, tipo inválido, CEP inválido, sem cidade, cobertura com SKU inexistente / CNPJ não
  importado / SKU vazio). Nenhuma linha ruim entrou; as 2 boas entraram; a reimportação não duplicou nada.
  Estado final do tenant de teste: **6 produtos, 10 revendedores, 10 endereços, 21 coberturas** (e 3 lotes).
  - **Lacuna achada e fechada:** revendedor com endereço que o Nominatim não acha entrava **sem aviso** e sumia da
    busca por distância. Agora o resumo grava `AVISO: endereço não geocodificado…` no `error_log` (não conta como
    falha; se for o único problema, status `partial`; loja `online` não gera aviso). Validado na exec. nº 107
    (11 falhas + 1 aviso, 12 itens no log). Corrigido no n8n e em `docs/n8n-geolynq-import-catalogo-v2.workflow.ts`.
  - O workflow voltou a apontar para a planilha limpa `1Kh1LUORceoK8uqcQs63bVUj2ef0pBWDlcCYX80YApw8`.
    A pasta `GeoLynq — Testes (n8n)` (id `1KFH8Gw5l0FgQR_CykOtgbVGiNhfHexEJ`) está compartilhada (Leitor) com a conta
    de serviço do n8n: planilhas criadas dentro dela herdam o acesso.
  - **Não testado ainda:** o widget lendo este tenant (precisa estar `active`; está `trial`); falha de gravação
    no banco (ex.: Supabase fora do ar no meio do lote); planilha com milhares de linhas (geocodificação a 1/s:
    1.000 revendedores ≈ 17 min; Nominatim público não serve para volume — ver "Antes do 1º cliente real").

## Fase 5 — painel do cliente (construído em 2026-10-06; **NÃO publicado**; `apps/admin`)
- **Telas:** login · visão geral (frase do período, 4 indicadores, **mapa de cobertura**, maiores lacunas, tendência, produtos,
  buscas fora do catálogo, ações) · lacunas · rede de revendedores · catálogo · importações · widget no site. Tudo em pt-BR.
  Detalhes, variáveis e como publicar: `apps/admin/README.md`.
- **Arquitetura:** o painel **não usa `service_role`**. O usuário entra por Supabase Auth e lê como `authenticated`; o RLS
  existente (`tenant_users`) isola os clientes. Relatórios = 2 funções SQL novas (`panel_overview`, `panel_catalog`) +
  1 policy (o usuário vê a própria linha em `tenants`) em `supabase/migrations/20261006000000_painel_relatorios.sql`.
  **Essa migration AINDA NÃO foi aplicada no `geolynq-prod`** (precisa de OK do usuário).
- **Segurança do app:** `next` 16.3.8 (RCE corrigido; `npm audit --omit=dev` = 0), cookies de sessão `httpOnly`+`SameSite=Lax`+`Secure`,
  CSP restritiva, HSTS, `X-Frame-Options: DENY`, `?next` do login só aceita caminhos internos, sessão validada com `getUser()`.
  Devs: 8 alertas só em ferramentas de teste (vitest/tinypool), fora do servidor.
- **Testes (todos locais, sem tocar na produção):**
  - Banco: Postgres 16 + PostGIS local com `docs/schema-locator-v2.sql` + TODAS as migrations do zero (provou que a cadeia de
    migrations é reproduzível) + cliente de teste + 420 buscas simuladas (`supabase/tests/`). Isolamento provado: membro do
    cliente A lê o A; usuário só do cliente B recebe NULL/0 linhas ao tentar ler o A; anônimo não vê nem executa.
  - Navegador: `npm run e2e -w @geolynq/admin` = **42/42** em Chromium real (também no servidor "standalone" da imagem), com
    mini-Supabase cujas respostas vêm das funções SQL reais. Confere número da tela = número do banco, filtros, período, mapa
    (um marcador por revendedor/demanda), celular sem rolagem lateral, cookies httpOnly, CSP, sair, usuário sem vínculo.
- **Não verificado:** build da imagem Docker (sem daemon aqui; a saída standalone foi testada, o Dockerfile não foi executado);
  login contra o Auth REAL do Supabase (o ambiente não alcança `*.supabase.co`; o fluxo é o padrão do `@supabase/ssr`);
  os blocos reais do OpenStreetMap no mapa (bloqueados aqui; sem eles o mapa aparece sem fundo); a pré-visualização do widget
  (bundle externo bloqueado aqui).
- **APLICADO EM PRODUÇÃO em 2026-10-06 (OK do usuário):** (1) migration `20261006000000_painel_relatorios.sql` no `geolynq-prod`
  (policy `tenant_members_read_tenant` em `tenants`; funções `is_tenant_member`, `panel_overview`, `panel_catalog`, todas
  SECURITY INVOKER; `anon` sem EXECUTE, `authenticated` e `service_role` com EXECUTE; aplicada em 3 partes por causa do limite de
  60 s do conector, resultado idêntico ao arquivo); (2) 526 eventos simulados no tenant `fabrica-teste` (410 buscas + 116 cliques;
  todas as sessões começam com `seed-`; o `demo` NÃO foi tocado: continua com 9 eventos). Prova no banco real (usuário temporário +
  `rollback`): `panel_overview` 30 d = 269 buscas / 79 sem cobertura / 22 lacunas (igual ao teste local); usuário vinculado só vê 1
  cliente e 0 eventos da demo. **Para apagar os simulados:** `delete from public.widget_events where session_id like 'seed-%';`
  (SQL Editor). O histórico `supabase_migrations` não registra esta migration (aplicada por `execute_sql`).
- **EasyPanel (criado em 2026-10-06, ainda SEM deploy):** serviço `geolynq_admin` no projeto `personalsupport_saas` (Fonte Git SSH
  `git@github.com:personal-support/geolynq.git`, branch `claude/keen-johnson-c0x5hs`, Dockerfile `apps/admin/Dockerfile`, porta 3000, domínio
  `painel.geolynq.personalsupport.tech` com HTTPS, 1 vCPU / 1 GB). O Dockerfile traz URL e chave publishable como ARG, então não há variáveis
  no serviço. **Chave de deploy própria do serviço gerada; falta o usuário cadastrá-la no GitHub** (repo → Settings → Deploy keys, SOMENTE
  leitura). Depois: `deployAppService`. Não ligar webhook de deploy automático nesta branch de sessão; quando houver merge na `main`,
  trocar a branch do serviço para `main`. A imagem Docker NUNCA foi construída: o 1º build é o teste real do Dockerfile.
- **NO AR (2026-10-06, ~23:20 UTC):** deploy key do serviço cadastrada no GitHub pelo usuário (somente leitura); build feito a partir do commit
  `3037bb1` e **o Dockerfile do painel funcionou na 1ª tentativa**. Contêiner `personalsupport_saas_geolynq_admin` `running` e `healthy`
  (HEALTHCHECK em `/login`). O domínio `painel.geolynq.personalsupport.tech` está mapeado (HTTPS); **não verificado daqui** (o ambiente de
  nuvem leva 403 do proxy nesse domínio): o 1º acesso real é do usuário.
- **Acesso:** usuário `personalpg51@gmail.com` (Auth, confirmado) vinculado como `owner` ao tenant `fabrica-teste` (cliente de teste, `trial`).
  A senha só o usuário sabe.
- **1º login feito pelo usuário (2026-10-06): "visualizações ok"; dúvida dele: os dados são precisos?** Resposta registrada:
  (a) **cálculo provado:** 11 indicadores do painel recalculados direto dos eventos brutos, por consulta independente, no banco real
  (buscas 269, pessoas 185, cliques 75, sem revendedor 79, com produto 233, fora do catálogo 36, 37,8 %, 66,1 %, 13,9 km, soma das
  lacunas = 79, soma da série = 269): **11/11 idênticos**; (b) **conteúdo é fictício** (simulado) — nunca mostrar a cliente como se fosse
  real; (c) **riscos de precisão com dados reais, a tratar antes do 1º cliente:** busca sensível a acento ("proteina" não acha "Proteína" e
  vira falsamente "fora do catálogo"), `widget_events` aceita INSERT anônimo sem limite (inflável por robô), "pessoas" = sessões do navegador
  (não pessoas), buscas sem localização não entram como lacuna, raio fixo de 100 km, base pequena (≤ 500 acessos/mês) = números instáveis.
  **Ideias aprovadas a propor:** faixa "Dados de demonstração" em tenants de teste; aviso "base pequena" quando houver poucas buscas.
- **Falta:** a conferência visual completa pelo usuário (mapa com os blocos reais do OSM, pré-visualização do widget só aparece com o
  cliente `active`). Depois do merge na `main`, trocar a branch do serviço `geolynq_admin` para `main`.
- **Para publicar (cada item precisa do OK/ação do usuário):** (1) aplicar a migration no `geolynq-prod`; (2) criar o usuário
  no Supabase Auth e vinculá-lo (SQL no README); (3) opcional: gravar as buscas simuladas no `fabrica-teste` para o painel
  não ficar vazio (`supabase/tests/03_eventos_simulados.sql`; apagar depois com `delete … where session_id like 'seed-%'`);
  (4) criar o app `geolynq_admin` no EasyPanel (README); (5) o domínio `painel.geolynq…` já é coberto pelo DNS `*.geolynq`.
- **Limites conhecidos:** sem "esqueci a senha"/convite de usuário/edição de catálogo no painel; mapa com blocos públicos do OSM
  (uso comercial em escala exige servidor próprio/pago); "lista de candidatos a revendedor" (B3) ainda não existe.

## Auditoria de 2026-10-06
**Conectores agora disponíveis na sessão:** Supabase (org `gknjufnkbourddiufozo`, vê o `geolynq-prod`),
GitHub, n8n, EasyPanel, Hostinger. Antes o Supabase estava ligado à conta errada.
- **Banco real (`geolynq-prod`) confere com o repositório:** as 7 migrations existem no banco (tabelas
  `tenant_profiles`, `cnae_catalog`, `segments`, `segment_channel_cnaes`, `tenant_segments`,
  `tenant_territories`; coluna `resellers.cnpj` + `verification_status`; índice único parcial
  `resellers_tenant_cnpj_uq (tenant_id, cnpj)`; funções `provision_tenant` e `import_reseller` com
  EXECUTE **só** para `service_role`; `widget_get_tenant`/`is_active_tenant` públicas por design).
  Contagens reais: 1 tenant (`demo`, active), 12 produtos, 12 revendedores, 12 endereços, 51 coberturas,
  9 eventos, 0 `tenant_profiles`. O histórico `supabase_migrations` só tem a migration inicial (as demais
  foram aplicadas por `execute_sql`; os arquivos do repo são idempotentes).
- **Advisors de segurança:** `spatial_ref_sys` sem RLS (ERROR, risco baixo; correção
  `ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY` **aguarda OK do usuário**); PostGIS no
  schema `public` (WARN); `tenants` com RLS e sem policy (INFO, **intencional**: o widget só lê 5 campos
  via RPC); RPCs `SECURITY DEFINER` executáveis por `anon` (`widget_get_tenant`, `is_active_tenant`: por
  design; `st_estimatedextent`: do PostGIS).
- **EasyPanel foi reorganizado em 2026-10-05:** o app do widget agora é o projeto `personalsupport_saas`
  → serviço `geolynq_widget` (antes: projeto `geolynq` → app `widget`, que não aparece mais). Continua com
  Fonte Git (branch `claude/bold-cray-vbbdyb`, Dockerfile `apps/widget/Dockerfile`, porta 80) e os dois
  domínios `widget.` e `demo.geolynq.personalsupport.tech` com HTTPS; último commit implantado = `b2c2c88`
  (cabeça da branch). **A conferir pelo usuário:** o webhook do GitHub ainda aponta para o gatilho de
  implantação do app antigo? Se sim, o push deixou de publicar sozinho (o token do gatilho mudou).
- **VPS Hostinger:** KVM 2 (2 vCPU, 8 GB, 100 GB), Ubuntu 24.04 com EasyPanel, `running`, IP
  `179.198.116.157`. Tem folga para receber o n8n.
- **Segredos expostos no chat desta sessão:** a listagem geral do EasyPanel devolveu as variáveis de
  ambiente de **outros projetos** (fora do GeoLynq). Não foram usadas. O usuário vai rotacioná-las. Regra
  daqui para frente: consultar o EasyPanel **só** em `personalsupport_saas`/`geolynq_widget`
  (`inspectAppService`/`listDomains`), nunca `listProjectsAndServices`. Recomendado: usuário do EasyPanel
  restrito ao projeto `personalsupport_saas`.
- **Não verificado nesta sessão:** acesso HTTP real ao widget e à demo (o ambiente de nuvem leva 403 do
  proxy nesses domínios).
- **B0.3 — credenciais vinculadas em 2026-10-06 (workflows continuam inativos, manuais):**
  - `GeoLynq — Cadastro de Cliente por CNPJ` (`toU5IgMP0wvoaE1b`): nó `provision_tenant` com a credencial
    n8n "Supabase account" (`urKpm6ymaIpZn3c3`). Testado só em **modo conferência** (`gravar=false`; nada
    gravado). A BrasilAPI é instável: 02/10 ok em 2 s; 06/10 deu 503, depois 429 no navegador, depois ok.
    O CNPJ de exemplo `00385181000111` é o da **NM Alimentos / New Millen** (ativa, CNAE 1099607,
    Cajamar/SP). **Não gravado:** falta o usuário definir slug, nome, estados de atuação e cor (B0.4).
  - `GeoLynq — Import Catálogo v2 (CNPJ)` (`vCFeM2DItVsorH5f`): conferido por leitura (MCP) — 3 nós "Ler Aba"
    com "Google Drive account" (service account) e a planilha modelo; 3 nós HTTP + "Registrar Lote" com
    "Supabase account"; `tenant_id` = demo e `exigir_cnpj=false`. **Nunca executado.**
  - **Não executar o v2 no tenant `demo` com a planilha-modelo:** a linha "Farmácia Saúde Total" não tem CNPJ e
    `import_reseller` sem CNPJ **sempre insere** (mais um duplicado) e reusa o telefone `13999990000`
    (que pode ser real). Primeira execução real: com os dados e CNPJs da New Millen, `exigir_cnpj=true`,
    depois do cadastro do cliente (B0.4) e com OK do usuário.
  - **Não verificado:** se a chave dentro da credencial "Supabase account" é a `service_role` do
    `geolynq-prod` (o conteúdo da credencial não é legível por aqui; a Fase 3 funcionou com ela).

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
   "Concluído") → **B0 Perfil do tenant por CNPJ** (**B0.1 estrutura APLICADA em 2026-10-02**; **B0.2 FEITO (função `provision_tenant` + segmento "suplementos"); B0.3 FEITO em modo de teste (workflow de cadastro, importador v2 e `import_reseller`, nada ativado; falta o Junior vincular a credencial service_role nos nós HTTP do n8n); próximo: B0.4 (só quando o Junior mandar os dados da New Millen) e B0.5 (ETL da Receita na VPS + perfil de canal medido)** workflow n8n/importador; desenho em `docs/b0-cadastro-por-cnpj.md`; cadastro, taxonomia de segmentos → CNAEs de canal, territórios, **CNPJ como chave de revendedor**
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
7. **Prazo duro: o n8n na AWS free tier expira em 10/11/2026.** Migrar o n8n (e os workflows
   `geolynq-import-catalogo`, `Cadastro de Cliente por CNPJ` e `Import Catálogo v2`) da AWS para o
   EasyPanel da VPS Hostinger com folga (confirmar a data no console AWS; alguns registros dizem 13/11).
   **Decidido em 2026-10-06: ainda não mexer; só manter o alerta.** Ao migrar: exportar workflows e
   credenciais, recriar a credencial Supabase `service_role` no n8n novo, e trocar o endereço do n8n em
   `CLAUDE.md`/esta tabela.

**Como trabalhar com o usuário (combinado):** ele não usa PC, só a VPS Hostinger (`root@srv1887859`) e
o EasyPanel. Para qualquer passo na VPS ou no EasyPanel: primeiro explicar em português simples o que
será feito e por quê; depois comandos prontos para colar, um bloco por vez, com o resultado esperado,
e pedir a saída de volta. Sem jargão solto. Antes de gravar no banco de **produção** ou abrir PR,
pedir OK. Nunca pedir nem colar tokens/URLs de webhook em chat.

## Referência rápida
| O quê | Valor |
|---|---|
| Repositório | `github.com/personal-support/geolynq` (privado). Branch de deploy `claude/bold-cray-vbbdyb` (é dela que o EasyPanel publica). A `main` só tem até o empacotamento da Fase 4.5 (merge do PR nº 1 em `b09ee7b`); **não tem** demo, B0, B1 nem CI. Em 2026-10-06 a branch de sessão `claude/keen-johnson-c0x5hs` recebeu um merge da `bold-cray` |
| Supabase (prod) | projeto `geolynq-prod`, ref `vshlsisnuaugeceafipt`, sa-east-1, URL `https://vshlsisnuaugeceafipt.supabase.co`. Projeto antigo `geolynq` (ca-central-1) está pausado |
| Tenant demo | slug `demo`, id `3596b3c6-8389-42af-b575-4bbdd69f2f2d` |
| VPS / DNS | Hostinger, IP `179.198.116.157`. DNS na Hostinger: A `*.geolynq` e A `geolynq` → IP da VPS (o curinga **não** cobre a raiz) |
| EasyPanel | `https://panel.personalsupport.tech` → projeto `personalsupport_saas` → app `geolynq_widget` (serve os 2 hosts: `widget.` e `demo.`; reorganizado em 2026-10-05, antes era projeto `geolynq` → app `widget`) |
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
- [x] **B0.3 — cadastro por CNPJ e importador v2 no n8n** (2026-10-02; detalhes, o que foi e o que NÃO foi verificado em `docs/b0-cadastro-por-cnpj.md` seção 7).
      Banco: `import_reseller` (upsert por tenant+CNPJ dentro do Postgres, só service_role; migration `20261003030000_b0_import_reseller.sql`). n8n (inativos, criados na conta do Junior):
      **Cadastro de Cliente por CNPJ** `toU5IgMP0wvoaE1b` (rodou de verdade em modo conferência contra a BrasilAPI com o CNPJ da New Millen, nada gravado) e **Import Catálogo v2 (CNPJ)**
      `vCFeM2DItVsorH5f` (lógica testada com dados simulados; 3 defeitos do v1 corrigidos). Planilha-modelo com colunas `cnpj` e `cnpj_revendedor`. **A New Millen continua NÃO cadastrada.**
      Limites do que foi provado: nenhum nó rodou ainda com credencial Supabase real, nem Google Sheets real, nem Nominatim a 1/s. Risco LGPD: histórico de execução do n8n guarda o quadro societário.

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
