<!--
  GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
  Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
  total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
  Unauthorized copying, replication, redistribution or commercial use is prohibited.
-->
# Roteiro de go-live — New Millen (24/10/2026)

> **Estado:** planejado. Nada foi gravado em produção para a New Millen. Única execução real: a **conferência** do cadastro pelo CNPJ (24/10, execução 492 do n8n, `gravar=false`): razão social NM ALIMENTOS LTDA, situação ativa, matriz, Cajamar/SP, CNAE principal 1099607, 0 avisos.
> Este arquivo é público (repositório). **Não** colocar aqui preços de custo, divisão entre as partes, CPF nem dados de contato. Esses ficam nos documentos privados (briefing do Danilo e acordo Junior ↔ DCM).
> Linguagem com o usuário: português simples. Cada passo que grava em produção **pede OK antes**.

## 0. Visão em uma tela

| # | Etapa | Quem | Quando (alvo) | Só avança se |
|---|---|---|---|---|
| 1 | Briefing do Danilo e demonstração ao vivo para a New Millen | Junior → Danilo | até 26/10 | — |
| 2 | Danilo pede os dados à New Millen | Danilo | até 26/10 (segunda) | cliente topou o piloto |
| 3 | Acordo Junior ↔ DCM (licença + divisão) assinado | Junior + Danilo | **antes do contrato com a cliente** | ver portão G1 |
| 4 | Contrato de 12 meses com a New Millen | Danilo (DCM) | antes de ir ao ar | ver portão G2 |
| 5 | Cadastro técnico, importação, logins e testes | Junior (+ Claude) | 27 a 29/10 | lista com CNPJ recebida (G5) |
| 6 | Página rascunho com o widget, comparação lado a lado | Danilo + Junior | 29/10 | etapa 5 concluída |
| 7 | Troca na página oficial ("Onde encontrar") | Danilo | **sexta, 30/10** | contrato assinado (G2) |
| 8 | Primeiros 30 dias de acompanhamento | Junior | 31/10 a 30/11 | — |

01/11/2026 é **domingo**. Meta realista: sexta 30/10. Se a lista chegar depois de segunda 26/10, o plano vira segunda 02/11 ou terça 03/11. **Não** aceitar prazo sem a lista em mãos.

## 1. Portões (nada de ir ao ar sem eles)
| Portão | Condição | Por quê |
|---|---|---|
| **G1** | Acordo Junior ↔ DCM assinado **antes** do contrato com a cliente (basta a parte de licença e divisão; o resto pode vir depois) | A DCM só pode licenciar o GeoLynq a terceiros se o desenvolvedor autorizou por escrito. Sem isso o contrato com a cliente promete algo que a DCM não tem. |
| **G2** | Contrato com a New Millen assinado antes de ativar o widget na página **oficial** | O widget passa a medir visitantes do site dela. Regra definida pelo usuário. A página rascunho não é pública, então pode ser testada antes. |
| **G3** | Decisão sobre o Supabase Pro tomada (recomendado: contratar antes) | O plano grátis ficou fora do ar em 15–16/10 e 23/10, sem backup automático. |
| **G4** | `~/backups/geolynq/backup.log` com linhas `OK:` de 25/10 e 26/10 (cron conferido) | Backup diário pela VPS, hoje só nela. Cópia externa ainda **não** existe. |
| **G5** | Planilha de revendedores **com CNPJ** recebida e validada | Sem ela não há cadastro de rede, nem Marco 2. É o maior risco de prazo. |

## 2. Etapa 1 e 2 — Briefing, demonstração e pedido de dados
O texto completo está no **briefing do Danilo** (documento privado, entregue ao usuário). Resumo do que o Danilo leva:
- o que foi criado, páginas, acessos, valor (R$ 990/mês, 12 meses, implantação sem custo) e roteiro de demonstração ao vivo (site de amostra + painel);
- o que **não** prometer: SLA, relatório em PDF com data, "tempo real" sem a ressalva do F5, "a loja X não vende";
- o que pedir à New Millen (tabela abaixo).

### O que o Danilo pede à New Millen
| # | Item | Formato | Obrigatório? | Observação |
|---|---|---|---|---|
| 1 | **Revendedores** | planilha-modelo `docs/geolynq-catalogo-modelo.xlsx`, aba `Revendedores`: `cnpj`, `nome`, `tipo`, `telefone`, `whatsapp`, `site`, `cep`, `rua`, `numero`, `bairro`, `cidade`, `estado` | CNPJ, nome, tipo e CEP ou endereço | `tipo` só aceita `loja_fisica`, `farmacia`, `online`, `distribuidor`, `outro`. O CNPJ impede duplicar na reimportação. |
| 2 | **Produtos** | aba `Produtos`: `sku`, `nome`, `categoria`, `claims`, `alergenos`, `imagem` | sku e nome | `imagem` = link `https://` da foto (até 500 caracteres). Sem foto, o widget mostra as iniciais. |
| 3 | **Cobertura: qual revendedor vende qual produto** | aba `Cobertura`: `sku_produto`, `cnpj_revendedor`, `prioridade` | **Sim** | **Sem linha de cobertura, buscar por produto não devolve nada** (verificado no código do banco). Se todo revendedor vende todos os produtos, o Junior gera a aba; se for parcial, a New Millen precisa informar. Perguntar logo. |
| 4 | Logotipo e **cor principal** da marca (código de cor ou site) | texto/imagem | Sim | Entra no tema do widget. |
| 5 | **Quem usa o painel**: nome, e-mail e papel | texto | Sim | `owner`/`admin` editam candidatos e palavras; `viewer` só lê. Não há convite nem "esqueci a senha": o Junior cria o acesso. |
| 6 | **Página "Onde encontrar"**: endereço, print, como o Gofind está colocado (código, iframe, bloco do WordPress) | print + link | Sim | Para planejar a troca e o plano de volta. |
| 7 | **Visitas por mês** da página e do site | número (Analytics/HostGator) | Recomendado | Define a expectativa dos gráficos. |
| 8 | **Gofind:** fidelidade, aviso prévio, data de renovação | texto | Recomendado | A economia de R$ 610/mês só existe depois do cancelamento. Só cancelar **depois** de o nosso widget estar aprovado na página oficial. |
| 9 | **Dados do contrato:** razão social, CNPJ (confirmar que é NM ALIMENTOS LTDA, 00.385.181/0001-11), endereço, signatário, e-mail | texto | Sim | |
| 10 | Autorização do uso do nome e do logotipo no painel e no widget | e-mail | Sim | Só em peças aprovadas, uma a uma (Anexo IV do contrato). |
| 11 | Política de privacidade do **site da New Millen** citando o widget | texto do Junior, publicado pelo Danilo | Sim | Ela é a controladora dos dados de medição. |

## 3. Etapas 3 e 4 — Acordo entre as partes e contrato com a cliente
- **Contrato com a New Millen:** `docs/contrato-minuta-prestacao-servico.md` (contratada = DCM). Versão pronta para revisão, com as decisões assumidas listadas no início.
- **Acordo Junior ↔ DCM:** documento **privado**, fora do repositório. Não ficou no Git porque tem divisão de resultado e dados pessoais das partes.
- **Ordem:** acordo Junior ↔ DCM primeiro (G1), contrato com a cliente depois (G2).
- Nenhum dos dois foi revisado por advogado.

## 4. Etapa 5 — Cadastro técnico (Junior + Claude)
Cada comando abaixo é **leitura**, salvo onde está escrito *grava*. Gravar pede OK do usuário.

### 4.1 Validar a planilha antes de importar (Claude, sem tocar em produção)
- CNPJ: dígito verificador (aceita CNPJ alfanumérico), duplicados, situação cadastral (BrasilAPI, uma consulta por CNPJ, devagar: a API já deu 503/429).
- `tipo` válido, CEP com 8 dígitos, link de foto começando com `https://` (testar se abre).
- Cobertura: todo `sku_produto` existe em Produtos; todo CNPJ existe em Revendedores.
- Entregar ao Danilo a lista de erros **por linha** para a New Millen corrigir.

### 4.2 Cadastrar a cliente (grava)
No n8n novo, workflow **"GeoLynq — Cadastro de Cliente por CNPJ"** (`gTDZOrphnSqujiux`), nó "Parâmetros do Cadastro":
| Campo | Valor |
|---|---|
| `cnpj` | `00385181000111` (matriz) |
| `slug` | `new-millen` |
| `nome_cliente` | `New Millen` |
| `segmentos` | `suplementos` |
| `ufs` | vazio (Brasil inteiro, decisão do usuário) |
| `cor` | código de cor da marca |
| `status_inicial` | `trial` |
| `gravar` | `true` (primeiro `false`, conferir de novo) |

Conferir depois (leitura):
```sql
select slug, status from public.tenants where slug = 'new-millen';
```
Esperado: 1 linha, `trial`. O widget só atende cliente `active`: a ativação vem na etapa 4.5.

### 4.3 Importar catálogo e rede (grava)
1. Compartilhar a planilha (Google Sheets) com a conta de serviço `geolynq-importador@tiana-moda-afro.iam.gserviceaccount.com` como **leitora**.
2. No workflow **"GeoLynq — Import Catálogo v2 (CNPJ)"** (`8hXMMiLGaFTa8bw6`): colocar o `tenant_id` no nó "Parâmetros da Importação" (obter com `select id from public.tenants where slug = 'new-millen';`) e apontar os três nós do Google Sheets (Produtos, Revendedores, Cobertura) para a planilha da cliente. Hoje ele aponta para o cliente de teste.
3. Executar. A geocodificação é de 1 endereço por segundo: 1.000 revendedores levam cerca de 17 minutos.
4. Ler o resumo (tela **Importações** do painel): linhas com erro e avisos. Corrigir **por linha** com a cliente e reimportar. Reimportar não duplica (chave tenant + CNPJ).
5. Conferir contagens (leitura):
```sql
select
  (select count(*) from public.resellers r join public.tenants t on t.id = r.tenant_id where t.slug = 'new-millen') as revendedores,
  (select count(*) from public.products p join public.tenants t on t.id = p.tenant_id where t.slug = 'new-millen') as produtos,
  (select count(*) from public.product_reseller_coverage c join public.tenants t on t.id = c.tenant_id where t.slug = 'new-millen') as cobertura,
  (select count(*) from public.addresses a join public.tenants t on t.id = a.tenant_id where t.slug = 'new-millen' and a.geog is null) as sem_coordenada;
```
Esperado: as três primeiras iguais ao da planilha; `sem_coordenada` = 0 ou a lista de endereços para corrigir.

### 4.4 Criar os acessos ao painel (grava)
Roteiro do `apps/admin/README.md`:
1. Supabase → Authentication → Users → **Add user** (e-mail + senha forte, marcar *Auto Confirm User*). Senha combinada fora do chat.
2. Vincular ao cliente (SQL Editor): `insert into public.tenant_users (tenant_id, user_id, role) select t.id, u.id, 'owner' from public.tenants t, auth.users u where t.slug = 'new-millen' and u.email = '<email>';`
3. Papéis: responsável da New Millen = `owner`; os demais = `viewer` (só lê). Danilo: decisão pendente (`admin` permite marcar candidatos e editar palavras).
4. **Desligar o cadastro aberto** (Authentication → Sign In / Providers) **antes** de criar os acessos, e conferir que o login continua funcionando.

### 4.5 Ativar para a página rascunho (grava)
```sql
update public.tenants set status = 'active' where slug = 'new-millen';
```
Código que o Danilo cola (o painel mostra o mesmo na tela "Widget no site"):
```html
<script src="https://widget.geolynq.personalsupport.tech/v2/embed.js" defer></script>
<geolynq-widget tenant="new-millen"></geolynq-widget>
```
Sem trava por domínio: funciona em qualquer endereço. Se o WordPress ou um plugin bloquear o script, testar um bloco "HTML personalizado".

### 4.6 Testes antes de comparar com o Gofind (Junior)
- 10 CEPs **perto de revendedores reais da lista** (devem listar o revendedor esperado, em ordem de distância), 3 CEPs **longe** de qualquer revendedor (devem mostrar "sem revendedor" e gerar lacuna), 1 CEP inválido, 1 busca por produto, 1 produto sem cobertura.
- Celular (Android e iPhone) e computador; página rascunho e página de produto.
- Aviso de medição e link da política de privacidade visíveis.
- Depois dos testes, conferir no painel e no banco (leitura):
```sql
select count(*) as eventos, count(*) filter (where query_text ~* '[0-9]{5}-?[0-9]{3}|@|\([0-9]{2}\)') as com_dado_pessoal
from public.widget_events e join public.tenants t on t.id = e.tenant_id
where t.slug = 'new-millen' and e.created_at > now() - interval '2 hours';
```
Esperado: eventos > 0 e `com_dado_pessoal` = 0.

## 5. Etapa 7 — Ir ao ar (Danilo)
1. Página **rascunho** (cópia de "Onde encontrar") com o widget; o Gofind segue no ar na página oficial.
2. Junior confere (4.6); a New Millen compara lado a lado.
3. Contrato assinado (G2) → o Danilo troca o bloco do Gofind pelo nosso na página oficial.
4. **Plano de volta (1 minuto):** reativar o bloco do Gofind e remover as duas linhas. Se o problema for do GeoLynq, `update public.tenants set status = 'suspended' where slug = 'new-millen';` (o widget deixa de atender).
5. Só cancelar o Gofind depois da aprovação (item 8 do pedido).

## 6. Etapa 8 — Primeiros 30 dias
| Quando | O que conferir | Quem |
|---|---|---|
| D+1 | Eventos chegando; `backup.log`; monitor do n8n e UptimeRobot sem alerta; página oficial abrindo o widget em celular | Junior |
| D+7 | Primeiro relatório de uso (painel + leitura de IA); buscas sem resultado; revendedores mais clicados; mostrar ao Danilo | Junior |
| D+30 | Revisão: o que funcionou, lacunas, ajustes; pedir o depoimento (texto aprovado por escrito pela cliente) | Junior + Danilo |
| Mensal | Reunião de 30 minutos; atualização da lista de revendedores; conferência de situação cadastral | Junior |
| Qualquer dia | Se o monitor avisar: ver `docs/seguranca-e-backup.md` e o `status.md` | Junior |

## 7. Depois do go-live — Marco 2 (candidatos a revendedor)
Só depois de a lista com CNPJ estar no sistema: medir os CNAEs dos revendedores da cliente (`tools/receita/cnae_dos_revendedores.py`), propor os CNAEs de canal (a pessoa confirma), carregar candidatos (`exportar_candidatos.py`) e conferir a lista por amostra. Roteiro: `docs/candidatos-a-revendedor.md`. **Sem data fixa para a cliente.**

## 8. Quem faz o quê
| Tarefa | Junior | Danilo / DCM | New Millen | Claude |
|---|---|---|---|---|
| Demonstração e proposta | prepara | **apresenta** | decide | — |
| Contrato com a cliente | revisa | **assina e envia** | assina | redige minuta |
| Dados (planilhas, fotos, cor) | valida | **solicita** | **envia** | valida o formato |
| Cadastro, importação, acessos | **executa (OK)** | — | — | executa com OK |
| Colar o script no WordPress | confere | **cola** | autoriza | — |
| Testes e conferência | **executa** | acompanha | compara | roda consultas |
| Nota fiscal e cobrança | — | **emite e cobra** | paga | — |
| Suporte técnico e atualizações | **faz** | recebe o contato comercial | pede | apoia |

## 9. O que ainda não foi verificado
- URLs públicas, widget E2E com banco real e teste em celular (o ambiente de desenvolvimento não alcança os domínios).
- Se o WordPress/HostGator da New Millen aceita o script (teste só na página rascunho).
- BrasilAPI com a lista inteira (limite de requisições).
- Se o primeiro backup automático rodou (conferir `backup.log` de 25/10).
- Cópia do backup **fora da VPS**: adiada por decisão do usuário. Recomendado antes do primeiro pagamento.
