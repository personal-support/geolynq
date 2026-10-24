<!--
  GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
  Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
  total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
  Unauthorized copying, replication, redistribution or commercial use is prohibited.
-->
# Status — GeoLynq

## Sessão de 2026-10-23/24 (Claude Code na web, branch `claude/tender-goodall-fmpm7m`) — LER JUNTO COM O RESTO
**Lição desta sessão:** ela começou lendo o `status.md` da `main` (velho) e tomou decisões erradas. **Sempre** conferir
`git log origin/*` e ler o `status.md` da `bold-cray`/`keen-johnson` primeiro. A `bold-cray` é a que o EasyPanel usa
(widget + site de amostra "Pódio") e contém a `keen-johnson`. Esta branch agora = `bold-cray` + este bloco.
- **Incidente do site de amostra (corrigido):** o domínio `demo.geolynq.personalsupport.tech` é servido pelo serviço
  `geolynq_widget` (um container, dois sites por host; ver `apps/widget/nginx.conf`). A sessão criou um serviço `geolynq_demo`
  com uma página simples e **moveu o domínio para ele**, substituindo o Pódio por ~1 h. **O usuário reverteu em 24/10**: o
  domínio voltou ao `geolynq_widget` (conferido pela API do EasyPanel). **Sobra o serviço `geolynq_demo`** (sem domínio
  próprio, só o `*.easypanel.host`): pode ser apagado no EasyPanel, e a deploy key `easypanel-geolynq-demo` pode ser
  removida em GitHub → Settings → Deploy keys. A chave SSH do EasyPanel é **por serviço**.
- **Queda da VPS Hostinger (23/10):** parou entre ~15:18 e 15:52 (BRT), sem causa registrada; religada e reiniciada pelo
  usuário; Traefik/EasyPanel/n8n/painel/landing voltaram 1/1; `geolynq_widget` ficou 0/1 e voltou ao **Implantar** pelo painel.
  Backup semanal da VPS: último 16/10.
- **Queda do banco (23/10), SEGUNDA do tipo (a 1ª foi 15–16/10):** `geolynq-prod` ficou Unhealthy; SQL deu timeout e depois
  `ECONNREFUSED`; voltou com **Restart project** no painel. Postgres subiu limpo (sem crash). Causa não confirmada.
  **O plano de 15/10 diz: se o grátis pausar de novo, reabrir a decisão do Pro** → candidato a gatilho. Decisão do usuário pendente.
- **n8n novo (VPS) PRONTO em 24/10:** credenciais criadas pelo usuário e ligadas pelo Claude: `Supabase account`,
  `Google Service Account account` (agora a conta de serviço **própria** `geolynq-importador@tiana-moda-afro.iam.gserviceaccount.com`,
  leitora da planilha e da pasta de teste; o `.json` fica guardado pelo usuário) e `Resend API key` (Bearer, só do GeoLynq).
  **Import v2 reexecutado 2×** em `fabrica-teste` (33 linhas, 0 falhas, `partial` só pelo aviso de foto `http://` do TST-002;
  sem duplicar). **Aviso de novo contato ATIVO** (versão `903e2819-…`, a cada 5 min, para `personalsupport@hotmail.com` e
  `danilo.coletivaweb@gmail.com`; HTML completo). Cadastro por CNPJ com credencial ligada, `gravar=false`.
  **n8n antigo pode sair do ar** (prazo 10–13/11): tinha 5 workflows, os 3 em uso já estão no novo; o v1 do importador não
  foi migrado de propósito; o `acervo-meishu-sama` foi **descartado pelo usuário** (cópia `.json` guardada por ele).
- **E-mail do aviso:** SPF, DKIM e DMARC passam (`compauth=pass`); o 1º e-mail caiu no lixo do Outlook.com (SCL 5, só reputação
  de domínio novo); depois de "Não é lixo" e remetente seguro não caiu mais. **Pendente:** o Danilo (Gmail) adicionar
  `avisos@personalsupport.tech` aos contatos.
- **Banco:** duplicata do `demo` apagada (revendedor "Farmácia Saúde Total" inativo, `814f5182-…`; demo com 11 revendedores).
  Anti-spam em `widget_events` **já existe** (trigger `widget_events_limit`: 20/min e 200/h por sessão, 600/min por tenant;
  `panel_ai_readings_limit`). Advisors de segurança: só itens conhecidos/baixo risco (`spatial_ref_sys`, `postgis` em `public`;
  `widget_get_tenant*` e `is_active_tenant` executáveis por `anon` é intencional).
- **Contas:** Drive/n8n = `gestao.junior.lopes@gmail.com`; **Vercel não é usado** (hospedagem = EasyPanel). Conector GitHub da
  sessão ficou com `invalid session` após a troca de conta (git por linha de comando funciona).
- **Monitor de disponibilidade (Fase 5 do plano) CRIADO e ATIVADO em 24/10 (≈02:55 UTC):** workflow n8n novo
  `n99RNNzlBSWDZs0Y` ("GeoLynq — Monitor de disponibilidade"). A cada 5 min confere 6 endereços: Supabase
  (`rpc/widget_get_tenant?p_slug=demo` com a chave publishable; exige `"slug"` na resposta), `widget…/healthz`, `widget…/v1/embed.js`,
  `demo…/`, `painel…/` e a landing (todos HTTP 200). Só avisa após **2 rodadas seguidas** com falha, avisa a volta ao normal e repete a cada
  3 h; e-mail pelo Resend (credencial `Resend API key`) para `personalsupport@hotmail.com`. Estado em static data (só persiste com o workflow
  ativo). Não guarda execuções bem-sucedidas (288/dia). **Testado manualmente:** execução 19 = 6 OK, nenhum aviso; execução 18 pegou um
  bug meu (o corpo da resposta vinha em `data`, não `body`), gerou 1 alerta falso (e-mail de teste enviado) e provou o caminho do e-mail;
  corrigido com `outputPropertyName: body`. **Limite honesto:** roda na mesma VPS do n8n, então **não avisa se a VPS inteira cair**: usar
  também um monitor externo gratuito (UptimeRobot, e-mail a cada 5 min) para a VPS e para `widget…/healthz`.
  **Validado em produção:** execução 22 (modo `trigger`, 03:00:35 UTC) rodou sozinha: 6 de 6 HTTP 200 com o conteúdo esperado, sem aviso. Depois da
  conferência o histórico voltou a `saveDataSuccessExecution: none` (só guarda execuções com erro). **Ainda NÃO visto em produção:** o ciclo de 2 falhas
  seguidas, aviso de volta ao normal e lembrete de 3 h (o estado só persiste com o workflow ativo).
  **UptimeRobot — 4 monitores no ar e todos Up (conferido pelo print do usuário em 24/10 ~00:10 BRT):** `widget…/healthz`, `n8n…/healthz`,
  `painel…/` e `geolynq.personalsupport.tech/` (landing), HTTP a cada 5 min, aviso por e-mail. Conta criada com o Gmail. O monitor do Supabase NÃO
  fica lá (exige cabeçalho com chave, que o plano grátis não oferece); essa checagem é do monitor do n8n. Os dois se cobrem: o UptimeRobot vigia o
  n8n e a VPS por fora; o n8n vigia o banco e os sites por dentro.
  **UptimeRobot (monitor externo) criado em 24/10:** o cadastro com `hotmail.com` foi recusado ("email domain is disposable"), usar o Gmail. Primeiro aviso
  real: `Connection Timeout` a partir da **Europa** em `widget…/healthz`, enquanto por dentro (n8n) estava 200 e a API da Hostinger dizia `running`:
  hipótese principal = falha pontual de rota; conferir o "is up again" e testar pelo celular com dados móveis. O plano grátis do UptimeRobot é, pelo
  que sei, de uso não comercial (conferir os termos; alternativa gratuita: Better Stack).
- **Branches unificadas em 24/10 (Fase 4 do plano, parte 1):** `main` avançou (fast-forward, sem conflito) de `b09ee7b` até este ponto: contém `keen-johnson`,
  `bold-cray` e este bloco. Antes de avançar foram conferidos nesta árvore: widget `typecheck` OK e 47/47 testes; painel `tsc`, `eslint` e `next build` OK (Next 16.3.8, o alerta
  crítico do 16.3.4 está resolvido); build do Pódio OK. **Não rodado:** E2E do painel (exige Postgres local, ver `supabase/tests/README.md`) e E2E do widget. **Parte 2 pendente
  (decisão do usuário):** apontar widget/demo, painel e landing do EasyPanel para a `main` (hoje: `bold-cray` e `keen-johnson`) e atualizar a regra de push do `CLAUDE.md`.
  Serviço `geolynq_demo` APAGADO em 24/10 (era do meu erro); sobra remover a deploy key `easypanel-geolynq-demo` no GitHub (Settings → Deploy keys).
- **New Millen — decisões de 24/10:** preço do piloto = **R$ 990,00/mês, 12 meses, implantação sem custo** (decisão do usuário; substitui os R$ 1.290 e o teto de R$ 1.000 dos docs antigos); território = **Brasil inteiro**;
  instalação do widget = **o próprio Danilo** (ele mantém o site institucional em WordPress/HostGator e a loja na Nuvemshop; o usuário também tem acesso à HostGator, mas quem mexe é o Danilo; sem senha do site para nós). **Decidido pelo usuário (24/10):** o widget entra **só no site institucional (WordPress), na página "Onde encontrar", que hoje usa o Gofind** (troca de ferramenta; a loja Nuvemshop fica fora). Plano: página rascunho com o Gofind ainda no ar, comparar lado a lado, trocar, e só cancelar o Gofind depois (a economia de R$ 610/mês depende disso). **Falta saber:** endereço da página, como o Gofind está colocado, fidelidade/aviso prévio do Gofind. Verificado no código: **sem trava por domínio**. Contrato (Anexo IV) e material comercial atualizados: `docs/apresentacao-new-millen.md` (resumo para o Danilo, roteiro da demo, mensagem pronta, checklist).
  **Atenção ao prazo:** 01/11/2026 é **domingo**; meta realista = ir ao ar na **sexta 30/10**, se a lista de revendedores com CNPJ chegar até segunda 26/10. A New Millen **continua NÃO cadastrada**.
  Pendências que travam: lista com CNPJ + plataforma da loja (aceita script?), contrato (licença Jucimar↔DCM, MEI, advogado), decisão Supabase Pro, usuário demo do painel para o Danilo.
- **PRIVACIDADE DA BUSCA + FILTROS DE PERÍODO — FEITOS NO CÓDIGO em 24/10 (commit desta entrada); BANCO JÁ APLICADO EM PRODUÇÃO; PAINEL E WIDGET AINDA NÃO PUBLICADOS.**
  **Privacidade (pedido "já faça a correção"):** (1) o widget **v2 já descartava** texto com cara de dado pessoal (`termForTelemetry`); o **v1 não** (era a origem dos 2 CEPs de 07/10) — a regra foi movida para `apps/widget/src/util.ts` e o v1 passou a usá-la (typecheck OK, 51 testes);
  (2) **gatilho no banco** `widget_events_sem_dado_pessoal` (migration `20261024020000`, APLICADO em produção e verificado com 3 eventos de teste: CEP e e-mail viraram NULL, nome de produto ficou) — vale para qualquer versão do widget e para chamadas diretas à API; limite conhecido: nome de pessoa não é detectável;
  (3) `privacidade.html` ganhou a seção "Serviços de terceiros que o seu navegador consulta" (ViaCEP e OpenStreetMap/Nominatim recebem CEP/coordenadas e IP) e a menção à Anthropic (leitura de IA); (4) **o painel sugeria o widget v1** no "Instalar no seu site" (`NEXT_PUBLIC_WIDGET_SCRIPT_URL` padrão `/v1/embed.js`): padrão trocado para `/v2/embed.js` (Dockerfile, env.ts, README) — mas se a variável de build estiver definida no EasyPanel ela manda; conferir no painel após publicar.
  Resíduo de teste em produção: 3 eventos `list_open` com `session_id = 'seed-test-priv-1'` no `demo` (01/08, enfeitam 1 passo do funil): apagar com `delete from public.widget_events where session_id = 'seed-test-priv-1';` no SQL Editor.
  **Filtros de período (pedido "pode implementar também"):** `lib/periodo.ts` (hoje, esta semana [segunda], semana passada, este mês, mês anterior, este ano, personalizado + 7/30/90; sem "ano anterior"; comparação com os MESMOS dias do período anterior; Brasília UTC−3), menu "Outros períodos" (sem JS, com `key` para fechar ao navegar; cabe no celular), série **por hora** em "Hoje"/dia único, URL `?p=…` (o `?dias=` antigo ainda vale), leitura de IA com a chave do período e **validade de 24 h** (`getUltimaLeitura`), CSV com o período no nome. Banco: funções novas `panel_overview_r/resellers_r/gaps_r/funnel_r` + coluna `panel_ai_readings.chave` (migration `20261024030000`, **APLICADA em produção**; as funções antigas ficaram intactas, o painel publicado hoje segue funcionando; comparado em produção com o usuário do Danilo: kpis, série, lacunas, funil, revendedores e lacunas IGUAIS às antigas em 30 dias).
  **Testes:** widget 51 ok; SQL local 13, 15, 16 ok (16 = equivalência com as funções antigas, hoje/mês/semana/mês anterior contra contagem direta, períodos inválidos, isolamento); lógica `periodo.test.mts` 21 ok; IA 25 ok; painel typecheck + lint + build ok; **E2E Chromium 122/122** (inclui períodos contra o banco, menu no celular, leitura de IA por período e validade). Dois defeitos achados e corrigidos pelo E2E: menu ficava aberto após escolher o período e saía pela borda no celular. Dois testes antigos do E2E estavam desatualizados (número reprovado agora aparece como diagnóstico na tela; seletor do botão de filtro) e foram ajustados.
  **IMPLANTADO E CONFERIDO em 24/10 (widget e painel):** o usuário implantou `geolynq_widget` e `geolynq_admin` e confirmou na tela: página de privacidade com a seção de terceiros; painel com "Outros períodos" (Este mês e Hoje funcionando, gráfico por hora em Hoje); "Widget no site" mostra `/v2/embed.js` (sem variável no EasyPanel sobrescrevendo); login do Danilo abre. Conferência no banco logo depois: eventos reais continuam chegando (7 nas últimas 3 h), **0 eventos com CEP/e-mail/telefone no texto**, os 2 gatilhos ativos (`widget_events_limit`, `widget_events_sem_dado_pessoal`), uma leitura de IA gravada com a chave nova (`mes`, dias=24; vale só 24 h), resíduo `seed-test-priv-1` já apagado pelo usuário, vínculos `demo:owner` e `demo:viewer`.
- **Auditoria de operação/telas/landing e correções (24/10, branch `tender-goodall`, commit `3c1165f` + painel reordenado; IMPLANTADO em 24/10 pelo EasyPanel (deployAppService) em `geolynq_admin`, `geolynq_landing` e `geolynq_widget`, que também serve o demo; branches `bold-cray` e `keen-johnson` avançadas para `a7acaad`; contêineres novos subiram, admin "healthy"; falta o usuário conferir na tela):** varredura de 180 medições (landing, demo, painel × 10 larguras de 320 a 1920 px): únicos estouros eram a 320 px (funil do painel: grade sem `minmax(0,1fr)`; roteiro do demo: palavra longa) — corrigidos e conferidos (painel E2E 125/125, com nova checagem a 320 px). Fontes de 11 px → 12 px no painel; botões de zoom do mapa 36 px; links do menu/rodapé da landing e do demo com área de toque maior; `lastmod` do sitemap 24/10; layout do painel mostra "Não conseguimos carregar o painel agora" quando a consulta de vínculo falha (antes dizia "conta sem marca"). **Painel: "Atividade ao vivo" (com "Quem gera contato") agora vem logo depois de "O que o radar achou"; no celular o feed mostra os 5 mais recentes (de 640 px para cima, os 10).** Para valer em produção: avançar `keen-johnson` (painel/landing) e `bold-cray` (demo) e o usuário clicar em Implantar. Não verificado: prévia real no WhatsApp e URLs públicas (sandbox não alcança). **Pedidos novos do usuário (24/10), em análise:** (1) sugerir candidatos a revendedor dentro de Lacunas (= Marco 2); (2) derivar os CNAEs de canal da planilha de revendedores do próprio cliente (CNPJ → CNAE medido).
- **Candidatos a revendedor (Marco 2, fatia 1) — CONSTRUÍDO E TESTADO LOCALMENTE em 24/10; NADA gravado em produção, NADA implantado:** migration `supabase/migrations/20261025000000_candidatos_a_revendedor.sql` (aditiva: `tenant_channel_cnaes`, `reseller_receita`, `reseller_candidates`; funções `propose_channel_cnaes`, `reseller_receita_resumo`, `panel_candidates`, `panel_candidate_status`), teste `supabase/tests/17_candidatos_a_revendedor.sql` (OK 17; 13, 15, 16 continuam OK), painel (cartão "Candidatos a revendedor" na tela Lacunas, por cidade, com andamento novo/contatado/vende/não vende/sem interesse; só owner/admin mudam; sem a migration o painel mostra "Em breve" e não quebra), E2E do painel 132/132, scripts da VPS `tools/receita/exportar_candidatos.py` e `cnae_dos_revendedores.py` (testes `python3 tools/receita/testes.py`, sem rede; a BrasilAPI real NÃO foi chamada) e `carregar_mes.sh` aceita `CNAES=` e `DB=` por cliente. Roteiro: `docs/candidatos-a-revendedor.md`. **Decisão do usuário (24/10):** os CNAEs de canal vêm dos CNPJs da planilha do próprio cliente (não guardar base de clientes futuros); a base da Receita é lida em fluxo por cliente. Ajustes meus: contar CNAEs principal + secundários sem repetir e propor só os com >= 5% da rede e >= 3 revendedores (a ordem dos secundários na Receita não indica relevância; não verificado), pessoa confirma, relatório visível do que ficou de fora. Privacidade: só dado de empresa, sem telefone/e-mail/razão social. **APLICADO EM PRODUÇÃO em 24/10 (pelo conector, em etapas, com OK do usuário):** `20261025000000_candidatos_a_revendedor.sql` e `20261025010000_candidatos_optout.sql` (tabelas `tenant_channel_cnaes`, `reseller_receita`, `reseller_candidates`, `candidate_optout`; 4+1 funções; RLS ligado; anon sem acesso; conferido pelo catálogo: só service_role escreve; `panel_candidates` e `panel_candidate_status` para authenticated). Tabelas vazias (nenhum candidato carregado ainda). Página de privacidade da landing ganhou a seção "Dados públicos de empresas (candidatos a revendedor)" com o pedido de exclusão por CNPJ (`candidate_optout`). **Pendente:** (1) ~~OK para aplicar a migration~~ feito; (2) Pódio: rodar passos 5-6 do roteiro com os CNAEs de suplementos (cnpj.db atual, 599.618) para a demo; (3) automação no n8n (hoje são scripts rodados na VPS); (4) candidatos no CSV de lacunas e na leitura de IA; (5) BrasilAPI com CNPJ alfanumérico e limite de consultas não testados.
  **BRANCHES AVANÇADAS em 24/10 (autorizado pelo usuário, fast-forward sem conflito):** `main`, `claude/bold-cray-vbbdyb` e `claude/keen-johnson-c0x5hs` agora apontam para `27649a6`. Falta só o usuário clicar em **Implantar** em `geolynq_widget` (publica da bold-cray) e `geolynq_admin` (publica da keen-johnson) no EasyPanel; o push NÃO publica sozinho. Depois conferir: página de privacidade com a seção de terceiros; painel com "Outros períodos"; "Widget no site" mostrando `/v2/embed.js` (se mostrar `/v1/`, a variável `NEXT_PUBLIC_WIDGET_SCRIPT_URL` está definida no EasyPanel e precisa ser corrigida).
  (histórico, antes do avanço) **PARA FICAR NO AR:** os serviços do EasyPanel publicam de `bold-cray` (widget/demo) e `keen-johnson` (painel/landing); este código está só em `claude/tender-goodall-fmpm7m` (= `main` + commits novos). Opções: avançar essas branches para este commit (fast-forward) ou apontar os serviços para a `main`; depois clicar em **Implantar** em `geolynq_widget` e `geolynq_admin`. Ordem: banco já está pronto; painel e widget podem ir em qualquer ordem.
- **Filtros de período do painel — DECISÕES do usuário (24/10), (IMPLEMENTADO, ver acima):** acrescentar, sem tirar 7/30/90 dias: Hoje, Esta semana, Semana passada, Este mês, Mês anterior, Este ano e Personalizado. **Semana começa na segunda.** **"Ano anterior" NÃO entra** (a retenção de 12 meses apagaria os dados; exigiria histórico agregado). Valem para Visão geral, Lacunas, funil, "Quem gera contato", CSV e leitura de IA (Catálogo/Rede/Importações não dependem de período). Plano: funções SQL novas com data inicial/final SEM substituir as atuais (`panel_overview/resellers/gaps/funnel` hoje recebem `p_days`), dias de calendário em America/Sao_Paulo, comparação "mesmos dias do período anterior" para períodos incompletos, personalizado limitado a 12 meses, UI como menu "Período" (os 3 botões atuais ficam), testes locais + E2E do painel antes de qualquer deploy. Prioridade: DEPOIS da lista da New Millen, da correção de privacidade da busca e do contrato/Supabase Pro (o usuário ainda não confirmou a ordem). **Leitura de IA:** continua só sob demanda (botão), sem geração automática; sugestão a implementar junto: não exibir leitura com mais de 24 h (hoje o painel mostra a última leitura do período, com a data). Existe 1 leitura antiga do `demo` (30 dias, 12/10 23:33, números antigos) — recomendado apagar (DELETE só pelo SQL Editor do usuário).
- **Usuário do Danilo no painel (criado em 24/10 a pedido do usuário):** `danilo.coletivaweb@gmail.com`, papel **`viewer`** só no cliente `demo` ("Pódio (demo)"). Criado por SQL (`auth.users` + `auth.identities` + `tenant_users`) com a MESMA estrutura do usuário original (conferido campo a campo: aud/role, confirmação, tokens vazios, metadados, hash bcrypt `$2a$` de 60 caracteres, identidade `email`); senha aleatória de 24 caracteres entregue ao usuário no chat e **não registrada aqui**; hash confere com a senha. **NÃO testado:** o login real pela tela do painel (peça ao Danilo ou teste no celular). Troca de senha: só pelo Dashboard do Supabase (o painel não tem "esqueci a senha"). Procedimento documentado no `apps/admin/README.md` continua sendo o oficial; esta foi uma exceção por SQL. **Ressalva:** o painel não usa o papel (só confere se o usuário é membro) e o schema indica que as políticas de escrita valem para qualquer membro do cliente; não conferi política por política. Para o `demo` (dados fictícios) é aceitável; antes de dar acesso a usuários da New Millen, revisar.
- **DEMO PÓDIO EXECUTADA EM PRODUÇÃO (24/10, conferida no banco):** (1) limpeza rodada pelo usuário no SQL Editor: tenant `fabrica-teste` apagado (cascata) e 2 eventos reais com CEP removidos; só existe o tenant `demo` (73 eventos reais restantes). (2) Gravados 3 lotes simulados pelo conector (script `supabase/tests/14_demo_podio_historico.sql`, prefixos `seed-pod-a-/b-/c-`; cada um desfaz com `delete from public.widget_events where session_id like 'seed-pod-a-%'`): **A** 26/07→07/08 (276 eventos), **B** 08/10→20/10 (556), **C** 21/10→23/10 (131, escolha do usuário "estender até 23/10"). Resultado nos 91 dias 26/07→24/10: **0 dia sem busca**, 3 a 39 buscas/dia, média 11,2, 1.022 buscas (985 simuladas, 37 reais), 392 cliques, subida gradual até a semana de 05/10. (3) Cliente renomeado para **"Pódio (demo)"** (`tenants.name`; slug `demo` inalterado; o nome aparece no cabeçalho e no seletor de clientes do painel; o widget não o usa). **Não verificado:** a aparência real do painel (não abri no navegador); a "leitura da IA" em cache do `demo` (1 linha em `panel_ai_readings`) é de antes e pode citar números antigos: regenerar pelo botão "Gerar nova leitura" (gasta API da Anthropic).
- **Decisões do usuário sobre a demo (24/10):** (a) na produção só deve existir a **Pódio** (demonstração) e, depois, a **New Millen** (dados dela só quando entrar); (b) a demo deve mostrar **90 dias** de histórico (maior período do painel; 90 dias antes de 24/10 = 26/07). **Plano (NADA gravado ainda, aguardando OK):** manter os simulados atuais (08/08→07/10) e **preencher** 26/07→07/08 (lote `seed-pod-a-`, n=110 buscas) e 08/10→20/10 (lote `seed-pod-b-`, n=220) com `supabase/tests/14_demo_podio_historico.sql` (datas fixas, só toca nas sessões do prefixo; testado localmente com cópia da rede Pódio `14a_rede_podio_local.sql`: janelas respeitadas, dados antigos intactos, trava de repetição OK, nenhum dia vazio, 64 lacunas + 27 buscas fora do catálogo). Sem DELETE de simulados. **Remover o que não é Pódio (DELETE só pelo SQL Editor do usuário):** tenant `fabrica-teste` (todos os 12 FKs para `tenants` são CASCADE: 1 perfil, 1 vínculo de usuário, 6 produtos, 10 revendedores, 21 vínculos de cobertura, 526 eventos, 6 importações, 1 leitura de IA) e 2 eventos reais do `demo` com CEP completo digitado no campo de busca. O Import v2 aponta por padrão para o tenant `fabrica-teste` (88a5496b…): trocar ao cadastrar a New Millen (o cliente novo nasce `trial`, o widget só serve `active`, então dá para importar com segurança antes de ativar).
- **ACHADO de privacidade (24/10), NÃO corrigido:** o widget grava em `widget_events.query_text` o que o visitante digitar (até 80 caracteres), só removendo caracteres especiais (`sanitizeSearchTerm`). Já existem 2 eventos reais com CEP completo no termo. Isso contradiz o texto de privacidade/contrato (CEP só com 5 dígitos, medição anônima). Correção possível no widget: descartar/mascarar termo que pareça CEP, telefone ou e-mail. Fica para a fase de "outras partes" (muda o código do widget).
- **Revisão da demo/painel (24/10, só leitura):** (1) cada busca concluída no widget grava evento (teste do usuário às 13:38 BRT gerou 3 eventos: catalog_search, product_select, search); limite silencioso de 20 eventos/min e 200/h por sessão; painel só atualiza ao recarregar. Das 39 buscas reais do `demo`, 27 têm cidade/coordenada (só essas entram em mapa/lacunas). (2) **O painel NÃO mostra potenciais clientes:** a tela Lacunas lista produto×cidade sem revendedor físico a até 100 km (com CSV) e diz "Em breve" para a lista de candidatos; a base da Receita (599.618) está só na VPS. (3) Dados simulados do `demo`: 08/08→07/10 (1.496 eventos, janela móvel de 60 dias do script 06/11, prefixo `seed-pod-`), mas o desejado é **01/10→20/10**; falta gerar 08→20/10 com datas fixas e apagar o que for anterior a 01/10 (DELETE só pelo SQL Editor do usuário). **Aguardando OK do usuário** para gravar. Painel só oferece períodos de 7/30/90 dias.
- **Demo × painel (conferido no banco em 24/10):** o site Pódio (`demo.geolynq…`) usa o cliente **`demo`** (ativo, 1 usuário de painel, 1.496 eventos simulados + 75 reais; último real 16:38 UTC). `fabrica-teste` está **trial** (o widget não o serve) e tem 526 simulados. O painel **não atualiza sozinho** (página renderizada no servidor, sem auto-refresh no código): é preciso recarregar. Roteiro da demo ajustado; falta criar usuário do painel para o Danilo no tenant `demo` (precisa do e-mail dele e do OK do usuário para gravar `tenant_users`).
- **Carga da Receita CONCLUÍDA em 24/10 (VPS, `~/cnpj/cnpj.db`, 142 MB, mês 2026-10):** 599.618 estabelecimentos ativos nos 10 CNAEs de suplementos (SP 141.709; MG 61.328; RJ 44.582; PR 42.202; RS 36.399).
  Por CNAE: 4729699 = 200.192 (33%, ruidoso), 4771701 = 111.699, 4619200 = 87.404, 9313100 = 84.362, 4763602 = 36.178, 4617600 = 31.135, 4639701 = 23.127, 4691500 = 9.970, 4771702 = 8.265, 4637199 = 7.286.
  Todos os 12 arquivos `completo=True`, 0 malformadas; ~20 min no total (Estabelecimentos0, 2,2 GB: 453 s). **1 CNPJ com letras** em `Estabelecimentos0` = primeiro caso real de CNPJ alfanumérico.
  Ainda nada da Receita foi para o Supabase (precisa de aprovação do usuário). Estimativa errada minha: previ 350–450 mil; deu 600 mil (o CNAE 4729699 pesa muito).
- **CNPJ alfanumérico — APLICADA EM PRODUÇÃO em 24/10 (banco pelo SQL Editor do usuário; n8n pelo conector). Confirmado:** `is_valid_cnpj('12ABC34501DE35')` = true, numérico = true, DV errado = false; os 3 CHECKs (`resellers_cnpj_check`, `tenant_profiles_check`, `tenant_profiles_cnpj_raiz_check`) com `[0-9A-Z]`. Import v2 (`8hXMMiLGaFTa8bw6`: nós Validar Revendedores e Validar Cobertura) e Cadastro (`gTDZOrphnSqujiux`: Validar Parâmetros) atualizados; Cadastro rodou em conferência (execução 337, gravar=false) com o CNPJ numérico da New Millen: OK. Import v2 não foi executado após a mudança (lógica testada em node com 12 casos). **Falta painel (rede/page.tsx) publicar.** Histórico da correção: `supabase/migrations/20261024010000_cnpj_alfanumerico.sql` (validação com letras, 3 CHECKs, `provision_tenant`, `import_reseller`),
  `supabase/tests/13_cnpj_alfanumerico.sql` (OK 13 no Postgres local: exemplo oficial 12.ABC.345/01DE-35, 40 vetores independentes, 20 mil numéricos iguais à função antiga; testes 05 e 09 seguem OK),
  e código dos nós em `docs/n8n-geolynq-import-catalogo-v2.workflow.ts` e `docs/n8n-geolynq-cadastro-cliente.workflow.ts` (testado em node: 12 casos), formatação no painel (`rede/page.tsx`).
  **Para valer em produção:** (1) usuário roda a migration no SQL Editor (tem DROP CONSTRAINT); (2) atualizar os 2 workflows no n8n novo (Import v2 `8hXMMiLGaFTa8bw6`, Cadastro `gTDZOrphnSqujiux`); (3) publicar o painel. Ordem: banco antes do n8n.
  **Não verificado:** a fonte oficial (gov.br) não foi aberta; regra conferida por notícias + exemplo; **BrasilAPI aceitar CNPJ alfanumérico não foi testado** (o Cadastro por CNPJ depende dela).
- **Fase 2 (privacidade, retenção, contrato) — 2.1, 2.2, 2.3 FEITAS e 2.4 em RASCUNHO (24/10).** **2.4:** minuta em `docs/contrato-minuta-prestacao-servico.md` (parte A = 9 pontos de atenção; parte B = cláusulas 1–14 e anexos I–V). NÃO é versão final: preços em branco, falta cadeia de licença Jucimar↔DCM, conferir limite do MEI da DCM e revisão jurídica antes de assinar.
  (2.3 foi publicada no commit 10c3963.)
  **2.1 APROVADA pelo usuário em 24/10:** contatos da landing 30 dias; eventos individuais do widget 12 meses; base legal = legítimo interesse da marca (LGPD art. 7º, IX) com
  aviso e opção de recusar; contato = `personalsupport@hotmail.com`. O usuário optou por não levar a página a advogado (o plano recomenda revisão antes de assinar contrato com a New Millen).
  **2.2 APLICADA EM PRODUÇÃO em 24/10** (extensão `pg_cron` 1.6.4, `retencao_simular()` pelo conector; `retencao_limpar()`, `revoke` e `cron.schedule` pelo SQL Editor do usuário):
  job `retencao-geolynq` ativo, `17 6 * * *` (06:17 UTC = 03:17 BRT); funções `security definer` sem execução para `anon`/`authenticated` (conferido). Simulação em 24/10: 0 a apagar
  (leads 1, widget_events 2.093). **Primeiro disparo a conferir:** `select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;`. O contato de 13/10
  será apagado na execução de 12–13/11. **Aviso:** como o painel calcula os relatórios a partir de `widget_events`, depois de 12 meses esse histórico some (nada passa disso hoje).
  **2.3 FEITA no repositório:** `apps/widget/public/privacidade.html` sem `[a definir]` e sem o banner "em revisão" (texto só diz o que o sistema faz; não promete agregados guardados no banco).
  **Para publicar:** o serviço `geolynq_widget` publica da `bold-cray`; precisa avançar a `bold-cray` até aqui (é ancestral, fast-forward) ou apontar o serviço para a `main`, e implantar.
- **Fase 3 (B0.5, base da Receita) — acesso DESCOBERTO em 24/10:** o caminho do plano (`.../dados/cnpj/dados_abertos_cnpj/`) devolve 404 (o site é um Nextcloud "SERPRO+": qualquer caminho
  inexistente cai na tela do aplicativo; o sandbox leva 403 nesse host, então testar sempre pela VPS). **Caminho que funciona:** compartilhamento público
  `https://arquivos.receitafederal.gov.br/index.php/s/gn672Ad4CF8N6TK?dir=/Dados/Cadastros/CNPJ` (indicado pelo usuário). Listagem por WebDAV, **verificada na VPS**:
  `curl -s -u 'gn672Ad4CF8N6TK:' -X PROPFIND -H 'Depth: 1' https://arquivos.receitafederal.gov.br/public.php/webdav/Dados/Cadastros/CNPJ/` (usuário = código do compartilhamento, senha vazia; HTTP 207).
  Há **uma pasta por mês de `2023-08/` a `2026-10/`** e um arquivo solto `cnpj.tar.gz` (tamanho ainda não visto). **Próximo (3.1, parte 2):** listar nomes e tamanhos dos arquivos de `2026-10/`
  (e decidir como ler em fluxo, um arquivo por vez; disco livre da VPS ~62 GB). Nada foi baixado. **CNPJ alfanumérico:** notícias de jul/2026 (fontes de terceiros, não oficiais) falam em novos CNPJs com
  letras a partir de 31/07/2026; o Import v2 e o Cadastro por CNPJ validam só dígitos (`replace(/\D/g, '')` e dígito verificador numérico) e precisarão aceitar letras (12 primeiras posições
  alfanuméricas; 2 dígitos verificadores com o valor ASCII menos 48). Conferir na fonte oficial antes de mexer. Detalhe: o dado da Receita vem em CSV sem cabeçalho, separador `;`, latin-1 (fonte de terceiros).
- **Fase 3 — tamanhos MEDIDOS de `2026-10/` (24/10, pela VPS):** `Estabelecimentos0..9.zip` ≈ **5,2 GB no total** (o `0` tem 2,17 GB; os outros ~320–350 MB), `Empresas0..9.zip` ≈ 1,3 GB,
  `Socios0..9.zip` ≈ 0,66 GB (NÃO usar: dado pessoal), `Simples.zip` ≈ 0,3 GB, tabelas pequenas (`Cnaes`, `Municipios`, `Naturezas`, `Motivos`, `Paises`, `Qualificacoes`) < 0,1 MB.
  Arquivo solto `cnpj.tar.gz` ≈ **61 GB** (não usar). Para o recorte basta `Estabelecimentos` + `Municipios` + `Cnaes` (+ `Empresas` numa 2ª passada só para as raízes que sobrarem): ~6,5 GB a baixar,
  com pico de disco de ~2,2 GB se o zip for salvo, ou ~0 se for lido em fluxo (`curl | funzip`). Disco livre da VPS ~62 GB. Esse volume é bem menor que a estimativa do plano (~85 GB descompactado,
  que continua NÃO medido). Segmento `suplementos` tem 10 CNAEs de canal (4729699, 4617600, 4637199, 4763602, 4771701, 4619200, 4639701, 4691500, 4771702, 9313100, pesos 1–3); o tenant
  `fabrica-teste` tem territórios UF RJ e SP. **Decisão pendente do usuário (3.4):** onde guardar o universo filtrado (Postgres na VPS, arquivo SQLite na VPS, ou direto no Supabase, que não cabe).
- **Fase 3 — carregador da base da Receita PRONTO e TESTADO COM DADOS SINTÉTICOS (24/10); ainda NÃO rodado com dados reais.** Decisão do usuário (3.4): **opção B, arquivo SQLite na VPS**
  (sem Postgres novo). Descoberta: o console do EasyPanel que o usuário usa é de um **container** (`/ #`) **sem** `funzip`, `unzip`, `iconv`, `python3`, `sqlite3` nem `psql`; disco 78 GB livres, ~6 GB de RAM livres.
  Por isso o carregador é **Python puro (só `python3` + `curl`)**: `tools/receita/carregar_arquivo.py` (lê um zip em fluxo da entrada padrão, descompacta com `zlib`, nunca grava zip/CSV em disco; filtra
  situação ativa `02` + CNAE principal de canal; modos `estabelecimentos|municipios|cnaes`; `--amostra N` mostra só campos técnicos) e `tools/receita/carregar_mes.sh AAAA-MM teste|tudo`.
  **Minimização de dados:** NÃO guarda telefone, e-mail, sócios nem razão social (só nome fantasia, endereço e CNAE). **Testes sintéticos (30.003 linhas, zip em fluxo com descritor de dados e zip64, latin-1,
  `;` dentro de aspas, CRLF, linha quebrada, CNPJ com letras, fronteiras de bloco de 512 B a 1 MB, download cortado = aviso + código 2, entrada não-zip = erro claro, script de ponta a ponta contra
  servidor local falso): todos passaram.** **Confirmado com dados REAIS em 24/10 (terminal da VPS, `Estabelecimentos1.zip` de 2026-10, `--amostra 3`):** 30 campos por linha; CNPJ em 3 partes; situação, CNAE, UF, município e CEP nas posições esperadas;
  leitura em fluxo de um trecho cortado funciona; VPS tem Python 3.12.3, curl e bash, 78 GB livres. `Cnaes.zip` = 1.359 linhas e `Municipios.zip` = 5.572 linhas carregadas sem erro. Nas 3 amostras o CNPJ só tinha dígitos
  (CNPJ com letras ainda NÃO visto na prática). **TESTE REAL CONCLUÍDO em 24/10 (terminal da VPS, `bash carregar_mes.sh 2026-10 teste`):** `Estabelecimentos1.zip` (326 MB) = **4.753.435 linhas lidas, 27.925 gravadas (0,59%), 0 malformadas, 0 CNPJ com letras, 70 s, banco com 7,1 MB**, `TUDO OK`. Por CNAE (neste arquivo): 4729699 = 7.267; 4771701 = 7.015; 4619200 = 4.283; 9313100 = 3.572; 4617600 = 1.772; 4763602 = 1.285; 4639701 = 1.267; 4771702 = 631; 4691500 = 458; 4637199 = 375. Por UF (top): SP 6.798, MG 2.895, RJ 2.218, PR 2.202, RS 2.019. **EXTRAPOLAÇÃO (não medida):** ~68 mil linhas/s; os 10 arquivos somariam ~74 milhões de linhas e uns ~18 min; ~435 mil estabelecimentos gravados e ~110 MB de banco (o arquivo 0 tem 2,2 GB e pode ter outra distribuição). **Próximo:** rodar `tudo` com `nice` e `nohup` (ver comando no chat). Rodar no **terminal da VPS (hPanel → Terminal do navegador)**, NÃO no console do container. Antes do `tudo`, rodar `teste` (só `Estabelecimentos1.zip`, 326 MB) e conferir tempo, linhas e tamanho.
- **Página de privacidade do widget PUBLICADA em 24/10:** o usuário clicou em Implantar; o EasyPanel confirma `geolynq_widget` no commit `10c3963` (contém a página nova) e 1/1. O EasyPanel **não redeploya sozinho** ao
  empurrar na branch: sempre pedir Implantar. Falta só o usuário olhar `https://widget.geolynq.personalsupport.tech/privacidade.html` (o sandbox não alcança o domínio).
- **Próximos passos restantes (Fase 5 do plano = Operação):** (1) ativar o monitor acima e criar o monitor externo (UptimeRobot), (2) decisão sobre o Supabase Pro, (3) Fase 2 (retenção `pg_cron`, página de
  privacidade do widget, contrato), (4) Fase 3 (B0.5, base da Receita), (5) Fase 4 (unificar branches em `main`).

## Última atualização
**2026-10-15 — retomada + PLANEJAMENTO (nada executado).** Plano completo, decisões do usuário, fatos verificados e pendências em
**`docs/plano-2026-10-15.md` — LER ANTES DE QUALQUER COISA.** Resumo:
- **FASE 0 CONCLUÍDA (2026-10-16): o banco ficou FORA DO AR ~24,5 h e já voltou.** O log do Postgres registrou desligamento em 2026-10-15 15:45 UTC e nenhuma linha até hoje; `pg_postmaster_start_time()`
  = **2026-10-16 16:10:26 UTC** (religado). A API de gestão dizia `ACTIVE_HEALTHY` o tempo todo e **recusou** `restore_project` ("não está pausado... pode demorar a restaurar"); a religação aconteceu minutos depois
  desse pedido, **mas não dá para provar que foi ele** (pode ter sido a plataforma/outra pessoa). **Causa NÃO confirmada.** Prova de que voltou: teste do usuário na VPS, `widget_get_tenant('demo')` = HTTP 200 em 1,7 s;
  SQL pelo conector voltou a funcionar. **Integridade conferida:** tenants `demo:active` e `fabrica-teste:trial`; 18 produtos, 22 revendedores, 22 endereços, 2.091 eventos, 1 lead; 17 de 18 tabelas com RLS
  (a exceção é `spatial_ref_sys`, conhecida); as 7 funções-chave existem; banco com **21 MB** (4 % dos 500 MB do plano grátis). Último evento do widget: 13/10 (ninguém registrou nada durante a queda; não há como saber se houve visitas perdidas).
  **Lição:** ninguém percebeu 24 h de queda → falta um monitor externo (Fase 5 sobe de prioridade: ping a cada 5 min no `widget_get_tenant`; não exige Supabase Pro). Decisão do usuário de adiar o Pro continua valendo.
- **Decisões do usuário (15/10):** não trocar para Supabase Pro por ora; **implantar o B0.5** (base da Receita para o mapa de lacunas); **migrar o n8n para a VPS**, compartilhado,
  em `n8n.personalsupport.tech` (projeto EasyPanel novo `automacoes`); seguir com privacidade/contrato (parte contratante = **DCM Marketing Digital**). Chaves expostas: "tá tudo bem".
- **Ordem:** Fase 0 banco → Fase 1 n8n novo (prazo duro 10–13/11; meta ~25/10) → Fase 2 retenção (`pg_cron`), página de privacidade do widget (4 trechos "[a definir]") e minuta de contrato →
  Fase 3 B0.5 (primeiro passo = comando de leitura da lista de arquivos da Receita, pendente) → Fase 4 unificar branches → Fase 5 operação.
- **Pendentes do usuário:** estado do Supabase; comandos de DNS e da Receita (no plano); aprovar valores da Fase 2.1 e a direção "universo da Receita na VPS, resumo no Supabase" (o Supabase grátis tem 500 MB).
- **Correção:** a migration do funil **está aplicada** (não é risco). A `bold-cray` e a `keen-johnson` estavam divergentes: a `keen-johnson` é a mais atual; nesta sessão a `bold-cray` foi avançada até ela.
- **FASE 1 (n8n novo) EM ANDAMENTO (2026-10-16):** o EasyPanel **recusou criar o projeto `automacoes`** ("não é permitido criar mais projetos"; a conta tem 3, parece limite do plano). Criado o serviço **`n8n` dentro de `personalsupport_saas`** (imagem `n8nio/n8n:2.43.7` **fixada**, volume `n8n_data` em `/home/node/.n8n`, 1 vCPU / 1 GB, `zeroDowntime=false` por usar SQLite; env: `N8N_HOST`, `N8N_PROTOCOL=https`, `WEBHOOK_URL`, `N8N_PROXY_HOPS=1`, fuso São Paulo, diagnósticos off, **histórico de execuções apagado em 7 dias**; a chave de criptografia NÃO foi definida: o n8n gera e guarda no volume). Container `running`, **sem domínio e sem porta publicada** (ninguém de fora acessa). **DNS conferido pelo usuário: `n8n.personalsupport.tech` NÃO resolve** (e não há curinga na raiz): falta criar o registro **A `n8n` → 179.198.116.157** na Hostinger; só depois adicionar o domínio no EasyPanel (`createDomain`, porta 5678, HTTPS) e **o usuário abrir na hora para criar a conta de dono** (quem abre primeiro vira dono). Os 3 workflows do n8n antigo foram **lidos e comparados** com os `.ts` do repositório: estão em dia (inclusive foto do produto, avisos de endereço e 7 entradas no consolidador). Pendência do robô de aviso: a credencial Bearer do Resend nunca foi criada no antigo; criar direto no novo.
- **FASE 1 — ATUALIZAÇÃO (2026-10-16, tarde):** DNS criado pelo usuário, domínio ligado no EasyPanel (`n8n.personalsupport.tech`, https, porta 5678), **conta de dono criada** (n8n 2.43.7). O Chrome mostrou "Site perigoso" (falso positivo do Safe Browsing em domínio novo; Edge/anônima funcionam; pedir revisão em safebrowsing.google.com/safebrowsing/report_error). Conector Claude do novo n8n = **`n8n-novo`** (`mcp__n8n-novo__*`); o antigo continua em `mcp__n8n__*`. **Edição do n8n não tem "Projects"** (não licenciado): a separação por projeto prevista no plano não existe.
  **3 workflows recriados no n8n novo (INATIVOS, 0 credenciais):** Cadastro `gTDZOrphnSqujiux` (testado em modo conferência: resultado idêntico ao antigo, nada gravado), Aviso `nhiCkFN9GAllOdsJ`, Import v2 `8hXMMiLGaFTa8bw6`. No antigo seguem ativos/intactos: Cadastro `toU5IgMP0wvoaE1b`, Import v2 `vCFeM2DItVsorH5f`, Aviso `nDNHVHxurPRqu2h5`. **Falta:** credenciais (Supabase service_role, conta de serviço Google, Resend Bearer) digitadas pelo usuário; ligar aos nós; testar Import v2 em `fabrica-teste` (reimportar sem duplicar) e Aviso com contato fictício; backup do `acervo-meishu-sama`; só então desligar o antigo (prazo 10–13/11). O `.ts` do Aviso no repositório está incompleto (código de "Montar aviso" é placeholder); o real está no n8n novo.
- **Falha minha a não repetir:** chamei `listProjectsAndServices` do EasyPanel antes de ler este arquivo e expôs variáveis de ambiente de outros projetos. Regra agora também no `CLAUDE.md`.

*(Bloco anterior)* 2026-10-06 — **retomada + auditoria de infraestrutura** (só leitura; nada gravado em produção). Ver
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

## Landing page do GeoLynq (2026-10-13) — **PUBLICADA NO EASYPANEL (container saudável); acesso público e HTTPS ainda NÃO conferidos por mim**
- Pasta `apps/landing/` (ver o README dela). Hero com imagem gerada, responsiva (testada em 375, 768 e 1440 px, sem rolagem lateral),
  SEO técnico, dados estruturados (FAQPage etc.), `llms.txt` e `robots.txt` liberando robôs de IA, prévia de WhatsApp (Open Graph, imagem de 64 KB)
  e botão "Compartilhar no WhatsApp". Preço: "sob consulta". Texto provisório (o comercial é do Danilo).
- Testado: HTML/JS sem erro no console; nginx real (versão 1.24 local; no Docker será 1.27) com rotas, cache e CSP; formulário com endpoint simulado
  (envio, e-mail inválido, sem aceite, robô, 2 envios seguidos, erro do servidor). **Não testado:** envio real ao Supabase (o sandbox não alcança), Lighthouse,
  Rich Results Test e a prévia real no WhatsApp (só depois de publicar).
- **Quem é quem (decisão do usuário, 2026-10-13):** quem **comercializa** o GeoLynq e emite nota fiscal é a **DCM Marketing Digital** (MEI de Danilo Carlos Machado, CNPJ 52.721.470/0001-48,
  Praia Grande/SP). O desenvolvedor é Jucimar Alves Lopes (pessoa física). Nos textos públicos (landing, privacidade, `llms.txt`, dados estruturados) onde constava "Personal Support" agora consta
  "DCM Marketing Digital". O **painel** e o **demo** não traziam o nome da Personal Support em nenhum texto visível (nada a trocar). Os endereços `personalsupport.tech` e o projeto `personalsupport_saas`
  do EasyPanel **não mudaram**. Contato público ainda é `personalsupport@hotmail.com` (formulário e privacidade) — trocar quando o usuário definir o e-mail da DCM. Contrato com a New Millen: pendente
  (a parte contratante será a DCM). **Nunca** colocar CPF no repositório (é público).
- **Publicação (2026-10-13):** serviço `geolynq_landing` (projeto `personalsupport_saas`), origem Git por HTTPS (`https://github.com/personal-support/geolynq.git`, branch
  `claude/keen-johnson-c0x5hs`, contexto `/apps/landing`, Dockerfile `Dockerfile`), domínio `geolynq.personalsupport.tech` com HTTPS, porta 80, 128 MB. Container `running (healthy)`
  conferido via EasyPanel. **Não verificado daqui:** abrir o site pelo domínio (o sandbox não alcança), certificado HTTPS e a prévia no WhatsApp. Deploy **manual** (autoDeploy
  desligado): depois de empurrar mudanças em `apps/landing`, rodar `deployAppService` (destrutivo) em `geolynq_landing`. O repositório é **público** (por isso o clone HTTPS dispensa chave).
- **Achado no banco (somente leitura):** `leads` tem RLS e 0 linhas, mas `anon`/`authenticated` têm todos os privilégios (inclusive TRUNCATE) e o INSERT
  público aceita `status` e textos sem limite. Correção pronta em `supabase/migrations/20261013000000_leads_landing.sql` (testada em Postgres local, idempotente) —
  **APLICADA EM PRODUÇÃO em 2026-10-13** (conferido no catálogo: anon sem SELECT/UPDATE/DELETE/TRUNCATE; só INSERT em nome, empresa, e-mail, telefone e mensagem; constraints e `notified_at` criados; `leads` continua com 0 linhas). O arquivo do repositório é a versão aplicada (sem `DO $$`/`DROP`, não reaplicar). **Não testado:** um INSERT real como `anon` pela API (o sandbox não alcança o Supabase).
- **Aviso de novo contato (n8n) — CRIADO, INATIVO, NÃO TESTADO DE PONTA A PONTA (2026-10-13).** Workflow `nDNHVHxurPRqu2h5` ("GeoLynq — Aviso de novo contato (landing)",
  fonte em `docs/n8n-geolynq-aviso-contato.workflow.ts`): a cada 5 min lê `leads` sem `notified_at`, manda 1 e-mail (Resend) para personalsupport@hotmail.com e
  danilo.coletivaweb@gmail.com e só depois marca `notified_at`. O código que monta o e-mail foi testado à parte (escapa HTML, junta vários contatos). **Falta:** (migration já aplicada) criar no n8n a credencial "Bearer Auth" com a chave do Resend e ligá-la ao nó "Enviar e-mail", confirmar o remetente
  `avisos@personalsupport.tech` no Resend, rodar 1 teste com contato fictício e então ativar. **WhatsApp: não implantado** (não há Evolution API na VPS do EasyPanel nem credencial no n8n; definir onde ela roda).
- **Pendências para publicar:** (1) ~~aplicar a migration~~ (feito); (2) ~~criar o serviço no EasyPanel + domínio~~ (feito; falta conferir no navegador);
  (3) aviso de novo contato por n8n (não existe; a migration já cria `notified_at`); (4) revisão jurídica de `privacidade.html`;
  (5) Danilo revisar o texto; (6) Search Console e Google Business.

## Aviso de autoria e direitos reservados (2026-10-13) — NO REPOSITÓRIO E NA LANDING NO AR; widget/painel/demo ainda não
- Pedido do usuário: todo arquivo deve mostrar que **Jucimar Lopes (Personal Support)** desenvolveu o sistema e que cópia, réplica ou comercialização sem autorização são proibidas — **sem
  mudar nada do funcionamento**. Feito **só com comentários**: `LICENSE` (direitos reservados, exceção para a DCM condicionada a acordo escrito, componentes de terceiros fora do aviso),
  `README.md` na raiz, cabeçalho de 4 linhas em 135 arquivos (`/* */` em TS/TSX/JS/CSS, `#` em Dockerfile/nginx/YAML/.gitignore/.env.example/robots.txt, `--` em SQL, `<!-- -->` em HTML/XML/Markdown;
  `llms.txt` leva o aviso no fim porque o formato exige o título na 1ª linha), `author`/`license: UNLICENSED` nos 4 `package.json`, comentário no modelo de página do demo (`build.mjs`) e uma
  linha de aviso (só ASCII) no topo de `v1/embed.js` e `v2/embed.js`, inserida por plugin no `vite.config*.ts` **depois** da minificação.
- **Ficaram sem aviso** (não aceitam comentário ou editar quebraria algo): JSON de dados (`brand.json`, `products.json`, `tsconfig.json`, `package-lock.json`), imagens, fontes, `.xlsx` e `.tsv`
  (as planilhas-modelo são lidas pelo n8n). Cobertos pelo `LICENSE`. A UI (landing, painel, widget) **não** ganhou texto visível; a landing continua com a identidade da DCM.
- **Prova de que nada mudou:** cada arquivo alterado = original + aviso, conferido byte a byte contra o git (132 arquivos; os outros 7 foram revistos no diff); widget: tipos OK, 47 testes OK,
  código dos dois bundles idêntico ao anterior (só ganharam a 1ª linha); painel: tsc, eslint e build OK, 42 de 46 arquivos do build com hash idêntico (os 4 restantes mudam a cada build do Next,
  provado ao construir duas vezes o mesmo código) e 25 testes de IA OK; demo: 33 arquivos, 17 HTML só ganharam o comentário, 15 idênticos, `styles.css` = antes + comentário;
  `nginx -t` OK nos dois `nginx.conf`; landing servida por nginx real: rotas, tipos, cabeçalhos de segurança e os 6 cenários do formulário iguais, sem erro no console (375 e 1440 px).
  **Não rodado:** E2E do widget e do painel (precisam de Postgres/PostGIS local), build dos Dockerfiles (sem Docker no sandbox).
- **Publicação:** commit `11294b9` na `claude/keen-johnson-c0x5hs`; `geolynq_landing` republicada em 2026-10-13 (container `Up, healthy`, conferido via EasyPanel; site pelo domínio não conferido daqui). O **widget no ar NÃO foi tocado**
  (o serviço `geolynq_widget` publica da `claude/bold-cray-vbbdyb`): o banner nos bundles só chega ao ar quando essa branch receber estes commits. Painel e demo não estão no ar com esta mudança.
- **Imagem de compartilhamento (WhatsApp) refeita em 2026-10-13:** a antiga (`og.jpg`) era só o mapa e tinha uma faixa preta à esquerda. A nova, `assets/og-v2.jpg` (1200x630, 92 KB), leva marca, título e endereço.
  Prévia no WhatsApp já mostrava título, descrição e domínio (conferido pelo usuário em captura). Nome novo de propósito: o WhatsApp guarda a prévia em cache por link.
- **Página de privacidade (2026-10-13):** o aviso "texto-base em revisão" saiu e a seção "Onde ficam e por quanto tempo" ficou definida: Supabase em São Paulo (`sa-east-1`, conferido no projeto), guarda de **30 dias** (decisão do usuário),
  fornecedores citados (Supabase e Resend, que pode processar fora do Brasil). **PENDENTE: o apagamento em 30 dias ainda NÃO existe** (nenhum job apaga `leads`); a página promete isso. Plano: `pg_cron` do Supabase (extensão disponível, não instalada),
  1 job diário `delete from public.leads where created_at < now() - interval '30 days'` — precisa de OK do usuário (grava em produção). A página segue `noindex` e **sem revisão jurídica** (o usuário optou por não levar a advogado).
- **Regra daqui em diante:** arquivo novo leva o mesmo cabeçalho (texto em `CLAUDE.md`). Notar: o repositório no GitHub é **público** — o aviso não impede cópia; para isso, repositório privado
  (cuidado: o clone HTTPS sem chave da landing no EasyPanel deixaria de funcionar; precisaria de chave de deploy) e/ou registro do programa no INPI.

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
  **Ideias aprovadas:** faixa "Dados de demonstração" e aviso "base pequena" → **feitos** (ver abaixo). **Feitos em 2026-10-07:** busca sem acento e limite de eventos (ver abaixo).
- **Faixa "Dados de demonstração" + aviso "Base pequena" (feitos em 2026-10-06, só no painel, sem mudar o banco):**
  - Faixa amarela no topo de todas as telas quando o tenant tem eventos com `session_id` `seed-…` (simulados). Mostra a contagem real
    ("Todos os N eventos…" ou "X de N eventos…"). Some sozinha quando os simulados forem apagados; o `demo` não mostra (não tem simulados).
    Código: `components/avisos.tsx`, `lib/data.ts` (`getEventosSimulados`, 2 contagens HEAD sob RLS), `app/dashboard/layout.tsx`.
  - Aviso "Base pequena" na visão geral e em lacunas quando o período tem menos de **30 buscas** (`lib/avisos.ts`, `LIMITE_BASE_PEQUENA`);
    sugere 90 dias quando o período é menor; na comparação com o período anterior avisa "pouco confiável" se o anterior tem < 30.
  - **Defeito achado ao revisar a captura e corrigido:** quando NENHUMA busca do período identificava produto (ex.: 5 buscas fora do
    catálogo), a manchete e os cartões "Maiores lacunas" diziam "Todas as buscas com produto encontraram revendedor" (falso por vazio).
    Agora a manchete diz "Nenhuma das N buscas bateu com um produto do catálogo" e os cartões dizem "Sem dados para medir lacunas".
  - **Publicado (2026-10-07):** commit `aeb844b` redeployado em `geolynq_admin`; contêiner novo `running` e `healthy` (conferido no EasyPanel; a tela em si só o usuário vê, o domínio dá 403 no proxy daqui).
  - E2E em Chromium agora **52/52** (`next start` e standalone). Limiar de 30 é uma hipótese; ajustar com dados reais.
- **Itens 3 e 4 — precisão com dados reais (2026-10-07, com OK do usuário):** migration `20261007000000_busca_sem_acento_e_limite_eventos.sql`.
  - **Busca sem acento:** RPC `widget_search_products` (+ `norm_busca`, só `translate`, sem extensão). "PROTEINA" acha "Proteína"; `%` e `_` são
    literais; SECURITY INVOKER (RLS pública vale). Widget (`apps/widget/src/api.ts`) usa a RPC e, se ela falhar, cai na consulta antiga (`ilike`).
  - **Limite de eventos:** trigger `widget_events_limit` em `widget_events` (SECURITY DEFINER; papel lido de `current_setting('role')`):
    para `anon`/`authenticated` força `created_at = now()` e DESCARTA em silêncio o evento acima de 20/min e 200/h por `session_id` e 600/min por
    cliente. `service_role`/postgres não são limitados (importação e simulados continuam). Limites são hipóteses; ajustar na função.
    **Limite conhecido:** robô que troca de `session_id` a cada evento só é barrado pelo teto do cliente; por IP exigiria guardar IP (LGPD) ou WAF.
  - **Testes:** `supabase/tests/05_*.sql` no Postgres local (OK 05; controle negativo: com o trigger desligado o teste falha); widget 24 testes
    unitários (3 novos) e E2E 48/48 (3 novos: sem acento, sanitização, fallback).
  - **Aplicado na produção (`geolynq-prod`) em 3 partes:** funções + trigger. Conferido lá: trigger ativo (1), `created_at` forjado de 40 dias
    virou agora, busca "PROTEÍN" como `anon` achou 3 produtos do `demo`; transação de prova desfeita (0 sobras; `widget_events` segue com 535).
  - **Widget publicado (2026-10-07, com OK do usuário):** push fast-forward `b2c2c88..2e13330` na `claude/bold-cray-vbbdyb` depois de typecheck, 24
    testes e E2E 48/48 limpos. O webhook subiu um contêiner novo do `geolynq_widget` (visto no EasyPanel: `running`, "Up about a minute").
    **Não verificado daqui:** o bundle servido em `widget.geolynq…` (o proxy da nuvem dá 403 nesses domínios) e a busca real no site de demonstração:
    1º teste real é do usuário (digitar "proteina" no demo https://demo.geolynq.personalsupport.tech).
- **Site demo "Pódio" refeito (2026-10-07, pedido do usuário; NÃO publicado — falta OK para push na `bold-cray`):** o demo tem que parecer o site real de um
  fabricante (o cliente se identifica; a apresentação tem 2 ritmos: 1) o consumidor usa o site, 2) a equipe comercial vê a plataforma). `apps/demo`:
  visual de marca (hero, grade única de 12 produtos com atalhos de categoria, embalagens em SVG por forma: pote/frasco/caixa/pacote), seção
  "Onde encontrar" com o widget, página de produto com o widget no lugar do "comprar", página "Sobre". **Saiu do site:** faixa amarela de demo,
  "Roteiro da demo", dicas "Experimente…", molduras "Widget GeoLynq / Busca ao vivo". **Só resta o rodapé** dizendo que a marca é fictícia.
  Roteiro + CEPs de teste + snippet foram para **`/apresentacao.html`** (sem link no site, noindex; uso interno). Conferido em Chromium (desktop e
  390 px) com o widget real e dados simulados: sem rolagem lateral em nenhuma das 16 páginas. Não conferido: fontes do Google e o widget lendo o
  banco real (o sandbox não alcança). **Categorias do tenant `demo` corrigidas no banco (OK do usuário):** de `proteina`/`aminoacido`/`energia`/`vitamina`/`saude` para
  "Proteínas" (5), "Aminoácidos" (2), "Energia e performance" (2), "Vitaminas" (1), "Saúde e bem-estar" (2); o widget mostra esse texto na lista de busca.
- **Análise da plataforma + Pacote 1 (2026-10-07, OK do usuário):** análise crítica feita (painel = bom relatório de diagnóstico, ainda não ferramenta de
  decisão comercial). **Não existe análise de IA no painel** (a manchete é texto-modelo por regras); proposta aceita para depois: cartão "Leitura do período"
  gerado pela API da Anthropic (números sempre do SQL, IA só narra; conferir que todo número citado está nos dados; guardar por período; chave só como variável
  no EasyPanel, nunca no chat). **Feito no Pacote 1:**
  - Migration `20261008000000_painel_ao_vivo_e_desempenho.sql` (`panel_recent`, `panel_resellers`; SECURITY INVOKER; anon sem EXECUTE). Testes
    `supabase/tests/07_*.sql` (OK 07). **Aplicada na produção** e conferida lá como o usuário do painel.
  - Painel: cartão "Últimas buscas e contatos" (+ "Atualizar"), cartão "Quem gera contato" (ranking e lojas físicas paradas), coluna "Contatos (30 d)" na Rede,
    **seletor de cliente** (cookie `gl_cliente`, só aceita cliente do qual o usuário é membro), categoria legível no Catálogo, faixa de demonstração compacta.
    E2E **61/61** (`next start` e standalone).
  - Dados: o cliente `demo` (marca Pódio, a mesma do site) recebeu **600 buscas + 215 contatos simulados** (`supabase/tests/06_eventos_simulados_podio.sql`;
    cobertura calculada com PostGIS a partir da rede real do `demo`; sessões `seed-pod-…`; apagar: `delete from public.widget_events where session_id like 'seed-pod-%';`).
    Rede do `demo`: duplicata "Farmácia Saúde Total" **inativada** (não apagada) e telefone `13999990000` trocado por fictício plausível. O e-mail do usuário do painel
    foi vinculado como `owner` ao `demo` (agora com 2 clientes: `fabrica-teste` e `demo`).
  - Roteiro (`/apresentacao.html`) atualizado no repositório; só vai ao ar no próximo push na `bold-cray` (precisa de OK).
  - **Lacunas completas (2026-10-07):** achado e corrigido um defeito de precisão: `panel_overview` devolve só as 30 maiores lacunas e a tela Lacunas somava essas 30
    como se fosse o total (com 90 dias no `demo`: tela mostraria 30 combinações / ~116 buscas; real 44 / 135). Nova função `panel_gaps` (migration
    `20261009000000_painel_lacunas_completas.sql`, teste `08_*.sql` OK 08; **aplicada na produção**, conferida: total = indicador). Tela Lacunas agora tem filtro por
    estado e produto, **Exportar CSV** (`;`, BOM, fórmulas neutralizadas; exige login) e o "em breve" virou um aviso único. E2E **70/70**.
  - **Ainda por fazer (Pacote 2 e IA):** valor em R$ (premissas editáveis), raio configurável por cliente (hoje 100 km fixo no widget), lista de candidatos a revendedor (B3, hoje "em breve" 22× na tela de Lacunas), "Leitura do período" com IA.
- **Widget v2 — Etapa 1 "núcleo" (2026-10-07; construído, testado e PUBLICADO com OK do usuário):** decisões do usuário: (1) começar com produtos planos e agrupar sabor/tamanho depois;
  (2) lista geral de revendedores aceita com ao menos 1 filtro e 10 por página; (3) rastreio ANÔNIMO por desenho (nada guardado no navegador; id de visita só em memória;
  o painel passa a falar em "visitas", não "pessoas"); (4) o visual/estrutura do widget é nosso e igual para todos, e SÓ a GeoLynq define cores/estilo/fonte do cliente (o cliente não
  edita); a página "Onde encontrar" (cabeçalho/rodapé) é do cliente. Fotos: dois caminhos na MESMA coluna `products.image_url` (link do cliente ou nosso armazenamento) — decisão de
  espelhar ou não ainda em aberto; só https é aceito. Rastreio só a partir de digitar na busca ou abrir a lista (a parte 2 — eventos novos + pop-up de consentimento/LGPD — vem depois, com
  advogado; o rastreio de hoje reaproveita os eventos existentes e não precisa de migration).
  - **Código:** bundle novo `/v2/embed.js` (`apps/widget/src/v2/`, `vite.config.v2.ts`; `npm run build` gera v1 e v2; nginx ganhou `/v2/`); o **v1 não foi tocado** (só `api.ts` ganhou `protected`).
    Fluxo: busca (filtra na hora, sem acento, no navegador; >500 produtos vai ao servidor) → grade com foto e UM botão "Onde encontrar" → 3 opções (minha localização / CEP / lista de
    revendedores) → resultados como antes; botão "Lista de revendedores" no início com filtros produto/estado/cidade/tipo e "ordenar pelos mais próximos". Tema validado
    (`theme.ts`: nunca aplica texto livre do banco como CSS; contraste WCAG automático; fonte herdada do site). Texto digitado que parece dado pessoal (e-mail, telefone, CPF, CEP) NÃO é gravado.
  - **Banco (migration `20261010000000_widget_v2_nucleo.sql`, APLICADA na produção em 2 partes e conferida como `anon`):** `products.image_url`, `tenants.widget_theme`,
    `widget_get_tenant_v2`, `widget_find_products`, `widget_list_resellers` (exige filtro; máx. 20/página; online fora do filtro por UF/cidade), `widget_list_places`. Teste `supabase/tests/09_*.sql`
    (OK 09; quebrei as regras de propósito e o teste falhou). Conferido na produção: `anon` não lê `tenants`, lista sem filtro = 0, v1 intacto (tenant e busca por raio).
  - **Testes:** 43 unitários, E2E do v1 48/48 (intacto), E2E do v2 53/53 (`npm run e2e:v2 -w @geolynq/widget`; geolocalização exige https), painel E2E 70/70, nginx real (`/v2/` ok, `/v3/` 404).
  - **Site demo (`apps/demo`):** passou a usar o v2; página nova `/onde-encontrar.html` (cabeçalho e rodapé da Pódio + widget); fotos geradas em `/img/<sku>.svg`; roteiro atualizado.
  - **PUBLICADO (2026-10-07, OK do usuário):** (a) gravados no `demo` os 12 `image_url` e o tema (conferido: 12 produtos com foto, 1 cliente com tema); (b) push fast-forward `776694f..a38ef54` na `claude/bold-cray-vbbdyb`
    (contêiner novo do `geolynq_widget` no ar, "Up about a minute"); (c) painel redeployado (contêiner `healthy`, texto "visitas"). **Não verificado daqui:** os endereços públicos (o proxy da nuvem bloqueia) — o 1º teste real é do usuário em
    https://demo.geolynq.personalsupport.tech/onde-encontrar.html. Havia a lista do que gravar:
    (a) gravar no `demo`: `products.image_url` (12 links para `https://demo.geolynq.personalsupport.tech/img/<sku>.svg`) e `tenants.widget_theme`
    (`{"primary":"#1F3FFF","radius":14,"cardText":"#0F1B2D","border":"#E4E2DA","imageRatio":"3/4"}`); (b) push na `claude/bold-cray-vbbdyb` (publica widget v1+v2 e o site demo).
  - **Pendências deste bloco:** coluna de foto na planilha-modelo e no importador n8n; espelhar/otimizar fotos no nosso armazenamento; eventos novos (abrir lista, escolher produto) e funil no painel;
    pop-up de consentimento/LGPD + texto de privacidade/contrato (advogado); trava de domínio; agrupar sabor/tamanho; ViaCEP/Nominatim públicos (dados de CEP saem para terceiros).
- **Foto do produto na importação (2026-10-07):** planilha-modelo (`docs/geolynq-catalogo-modelo.xlsx`, aba Produtos) ganhou a coluna opcional `imagem` (link https, até 500 caracteres, sem espaço; vazio = sem foto).
  O workflow versionado `docs/n8n-geolynq-import-catalogo-v2.workflow.ts` grava `products.image_url` (a planilha é a fonte da verdade) e foto inválida vira **AVISO** (o produto entra sem foto; o lote fica `partial`).
  Lógica testada executando o código dos nós (7 casos: https ok, http, vazio, com espaço, coluna ausente, link gigante, `javascript:`; resumo = 4 avisos). **A cópia VIVA no n8n NÃO foi atualizada**
  (o conector do n8n está sem autorização nesta sessão): falta reimportar/ajustar o nó "Validar Produtos" e o "Montar Resumo da Importação" no n8n. Espelhar fotos no nosso armazenamento continua em aberto.
- **Marca do demo configurável (2026-10-07):** `apps/demo/brand.json` (cores, fontes, arredondamento) gera `brand.css` e `node apps/demo/brand-sql.mjs` imprime o UPDATE do tema do widget. Pedido do usuário: vestir o demo
  Pódio com o visual da loja da New Millen (só cores, fontes e estilo; nunca logo, nome ou fotos do cliente real). **Bloqueado:** o ambiente da nuvem nega o acesso a `loja.newmillen.com.br`
  (política de rede), então as cores/fonte reais NÃO foram lidas e nada foi chutado. Caminho: o usuário envia print(s) da loja ou os códigos de cor/fonte, ou libera o domínio em Network access do ambiente.
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

## Tema "estilo New Millen" + selo "Tecnologia GeoLynq" (2026-10-07) — PUBLICADO (2026-10-07)
- Widget v2: novos campos de tema (validados, sem CSS livre): `buttonRadius`, `inputRadius` (0–30; 30 = pílula), `inputBorder`,
  `buttonUppercase`, `hoverShadow`, `showCredit` (padrão true). Selo "Tecnologia GeoLynq" discreto no fim do widget, só texto
  (sem link): `CREDIT_URL` em `widget2.ts` é `null` até existir página pública da GeoLynq. 44 testes unitários + 55 checks E2E ok.
- Demo Pódio: `brand.json` agora segue a especificação enviada pelo usuário da loja New Millen (laranja #FF5500, topo preto,
  botões pílula em caixa alta, cantos 14, borda #F0F0F0, campos #D1D1D1). Aviso "marca fictícia" saiu do rodapé (ficou só na
  página interna `/apresentacao.html`). **Fonte NÃO informada**: usa fonte do sistema. Embalagens (`products.json`) recoloridas.
- Feito com OK do usuário: (1) `tenants.widget_theme` do `demo` gravado em produção (conferido por SELECT/RETURNING);
  (2) push `fe7dc70` em `claude/bold-cray-vbbdyb`; o EasyPanel subiu um contêiner novo de `geolynq_widget`. Não verificado daqui: o site no ar (o sandbox não alcança os domínios).
- Risco: texto branco sobre #FF5500 dá contraste ~3,2:1 (abaixo de 4,5:1 do AA para texto normal).

## Aviso de medição anônima (2026-10-07) — PRONTO NO CÓDIGO, NÃO PUBLICADO
- Decisão do usuário: o aviso NÃO trava o widget; a medição segue ligada até a pessoa recusar de forma explícita ("Não quero ser medido").
  Recusou = nada é gravado nem contado (`GeoLynqApiV2.logEvent` retorna antes de qualquer rede). "Entendi" só fecha o aviso.
- Código: `apps/widget/src/v2/consent.ts` (preferência `geolynq_medicao` = "ok"|"no" em localStorage; só isso é guardado, nenhum identificador;
  sem armazenamento a recusa vale até recarregar), `renderConsent` em `widget2.ts` (cartão colado ao fim do widget, não cobre a página do cliente),
  `public/privacidade.html` (texto-base, com [a definir] para base legal, retenção e contato; **precisa de revisão de advogado**),
  `nginx.conf` (`location = /privacidade.html`, testado com nginx real).
- O texto do aviso diz só o que é gravado (busca, produto, localização aproximada, cliques) e que não pedimos nome/e-mail/telefone/CPF/endereço
  nem usamos cookies. NÃO promete "nenhum dado sensível em qualquer hipótese": o campo de busca é texto livre (só filtramos o que parece
  e-mail/telefone/documento).
- Testes: 47 unitários, 67 checks E2E v2 (aviso não bloqueia, "Entendi" mantém medição, recusa = 0 eventos e 0 chamadas a `widget_events`,
  vale após recarregar), E2E v1 48 ok. Widget v1 (legado) não tem o aviso.
- Pendente: publicar (push em bold-cray, OK do usuário); revisão jurídica do texto; endereço do contato do encarregado.

## Eventos de funil (2026-10-07) — APLICADO E PUBLICADO (2026-10-07); conferir deploy
- Widget v2 grava 4 novos `event_type` (anônimos, sem coordenada/CEP/bairro; só depois da interação e respeitando a recusa da medição):
  `catalog_search` (termo digitado que ACHOU produto; sem produto continua `search` = "fora do catálogo"), `product_select`, `list_open`,
  `list_search` (UF/cidade/produto; 1 por combinação e visita). Abrir a página não grava nada.
- Banco: migration `20261011000000_funil_eventos.sql` (troca a constraint de `event_type` + função `panel_funnel(tenant, dias)`; unidade = visita;
  degraus do caminho do produto são aninhados). Teste `supabase/tests/10_funil_eventos.sql` (OK 10; os relatórios antigos não mudam).
  **Aplicar em produção ANTES de publicar o widget novo**, senão o INSERT de eventos novos falha na constraint (o widget ignora o erro; só perde o evento).
  A constraint usa DROP: o conector pode travar; se travar, rodar a etapa 1 no SQL Editor.
- Simulação: `supabase/tests/11_eventos_funil_simulados.sql` (parâmetros `-v slug=... -v prefix=...`; idempotente) para o demo (`slug=demo prefix=seed-pod-`).
- Painel: cartão "Como as pessoas usam o localizador" na Visão geral (caminho do produto, caminho da lista, termos digitados) e feed "Atividade ao vivo"
  com linhas de navegação. Painel precisa de novo deploy do `geolynq_admin` (branch keen-johnson) para aparecer.
- Testes: widget 47 unitários + 75 E2E v2; painel 76 E2E; banco 04, 05, 07, 08, 09, 10 ok.
- Feito com OK do usuário: (1) constraint de `event_type` + `panel_funnel` aplicados em produção via `apply_migration` (não travou; conferido: constraint com os 6 tipos,
  `panel_funnel` com EXECUTE só para authenticated); (2) simulação `11_` rodada no `demo` (prefixo `seed-pod-`): 300 product_select, 201 catalog_search, 83 list_open/list_search;
  (3) push `e089984` em `claude/bold-cray-vbbdyb` (widget); (4) `deployAppService` do `geolynq_admin` (a chamada estoura 60 s, mas o build segue). Deploys NÃO verificados ainda.
- Cuidado: `listProjectsAndServices` do EasyPanel devolve as variáveis de ambiente (segredos) de TODOS os projetos da conta; use `getDockerContainers`.

## Leitura do período por IA — FUNCIONAL EM PRODUÇÃO (conferido 2026-10-12/13 com dados de teste; sem cliente real ainda)
- **2026-10-12 (noite): funcionando em `fabrica-teste` e `demo`.** Conferido no banco (SELECT): 228×159 buscas (+43%), 66×41 sem revendedor (+61%), 65×47 cliques (+38%),
  Whey 84/13, Barra 17 de 23, Hipercalórico 18 de 18 — tudo bate com o texto da IA. Leitura gravada: modelo `claude-sonnet-5-5`, ~1.9 mil tokens de entrada e ~1.6 mil de saída.
- Problemas resolvidos: (1) chave sem workspace (erro 400 "not scoped to a workspace", aparecia como IA-MODELO) → nova chave com workspace no EasyPanel;
  (2) leitura recusada como "números não conferem" → o limite de saída (1500 tokens) cortava a resposta (a gravada usou 1625); agora `max_tokens` 3000, limites de texto mais folgados
  (resumo 900, ação 260…), JSON aceito mesmo com frase em volta, 100 km aceito na conferência; (3) botão sem aviso → "Gerando leitura…".
- Diagnóstico: o painel mostra na tela o "Detalhe técnico" quando descarta (números reprovados ou motivo do formato) e grava `[ia] …` no log. O EasyPanel do usuário NÃO devolve logs
  (`queryServiceLogs` dá 400; coleta de logs provavelmente desligada).
- **Ajustes publicados em 2026-10-13 (commit bca47bf, `geolynq_admin` reimplantado; aviso e linha confirmados na tela do demo pelo usuário):** (a) aviso dentro do cartão da leitura quando o cliente tem eventos simulados
  (demo: 1.496 de 1.545 simulados, só 49 reais); (b) linha "Sem ação registrada" em "O que as pessoas fazem depois da busca" — havia 1 clique sem `action` no demo (60+33+33+15+1 = 142);
  (c) vírgula decimal: instrução à IA + `virgulaBR` depois da conferência dos números (testado, 25 testes). A vírgula só vale para leituras NOVAS; a leitura de 23:33 foi gravada antes.
- Pendências: conferir alegações do funil/WhatsApp em outras leituras; rotacionar a chave da Anthropic que apareceu no chat (uma por vez, atualizando o EasyPanel);
  citar a IA como operador no texto de privacidade. Commits na `claude/keen-johnson-c0x5hs` (ad96087, 8457265, 504323c); `geolynq_admin` reimplantado por `deployAppService`.

## Teste real do widget no site demo (2026-10-13, 00:00, feito pelo usuário no computador)
- Passos 1–6 OK e conferidos no banco (SELECT): busca "whey" (`catalog_search`, 2 resultados); busca em Praia Grande (5 revendedores, mais perto 10,55 km); cliques WhatsApp, Como chegar e Ligar
  (`reseller_click`); busca em Manaus (0 resultados, "sem revendedor físico em até 100 km", opção online na tela); termo fora do catálogo ("pasta de amendoim": 0 produtos, aviso na tela, busca gravada sem produto).
- **Falta o passo 7: repetir no celular** (usuário deixou para depois). Antes de usar em site de cliente real: aviso de medição anônima (LGPD) ainda não publicado.

### Histórico (2026-10-07) — antes de ligar
- Cartão "Leitura do período" na Visão geral: resumo, destaques e ações, gerados sob demanda (botão), guardados em `panel_ai_readings` por cliente e período.
  Números vêm do SQL (`montarDados`); a IA só narra; TODO número escrito é conferido contra os dados (`numerosNaoConferem`); se não conferir, tenta 1 vez
  de novo e depois DESCARTA (nunca mostra número não verificado). Limitação: confere que o número existe nos dados, não que foi atribuído ao item certo.
- Segurança: chamada só no servidor (`apps/admin/lib/ia.ts`, fetch direto, sem SDK novo); chave em `ANTHROPIC_API_KEY` e modelo em `ANTHROPIC_MODEL`
  (variáveis de RUNTIME do serviço `geolynq_admin` no EasyPanel, sem prefixo NEXT_PUBLIC). Termos digitados por visitantes entram só como dado JSON (anti prompt injection).
  Limite de custo: 1 leitura / 2 min (conferido ANTES de chamar o modelo) e 30 / dia por cliente (gatilho no banco). Sem chave, o cartão nem aparece.
- Banco: migration `20261012000000_leitura_ia.sql` (tabela + RLS por cliente + gatilho de limite). Teste `supabase/tests/12_leitura_ia.sql` (OK 12).
- Testes: `apps/admin/e2e/ia.test.mts` (14, lógica pura + modelo simulado), E2E do painel 86 (modelo simulado: leitura boa, repetição barrada, número inventado descartado,
  isolamento entre clientes). NÃO testado com a API real da Anthropic (o sandbox não alcança).
- Para ligar: (1) aplicar a migration em produção; (2) usuário põe `ANTHROPIC_API_KEY` e `ANTHROPIC_MODEL` no EasyPanel (geolynq_admin > Ambiente); (3) deploy do painel.
- Privacidade: a IA recebe só números agregados, nomes de produto/cidade e os 6 termos mais buscados fora do catálogo (até 40 caracteres cada). Citar isso no texto de privacidade (operador de IA) na revisão jurídica.
- **Migration da leitura por IA APLICADA em produção (2026-10-07, OK do usuário):** `apply_migration` estourou 60 s e NADA foi criado (conferido); aplicada em etapas via `execute_sql`
  (tabela+índice+RLS+grants; políticas; função+gatilho). Conferido: RLS ligado, 2 políticas, 1 gatilho, anon sem acesso. Ajuste extra feito só em produção: `revoke update, delete, truncate,
  references, trigger ... from authenticated` (a migration do repositório concede só select/insert, mas o default do Supabase tinha dado mais; o `revoke all ... from public, anon` não os tira de authenticated).
  TODO: repetir esse revoke no arquivo da migration para o repositório e a produção ficarem iguais. Falta: chave (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`) no EasyPanel e deploy do painel (commit a8ddf09).
