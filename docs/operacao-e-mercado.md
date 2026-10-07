# GeoLynq — Operação, mercado e preço (análise de 2026-10-02)

> Documento de decisão. **Fatos** vêm de fontes citadas no fim; **hipóteses** estão marcadas como tal e
> precisam ser validadas em conversa com clientes. Câmbio assumido: **R$ 5,50 / US$** (suposição; confira).

## 1. Como o sistema funciona, ponta a ponta

**Quem participa:** fabricante (cliente) · consumidor final · revendedor (listado) · Danilo (comercial) · Junior (técnico/operação).

```
Fabricante ──planilha──▶ n8n (valida + geocodifica) ──▶ Supabase ◀── widget ◀── consumidor
 (produtos,               trigger manual                (PostGIS, RLS)   no site do      (busca produto
  revendedores,           erro por linha em                              fabricante      + CEP/local)
  cobertura)              import_batches                                      │
                                                                              ▼
                                         widget_events (busca, clique)  ──▶  relatórios
                                                                              (Fase 5: ainda NÃO existe)
```

| Etapa | Estado hoje (atualizado em 2026-10-07) |
|---|---|
| Widget no site do cliente (2 linhas de HTML, Shadow DOM, qualquer CMS) | **No ar** (busca sem acento, limite de eventos por visitante) |
| Busca → CEP/localização → revendedores até 100 km (+ lojas online) → WhatsApp/Ligar/Site/Como chegar | **No ar** (raio fixo de 100 km; configurável por cliente ainda não existe) |
| Telemetria (cada busca e clique, anônima) | **Gravando** |
| Importação de catálogo por planilha (n8n) | **Funciona**, disparo manual por você |
| Cadastro de cliente por CNPJ (n8n) | **Funciona**, disparo manual; cliente nasce `trial` (invisível ao público) |
| Ativar cliente, criar login e vincular ao cliente | **Manual** (SQL e Supabase Auth) |
| Site de amostra (demo "Pódio") + página interna de roteiro (`/apresentacao.html`) | **No ar** |
| **Painel do cliente** (`painel.geolynq.personalsupport.tech`): visão geral, ao vivo, lacunas (filtros e CSV), rede, catálogo, importações, widget | **No ar** |
| Login do cliente | **Existe** (e-mail e senha criados por você); **não existe** "esqueci a senha" nem convite |
| Atualização de catálogo pelo próprio cliente | **Não existe** (planilha → você importa) |
| Análise de IA ("Leitura do período"), valor em R$, lista de candidatos a revendedor | **Não existem** (planejados) |
| Cobrança | Manual (PIX/boleto) por decisão do blueprint |

**Consequência honesta:** o GeoLynq ainda é um **serviço apoiado por produto**: o cliente lê o painel, mas é você quem cadastra,
ativa, cria o login e importa/atualiza o catálogo.

## 2. Implantação de um novo cliente (roteiro)

| Quando | Quem | O quê |
|---|---|---|
| Antes | Danilo | Qualificar: o site aceita colar script? Quantos produtos/revendedores? Quem é o webmaster? Hoje usa Gofind? |
| Dia 0–1 | Danilo | Demo (`demo.geolynq…`), proposta, aceite e contrato |
| Dia 1–2 | Junior | Criar o tenant (slug, nome, cor) e enviar a planilha-modelo |
| Dia 2–5 | Cliente + Junior | Cliente preenche; rodar a importação; ler `import_batches`; corrigir erros **por linha** com o cliente |
| Dia 5–7 | Webmaster do cliente | Colar o snippet em staging, validar numa página de produto, comparar lado a lado com a solução atual, ir ao ar |
| D+7 e D+30 | Junior | Primeiro relatório de uso; revisão de 30 dias; atualização mensal/trimestral do catálogo |

Pré-requisitos do cliente: lista de revendedores (nome, tipo, endereço ou CEP, telefone/WhatsApp), SKUs, **foto de cada produto** (link https na coluna `imagem` da planilha; sem foto o widget mostra as iniciais), acesso ao site.
Tempo estimado de implantação: **6 a 10 horas de trabalho** (hipótese). Risco nº 1 de churn: planilha ruim e dado desatualizado.

## 3. Como o cliente usa
- **Equipe comercial/marketing do fabricante:** envia a planilha, lê o relatório (buscas, produtos sem cobertura, regiões
  com demanda, cliques em revendedor). Pelo painel com login (relatório mensal em PDF por e-mail ainda não existe).
- **Consumidor final:** acha o produto, informa o CEP e chama o revendedor mais próximo.
- **Revendedor:** recebe contato; não usa o sistema.

## 4. Mercado (fatos pesquisados)

**Demanda do setor (suplementos, o vertical da demo):** R$ 7,6 bi em 2025 (+15%), projeção de R$ 13,8 bi até 2030
(BRASNUTRI/Euromonitor); 59% dos lares consomem; 60+ empresas associadas à BRASNUTRI ≈ 70% do mercado, ou seja, poucos
grandes e uma cauda longa de marcas menores. Há divergência entre fontes (ex.: ABRE cita R$ 1,5 bi), por escopo diferente.
A RDC 843/2024 (Anvisa) empurra o setor à formalização; prazo de notificação foi estendido a set/2026.

**Comportamento do consumidor (indicativo, fontes secundárias):** ~58% começam a pesquisa de compra no Google; buscas
"perto de mim" dobraram em um ano. A dor "onde acho esse produto perto de mim?" é real.

**Concorrência e preços de referência**

| Alternativa | O que é | Preço |
|---|---|---|
| **Gofind** (Brasil) | Localizador para a indústria; 600+ empresas, 700 mil PDVs mapeados, inferência de disponibilidade por ML sem integrar com a loja; clientes como Nestlé, Seara, Heineken, Danone, Coca-Cola | **Não público** ("varia por porte e funcionalidades"). *Não consegui descobrir.* |
| Stockist | Localizador self-service (global) | US$ 10–40/mês (≈ R$ 55–220) |
| Storemapper | idem | US$ 25–199/mês (≈ R$ 137–1.095) |
| Storepoint | idem | US$ 25–99/mês (≈ R$ 137–545) |
| StoreRocket / BatchGeo | idem | a partir de US$ 25 / US$ 99 |
| Plugins WordPress | DIY | R$ 0–79/ano |
| PriceSpider e afins | "Where to buy" enterprise | só sob consulta; avaliações dizem "caro" |
| Google (Maps, Shopping, Perfil) | Substituto parcial | grátis/ads |

**Leitura:** o preço de mercado para um localizador genérico é **baixo** (US$ 10–200/mês). O Gofind é enterprise e opera numa
escala de dados (700 mil PDVs, ML) que o GeoLynq **não** replica. O espaço do GeoLynq é a **marca pequena/média** que
quer algo mais barato, em português, com **implantação feita pra ela** e relatório de **lacunas de cobertura**.

## 5. Viabilidade (análise crítica)

**A favor**
- Custo variável quase zero: Supabase Pro US$ 25/mês (8 GB, 250 GB de saída) comporta muitos tenants; VPS já paga.
- Produto já construído (MVP no ar + demo). Ponto de equilíbrio: 1 a 2 clientes.
- Dor real e um concorrente que atende bem o topo, deixando a cauda longa mal atendida.

**Contra / riscos**
1. **Dado do revendedor é o ativo e é frágil.** Fabricante pequeno raramente tem lista limpa; lista velha = produto ruim = churn.
   O Gofind estima disponibilidade por ML; o GeoLynq depende do cliente.
2. **Disposição a pagar por "mapinha de lojas" é baixa** (plugins quase de graça, SaaS global a US$ 10–100). Para cobrar mais é preciso
   vender **insight** (lacunas, demanda por região) e **serviço** (implantação e atualização), não o mapa.
3. **Concentração:** 2 clientes, ambos via Danilo, vindos do Gofind. Sem receita ainda.
4. **Geocodificação gratuita não escala.** O Nominatim público limita a 1 requisição/s, proíbe uso pesado e exige identificação e
   **atribuição ao OpenStreetMap** (o widget hoje não exibe atribuição). Alternativas: cache CEP→coordenadas no banco, instância
   própria de Nominatim, ou paga (Google: 10 mil grátis/mês, depois US$ 5 por mil ≈ R$ 27 por mil buscas).
5. **Infra de produção:** o plano grátis do Supabase **pausa após 1 semana sem uso**; antes de cobrar, migrar para o Pro (US$ 25).
6. **LGPD:** a telemetria guarda session_id + cidade/UF + termo buscado; é preciso aviso de privacidade e contrato com papéis
   (cliente = controlador, GeoLynq = operador). Revisão jurídica recomendada.
7. **Gargalo de uma pessoa só:** onboarding e suporte manuais limitam a ~10–15 clientes antes da Fase 5.
8. **Substitutos "bons o bastante":** Google Meu Negócio/My Maps e plugins gratuitos para quem usa WordPress.

**Veredito:** viável como **negócio de nicho, de alta margem, com serviço embutido**. **Não** é (ainda) um SaaS escalável de
autoatendimento. Vale seguir **se** 2+ clientes pagarem no piloto (ver seção 7); caso contrário, manter enxuto.

## 6. Quanto e como cobrar (hipóteses a validar com Danilo)

> **Atualização (seção 10):** depois da conversa com a New Millen, a estratégia mudou para **sem plano básico**.
> A tabela abaixo fica como referência histórica; a oferta vigente está na seção 10.

**Âncora nº 1 (a mais valiosa, e eu não tenho): o que os 2 clientes pagam hoje ao Gofind.** Regra: cobrar 40–60% disso no piloto.

| Plano | Preço sugerido | Inclui |
|---|---|---|
| **Implantação (única)** | **R$ 800** (até 300 produtos/100 revendedores; acima R$ 1.500) | limpeza e importação da planilha, instalação guiada, 1 revisão. Filtra clientes não sérios e paga as 6–10 h |
| **Essencial** | **R$ 247/mês** | 1 domínio, até 300 produtos, 100 revendedores, 5 mil buscas/mês, relatório mensal (PDF/e-mail), atualização trimestral da planilha |
| **Pro** *(só vender após a Fase 5)* | **R$ 597/mês** | até 2 mil produtos, 1 mil revendedores, 25 mil buscas, painel, lacunas de cobertura, atualização mensal, vários domínios, suporte por WhatsApp |
| **Indústria** | **sob consulta, a partir de R$ 1.500/mês** | revendedores ilimitados, integração/API, domínio próprio, Opportunity Score (Fase 10), relatório regional, SLA |
| Excedente | ≈ R$ 30 por 5 mil buscas extras | cobre geocodificação paga se não houver cache |

- **Contrato de 12 meses**; anual à vista = 10 meses (≈ 17% de desconto). Reduz churn.
- **Preço de fundador** para os 2 primeiros: até 50% do que pagam ao Gofind, mínimo R$ 147/mês, 12 meses travados, **setup
  simbólico (R$ 300)** (de graça desvaloriza) e, em troca, depoimento/caso por escrito.
- **Reajuste anual** (IPCA) no contrato.
- **Não prometa o que não existe:** antes da Fase 5, venda **Essencial + relatório manual mensal**.
- **O tempo é o custo real:** com 1,5 h/mês de suporte por cliente, o Essencial rende pouco; por isso é de baixo toque
  (atualização trimestral, suporte por e-mail). O dinheiro está no Pro e no Indústria.

Coerência com o mercado: Essencial ≈ US$ 45/mês, na faixa alta dos localizadores genéricos (US$ 25–99), justificado por
português + implantação + relatório. Benchmarks brasileiros indicam ticket 40–60% abaixo do global, então **não suba acima disso
sem insight comprovado**.

**Cenários de 12 meses (hipóteses, não previsão)**

| Cenário | Clientes | Ticket médio | MRR | Setup acumulado | O que precisa ser verdade |
|---|---|---|---|---|---|
| Conservador | 3–5 | R$ 300 | R$ 0,9–1,5 mil | R$ 2–4 mil | só os 2 do Danilo + 1–3 indicados |
| Realista | 10–15 | R$ 400 | R$ 4–6 mil | R$ 8–12 mil | Fase 5 pronta, 2º canal de vendas, 1 vertical focada |
| Otimista | 25–30 | R$ 500 | R$ 12–15 mil | R$ 20–24 mil | parcerias com agências, automação de onboarding, equipe de suporte |

Referências: churn mensal de SMB ~3–5% (≈ 20–33 meses de vida média); LTV/CAC alvo ≥ 3. Com ticket R$ 400 e margem ~90%, LTV ≈ R$ 9 mil →
**CAC máximo ≈ R$ 3 mil** por cliente.

## 7. Como vender e como validar antes de investir mais

**Canais (em ordem de custo/benefício):** (1) indicações do Danilo e rede dele; (2) **agências e webmasters** com comissão recorrente
(20–30%); (3) outbound com a demo + auditoria do site do prospecto ("seu site não tem 'onde comprar'"); (4) eventos/associações
(BRASNUTRI, ABIAD). **Verticais vizinhas** com a mesma dor (vendem por revendedor): cosméticos, pet, alimentos, bebidas, ferramentas,
autopeças. Foque em **1 vertical principal + 1 vizinha**.

**Plano de validação (90 dias) e ponto de decisão**
1. Perguntar ao Danilo: quanto cada cliente paga ao Gofind, o que usa, o que reclama, quando renova.
2. Fechar os 2 pilotos **pagos** (preço de fundador) com contrato e setup.
3. 10 conversas com marcas (rede do Danilo) usando a demo; meta: 3 pilotos pagos em 60 dias.
4. **Ponto de decisão:** menos de 2 clientes pagando em 90 dias → manter enxuto e não construir a Fase 5 completa; 2 ou mais → construir.

## 8. O que corrigir antes de cobrar o primeiro cliente
1. Supabase **Pro** (sem pausa, com backup).
2. Geocodificação: **cache CEP→coordenadas**, atribuição ao OpenStreetMap no widget e plano para instância própria/paga acima de certo volume.
3. **Aviso de privacidade + contrato** (LGPD; papéis); revisão jurídica.
4. Reimportação sem duplicar revendedores (`unique` + `upsert`).
5. Deploy **com testes** (workflow pronta) e monitor de disponibilidade (uptime) nos 2 hosts.
6. Relatório mínimo para o cliente (mesmo que seja SQL → PDF no início).
7. Rate limit em `widget_events`.

## 9. O que esta pesquisa NÃO conseguiu confirmar
- O **preço real do Gofind** (não é público).
- Quantas **marcas pequenas/médias** existem no alvo (não achei dado público de empresas notificadas na Anvisa).
- O **câmbio** atual e **quanto o seu cliente aceita pagar**: isso só se descobre conversando.
- Os números de comportamento do consumidor vêm de fontes secundárias (agências/notícias).

## Fontes
- Gofind: [Projeto Draft](https://www.projetodraft.com/a-gofind-e-um-localizador-de-produtos-em-lojas-fisicas-do-brasil/) · [ABAD](https://distribuicao.abad.com.br/revista-digital/materias/gofind-ajuda-o-consumidor-a-localizar-produtos/) · [Gofind/Intellibrand](https://www.abcdacomunicacao.com.br/em-parceria-com-intellibrand-gofind-passa-a-ser-o-primeiro-localizador-de-produtos-omnichannel-do-brasil/) · [Localizador de Marca](https://www.gofind.com.br/localizador-de-marca)
- Preços de localizadores: [Storepoint](https://storepoint.co/pricing) · [StoreRocket (comparativo)](https://storerocket.io/learn/best-store-locator-software) · [Mapular: Storemapper vs Stockist](https://mapular.com/blog/storemapper-vs-stockist-store-locator) · [WPBeginner](https://www.wpbeginner.com/showcase/best-wordpress-store-locator-plugins/) · [Agile Store Locator](https://codecanyon.net/item/agile-store-locator-google-maps-for-wordpress/16973546)
- Enterprise: [PriceSpider (Gartner)](https://www.gartner.com/reviews/product/pricespider-brand-commerce-platform)
- Mercado de suplementos: [Revista Suplementação](https://www.revistasuplementacao.com.br/materias/detalhes/8319-mercado-de-suplementos-cresce-15-em-2025-e-deve-atingir-r$-138-bilhoes-ate-2030.html) · [Kdea 360 (59% dos lares)](https://revistakdea360.com.br/noticia/34029/mercado-de-suplementos-atinge-59-dos-lares-brasileiros-em-2025-e-segue-em-forte-expansao) · [ABRE](https://www.abre.org.br/inovacao/comunicacao/mercado-de-suplementos-deve-movimentar-r15-bi-em-2025/) · [RDC 843 (prazo)](https://afabbra.org.br/noticias/anvisa-estende-prazo-para-notificacao-de-alimentos-e-suplementos-ate-setembro-de-2026)
- Consumidor: [ClienteSA](https://portal.clientesa.com.br/quase-metade-dos-consumidores-consultam-google-antes-de-se-decidirem-onde-comprar/) · [Agência E-Plus](https://www.agenciaeplus.com.br/58-dos-consumidores-usam-google-para-fazer-pesquisa-de-compra/)
- Custos de infraestrutura: [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) · [Google Maps (preços)](https://www.woosmap.com/blog/google-maps-api-pricing-breakdown) · [Supabase (preços)](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
- Benchmarks SaaS Brasil: [Baita Aceleradora](https://baita.ac/tudo-sobre/benchmarks-saas)

## 10. Revisão após a conversa com a New Millen (2026-10-02)

**Fatos novos (relato do Danilo):** a New Millen **quer** o GeoLynq e hoje paga **R$ 1.600/mês** ao Gofind. Reclamações:
(a) o Gofind usa **notas fiscais emitidas**, então a atualização dos dados **leva meses**; (b) o widget no site é
**pouco intuitivo e orgânico**. **Decisão do Junior:** não oferecer plano básico; entrar com algo que gere impacto; o gancho são
os **relatórios e dashboards das buscas feitas no site**: *onde está, como está, onde não está e como chegar* em
revendedoras, distribuidoras e lojas. Observação: o tempo de desenvolvimento depende mais do Claude do que do Junior,
então cada bloco abaixo é dimensionado como uma entrega fechada.

### 10.1 Reposicionamento
De "localizador de lojas" para **Radar de Cobertura**: o widget **captura** a demanda real, o painel **mostra**, a lista de
prospecção **dá a ação** e a reunião mensal **fecha o ciclo**.

### 10.2 Crítica honesta (o que NÃO dizer)
- O **Gofind também vende análise**: anuncia "Mapa de Positivação", mapa de onde há/não há demanda e painéis por região e
  produto (grandes marcas de consumo são o foco). Vender "temos dashboard" não diferencia.
- **Diferenciais defensáveis do GeoLynq:** (1) **frescor**: cada busca real no site do cliente aparece em minutos, contra
  meses de nota fiscal; (2) **intenção do consumidor** (demanda declarada, com CEP), não venda inferida; (3) **ação**: para cada
  lacuna, uma lista de candidatos a revendedor; (4) **widget claro** no site do cliente; (5) **preço e serviço** para a marca
  média.
- **Limite do método:** a amostra são os **visitantes do site da marca**. Pouco tráfego = estatística fraca (precisamos do
  volume de buscas da New Millen para saber se o painel fica útil).
- O método "nota fiscal" do Gofind é **relato do cliente**; não confirmei em fonte pública. Não afirmar em material
  comercial; citar como "segundo a New Millen". Cuidado com publicidade comparativa.

### 10.3 As 4 perguntas viram relatórios

| Pergunta | Relatórios da v1 | Dado necessário | Estado hoje |
|---|---|---|---|
| **Onde está** | Mapa e tabela de cobertura por UF/cidade e tipo; **frescor** ("atualizado há X dias"); **completude** (tem WhatsApp? endereço geocodificado?) | tabelas já existentes | dados existem; falta a tela |
| **Como está** | Funil busca → clique por produto e região; ranking de revendedores por cliques; **distância média ao revendedor mais próximo**; produtos mais buscados; tendência mensal | `widget_events` | **parcial** (falta distância e localização confiável) |
| **Onde não está** | **Lacunas:** buscas sem revendedor físico no raio, por cidade e produto, por volume; buscas por produtos fora do catálogo; mapa de calor de demanda não atendida | `results_count` (físicos no raio), cidade/UF | **parcial** (cidade vem nula no GPS; sem coordenada aproximada) |
| **Como chegar** | Para cada lacuna: **lista de candidatos** a revendedor (varejo e atacado) na cidade/região, com endereço e telefone cadastrais; exportar CSV; marcar status (contatado, aprovado) | base pública de CNPJ + tabela de prospecção | **não existe** |

**"Como chegar", fonte viável:** a Receita Federal publica a base de CNPJ em dados abertos, com atualização mensal, incluindo
CNAE, endereço, telefone e e-mail cadastrais. Códigos úteis para suplementos: **4729-6/99** (varejo) e **4637-1/99**
(atacado). Limites: são **candidatos**, não confirmam que a loja vende o produto nem que está ativa; telefone/e-mail de MEI
podem ser dado pessoal (LGPD), então tratar com cuidado e com finalidade comercial B2B declarada.

### 10.4 Achado crítico: a telemetria atual NÃO sustenta os relatórios
Hoje `widget_events` guarda tenant, sessão, tipo, termo, produto, **cidade/UF** e `results_count`. Problemas:
- com **GPS do navegador**, cidade/UF ficam **nulas** (só o CEP preenche);
- **sem coordenada aproximada**, não há mapa de calor;
- **sem distância ao revendedor mais próximo** e sem separar físico de online no registro.

**Telemetria v2 (antes do go-live da New Millen):** acrescentar `lat_approx`/`lng_approx` (arredondadas a ~1 km),
`cep5` (5 primeiros dígitos, nunca o CEP inteiro), `location_source` (`cep`|`gps`|`none`), `nearest_km`,
`physical_count`, `online_count`; geocodificação reversa quando vier do GPS. **Por que antes:** dado de uso não se
reconstrói depois. Privacidade: nada de CEP completo nem coordenada precisa; descrever no aviso de privacidade.

### 10.5 Oferta e preço revisados (hipóteses; decisão final com o Danilo)
Âncora: **R$ 1.600/mês** (= R$ 19.200/ano) que a New Millen paga hoje. Sem plano básico: duas ofertas, ambas premium.

| Oferta | Preço de lista | O que entrega |
|---|---|---|
| **Radar de Cobertura** | **R$ 1.690/mês** | widget no site, painel com os relatórios acima, relatório mensal em PDF, **reunião mensal de cobertura**, atualização de catálogo mensal |
| **Radar + Expansão** | **R$ 2.690/mês** | tudo do Radar + **listas de prospecção por lacuna** (varejo e atacado), roteiro de abordagem, relatório regional para a equipe comercial |
| Implantação | **R$ 1.500** | importação e limpeza da base, instalação, treinamento da equipe (cortesia no contrato de 12 meses, mostrada na proposta) |

- **Piloto New Millen (preço de fundador):** Radar a **R$ 1.290/mês por 12 meses** (≈ 19% abaixo do que paga hoje; economia de
  R$ 3.720/ano), contrato de 12 meses, em troca de depoimento/caso e de ajudar a moldar o painel. Passa para a lista no
  renovar. Para fechar, prometer **entrega por marcos**, não por data fixa, até o painel existir.
- **Cenários revistos (hipóteses):** conservador 2–3 clientes ≈ R$ 3–4,5 mil de MRR; realista 6–8 ≈ R$ 9–13 mil; otimista
  15 ≈ R$ 25 mil (exige parceria/equipe). A seção 6 (Essencial R$ 247) **não** vale mais.

### 10.6 Plano de construção (blocos para o Claude)
| Bloco | Entrega | Porte | Precisa de OK |
|---|---|---|---|
| **B1 Telemetria v2** | colunas novas em `widget_events`, widget grava os campos, testes, geocodificação reversa no GPS | pequeno | **sim** (altera o banco de produção) |
| **B2 Painel v1** | login por tenant, os 4 relatórios (cobertura, funil, lacunas, mapa) | grande | não |
| **B3 Prospecção** | importador de CNPJ por município (n8n/script) → tabela de candidatos, tela e CSV | médio | sim (carga de dados) |
| **B4 Relatório mensal** | PDF/e-mail automático via n8n + roteiro da reunião | pequeno/médio | não |
Ordem: **B1 → go-live da New Millen com a telemetria já gravando → B2 → B4 → B3.**
Regra de capacidade: o relatório mensal tem de ser **automático**; senão o tempo do Junior vira o gargalo.

### 10.7 Riscos novos e perguntas para destravar
Riscos: volume de buscas insuficiente; prometer painel antes de existir; comparar publicamente com o Gofind; amostra
enviesada (só visitantes do site); privacidade da localização.

**Perguntas ao Danilo/New Millen:** (1) visitas/mês do site e página "onde comprar", e nº de buscas no Gofind hoje; (2) prazo,
renovação e multa do contrato com o Gofind (janela de troca); (3) quem usa o relatório na New Millen e quais KPIs importam;
(4) lista atual de revendedores (formato, tamanho, última atualização); (5) quantos produtos/SKUs e em que regiões querem expandir;
(6) frequência de reunião desejada; (7) o que exatamente achou pouco intuitivo no widget atual (para não repetir).

### Fontes desta seção
[Gofind: "Mapa de Positivação" e painéis](https://www.projetodraft.com/a-gofind-e-um-localizador-de-produtos-em-lojas-fisicas-do-brasil/) ·
[Base CNPJ aberta (Toexceed)](https://toexceed.com.br/blog/2026/09/27/base-cnpj-o-que-e-quais-dados-possui-e-como-consultar/) ·
[Dados abertos da Receita (Socialhub)](https://www.socialhub.pro/blog/dados-abertos-receita-federal-cnpj/) ·
[CNAE 4729-6/99](https://www.contabilivre.com.br/cnae/4729699-comercio_varejista_de_produtos_alimenticios_em_geral_ou_especializado_em_produtos_alimenticios_nao_especificados_anteriormente) ·
[CNAE atacado 4637-1/99 (IBGE)](https://concla.ibge.gov.br/busca-online-cnae.html?subclasse=4637199&tipo=cnae&view=subclasse)

## 11. Ideias do Junior e parecer (2026-10-02)

**Fatos novos:** a New Millen tem ~**1.000 visitas/mês no pico**; o teto de preço do Junior para ela é **R$ 1.000/mês**;
o diferencial precisa existir desde o primeiro dia.

**Ideias:** (A) busca sem revendedor na base (ex.: *whey* na Guilhermina, Praia Grande) vira relatório "x buscas do produto y no
bairro z, sem revendedor" **+ lista de empresas do CNAE do cliente num raio da busca**; (B) mesmo havendo revendedores
(ex.: 5 buscas de *creatina* no Aparecida, Santos, 3 revendedores), mostrar abaixo as empresas elegíveis que "parecem não vender" o
produto; (C) enriquecer a base da Receita com dados públicos mais atuais (site, endereço).

### 11.1 Parecer
**É a melhor ideia até agora**, porque transforma "perdemos uma venda" em "aqui está quem abordar". Três ajustes:

1. **Volume.** 1.000 visitas/mês ≈ **20 a 100 buscas/mês** (hipótese: 2–10% usam o widget; confirmar com o nº real de buscas no
   Gofind). Em nível bairro × produto quase toda célula terá 0 a 2 buscas, então **estatística de bairro não aparece por
   meses**. Saída: (a) cada busca sem cobertura vira um **alerta/lead imediato** (e-mail ou WhatsApp para a equipe
   comercial, já com os candidatos); (b) o relatório principal passa a ser o **mapa de lacunas por universo (CNAE)**, que **não
   depende de tráfego**: onde existem empresas elegíveis e a marca não tem ninguém; as buscas só **priorizam**.
2. **Linguagem e honestidade do dado.** Não dizer "não vendem"; dizer **"não constam na sua base"**. Não sabemos se vendem
   (podem comprar via distribuidor que a marca não lista). Incluir o **ciclo de feedback**: a equipe marca cada candidato
   (*vende / não vende / contatado / sem interesse*), o que melhora a base e vira ativo próprio (um fosso contra o Gofind).
   Métrica nova: **penetração local** = revendedores da base ÷ empresas elegíveis no raio (ex.: 3 de 28 = 11%). Usar um
   **score de aderência** (CNAE principal pesa mais que secundário; só situação *ativa*; porte; tempo de atividade).
3. **Dados públicos: o que dá e o que não dá.**
   - **Receita (CNPJ):** mensal; endereço pode estar defasado; traz CNAE principal e secundários, telefone, e-mail;
     telefone/e-mail de MEI podem ser dado pessoal (LGPD).
   - **OpenStreetMap:** existem as tags `shop=nutrition_supplements` e `shop=health_food`; gratuito (ODbL, com
     atribuição); **cobertura no Brasil precisa ser medida** antes de prometer.
   - **Google:** os termos **proíbem guardar resultados de geocodificação por mais de 30 dias** (exceção estreita, só
     para a funcionalidade direta do usuário final); raspar o Google Maps viola os termos. Usar só sob demanda e sem armazenar.
   - **Sites/endereços atuais:** só o que a própria empresa publica ou o cliente informa; verificação manual para as
     lacunas prioritárias, não em massa.
   - **Geocodificar candidatos em massa:** o Nominatim público proíbe uso pesado e o Google não permite guardar. Opções:
     Nominatim próprio na VPS (precisa de RAM/disco), provedor pago que permita armazenar, ou geocodificar **só os
     candidatos das cidades com lacuna** (volume pequeno).
   - **Contato:** a lista é para a **equipe do cliente ligar/visitar**; nada de disparo em massa por WhatsApp (LGPD/spam).

### 11.2 Como fica (exemplos de saída)
- **Alerta imediato:** "Busca de *whey*, bairro Guilhermina (Praia Grande): **0 revendedores** na base. **14 empresas elegíveis**
  em 3 km. [lista com endereço e telefone cadastral]".
- **Mapa de lacunas (mensal):** por cidade/bairro: empresas elegíveis × revendedores da base × buscas; ordenado por
  oportunidade.
- **Penetração local:** "Aparecida (Santos): 3 de 28 elegíveis na base (11%); 5 buscas de *creatina* no mês; 25 candidatos
  **não constam** na sua base. [lista]".

### 11.3 Preço revisto para a New Millen
Teto de R$ 1.000: **piloto a R$ 990/mês por 12 meses** (38% abaixo dos R$ 1.600 de hoje; economia de R$ 7.320/ano), com
contrapartidas: depoimento/caso, co-design do painel e validação dos candidatos (alimenta o feedback). **Preço de fundador não é
preço de lista:** a lista das ofertas Radar/Expansão (seção 10.5) segue como hipótese para os próximos clientes e depende de o
mapa de lacunas mostrar valor.

### 11.4 Ordem de construção revista
1. **B1 Telemetria v2**, agora **incluindo `bairro`** (o ViaCEP já devolve) além de cidade/UF, coordenada aproximada, `cep5`,
   `nearest_km`, contagens físico/online.
2. **Protótipo de prova de valor com dados reais da New Millen** (antes do painel): mapa de lacunas da região prioritária
   (ex.: Baixada Santista) em PDF/planilha, cruzando a lista de revendedores deles com a base de CNPJ. É o material de venda mais forte.
3. **B3-lite Prospecção:** carga de CNPJ por município/CNAE, candidatos com score, alerta por e-mail.
4. **B2 Painel v1** e **B4 Relatório mensal automático**.
Arquitetura: manter o arquivo bruto da Receita (vários GB) **na VPS** (n8n/script) e carregar no Supabase só o recorte
(CNAE × municípios do cliente), para não estourar o banco.

### 11.5 Perguntas que destravam
(1) Nº real de buscas/mês no Gofind e de visitas na página "onde comprar"; (2) lista atual de revendedores da New Millen
(com endereço); (3) **CNAEs do canal** deles (varejo de suplementos? farmácias? academias? atacado?); (4) região prioritária;
(5) quem recebe os alertas e por qual canal.

### Fontes desta seção
[Google Maps: termos do Geocoding (cache de 30 dias)](https://developers.google.com/maps/documentation/geocoding/policies) ·
[Google Maps Platform: termos específicos](https://cloud.google.com/maps-platform/terms/maps-service-terms) ·
[OSM: shop=nutrition_supplements](https://wiki.openstreetmap.org/wiki/Tag:shop=nutrition_supplements) ·
[OSM: shop=health_food](https://wiki.openstreetmap.org/wiki/Tag:shop=health_food) ·
[Política do Nominatim](https://operations.osmfoundation.org/policies/nominatim/)

## 12. Princípio de produto: o perfil de mercado de cada cliente vem da Receita (2026-10-02)

**Correção:** a Baixada Santista era só a região da demo, **não** o território da New Millen (que não atua lá diretamente), e o
exemplo da seção 11 não deve virar premissa. A New Millen é cliente **inicial**; o universo é grande. Dado novo: o Gofind dela
tem **no máximo ~500 acessos/mês**. **Foco que não muda:** empresas que **fabricam** algo e **dependem de pontos de venda**
(lojas físicas ou online, representantes ou distribuidores) para vender.

### 12.1 Cadastro por CNPJ → perfil de mercado
Fluxo: **CNPJ do cliente → consulta à Receita → perfil → segmento e canais sugeridos → territórios → confirmação → o sistema
monta o universo de empresas elegíveis daquele cliente.** Todo o resto (lacunas, candidatos, alertas, relatórios) lê o perfil
do tenant; nada fixo para suplementos.

- **Dados que vêm do CNPJ** (a API pública BrasilAPI/Minha Receita devolve): razão social, nome fantasia, **CNAE principal e
  secundários**, porte, situação cadastral, endereço, município/UF, e-mail. Serve também para **validar** que o cliente existe e
  está ativo.
- **Cuidado central:** o CNAE do fabricante diz **o que ele faz, não quem o revende**. Marcas que terceirizam a produção aparecem
  como atacadistas. Logo: **sugerir + confirmar**, com (a) uma **taxonomia de segmentos** (suplementos, cosméticos, pet,
  ferramentas, bebidas…), cada um ligado a um conjunto de **CNAEs de canal** (varejo, atacado, representantes), mantida e
  validada por humano e crescendo a cada cliente; (b) pergunta "o que você vende e por quais canais?".
- **Território** de cada cliente: UFs/municípios onde ele quer vender (padrão: onde já tem revendedores + a sede). Confirmar com o
  cliente; **não presumir**.

### 12.2 CNPJ como chave dos revendedores (ganho grande)
Adicionar **CNPJ** à planilha de revendedores e usar `unique(tenant_id, cnpj)`:
- **resolve a duplicação na reimportação** (decisão em aberto no status);
- **valida e completa** endereço/CEP/CNAE de cada revendedor;
- permite **verificação mensal automática**: "3 revendedores da sua base ficaram inativos/baixados na Receita este mês". Isso
  ataca de frente a reclamação "os dados demoram meses" (frescor automático).
Sem CNPJ (raro): cadastro manual, marcado como não verificado.

### 12.3 Duas camadas de rede, duas visões
Marca → **distribuidor/representante** (B2B) → **loja** (B2C). O consumidor só vê lojas; a equipe comercial precisa de **duas visões**:
cobertura B2C (lojas, por raio de km) e cobertura B2B (distribuidores/representantes, por **território**, não por raio). Online:
sem raio; o relatório trata "presença em marketplaces/sites" à parte.

### 12.4 Dados e infraestrutura
- Base da Receita: CSV mensal (Empresas, Estabelecimentos, Sócios, tabelas auxiliares), **~85 GB descompactados** (fonte
  secundária) → **manter na VPS**, não no Supabase. CNAE secundário vem numa coluna separada por vírgula.
- **Recorte por tenant** (CNAEs de canal × territórios, só ativos) vai para o Supabase; atualização mensal por n8n/script.
- API (BrasilAPI) só para **consulta unitária no cadastro**, com cache; é serviço de terceiros: limites e disponibilidade
  **não verificados**, ter plano B (nossa própria carga).
- Geocodificação: só dos candidatos das cidades com lacuna (ver 11.1); CEP→coordenada quando possível.
- LGPD: dado de PJ é público; telefone/e-mail de MEI podem ser pessoais; uso B2B, com política de privacidade e opt-out.

### 12.5 Volume (≤ 500 acessos/mês)
Reforça a seção 11: **alerta por busca sem cobertura** + **mapa de lacunas por universo**, e relatórios agregados por cidade/UF
(não por bairro) até o tráfego crescer.

### 12.6 Ordem de construção revista
**B1 Telemetria v2** (genérica, com `bairro`) → **B0 Perfil do tenant por CNPJ** (cadastro, segmento, canais, territórios,
CNPJ como chave de revendedor, verificação mensal) → **B3 Candidatos por tenant** → **prova de valor com a New Millen no
território DELA** → **B2 Painel** → **B4 Relatório mensal**.

### 12.7 Bônus: o mesmo motor gera leads para o próprio GeoLynq
Com a mesma base: listar **fabricantes/marcas** por CNAE e UF (o nosso cliente ideal) para o Danilo prospectar, qualificando
pelo sinal "o site tem página 'onde comprar' ou 'seja um revendedor'?".

### 12.8 Perguntas
(1) **CNPJ da New Millen**; (2) **onde ela atua/quer vender** (UFs, cidades) e **quais canais** usa (lojas, representantes,
distribuidores; físicos/online); (3) primeira versão da **taxonomia de segmentos** (quais verticais priorizar além de suplementos).

### Fontes desta seção
[BrasilAPI (docs)](https://brasilapi.com.br/docs) ·
[Dados abertos CNPJ: guia (Toexceed)](https://toexceed.com.br/blog/2026/09/27/dados-abertos-cnpj-receita-federal-o-guia-completo-para-acessar-e-utilizar/) ·
[Exemplo de uso do dump (~85 GB)](https://github.com/christiano-gonara/teste-abrasel-dados) ·
[Layout oficial (Receita Federal)](https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf)

## 13. Visão do produto (confirmada com o Junior em 2026-10-02)

**Duas frentes visíveis + um motor de dados com backoffice.**

| Camada | Quem usa | O que faz | Estado |
|---|---|---|---|
| **1. Widget** (seção "onde encontrar" e páginas de produto do site do fabricante) | consumidor final | **serviço** (acha o revendedor) e **sensor de demanda** (registra a busca) | **no ar** |
| **2. Plataforma web** | time comercial, trade marketing, gestores regionais | **ver** o cenário de atendimento atual; **descobrir** lacunas; **agir** (candidatos, alertas, status, exportação) | **não existe** (B2) |
| **3. Motor de dados + backoffice** | GeoLynq (Junior/Danilo) | cadastro por CNPJ, segmentos/CNAE de canal, importação de catálogo, base da Receita, verificação mensal, monitoramento | **parcial** (importação por n8n) |

**Ajustes à formulação original:**
1. A plataforma **não é baseada só na navegação**. Três fontes: (a) **navegação no widget** = demanda/prioridade; (b) **base do
   cliente** (produtos, revendedores, cobertura) = "cenário de atendimento atual"; (c) **universo da Receita** (CNPJ × CNAE de
   canal × território) = lacunas e candidatos. Com ≤ 500 acessos/mês, só a navegação seria rala.
2. A plataforma **não é só gráficos e relatórios**: precisa do **ciclo de ação** (alerta, lista de candidatos, marcar *vende / não
   vende / contatado*, exportar); é o que a distingue de um dashboard passivo.
3. Existe a **terceira camada** (motor + backoffice), invisível ao cliente e necessária: sem ela não há cadastro por CNPJ nem
   universo de empresas.
