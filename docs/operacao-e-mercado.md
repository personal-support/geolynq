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

| Etapa | Estado hoje |
|---|---|
| Widget no site do cliente (2 linhas de HTML, Shadow DOM, qualquer CMS) | **No ar** |
| Busca → CEP/localização → revendedores até 100 km (+ lojas online) → WhatsApp/Ligar/Site/Como chegar | **No ar** |
| Telemetria (cada busca e clique, anônima) | **Gravando** |
| Importação de catálogo por planilha (n8n) | **Funciona**, trigger manual |
| Site de amostra (demo) | **No ar** |
| Deploy automático por push | **No ar** (sem testes antes) |
| Criar cliente (tenant) | **Manual**, por SQL |
| Painel do cliente + relatórios (Fase 5) | **Não existe** |
| Login do cliente, atualização de catálogo sozinho | **Não existe** |
| Cobrança | Manual (PIX/boleto) por decisão do blueprint |

**Consequência honesta:** até a Fase 5, o GeoLynq é um **serviço apoiado por produto**: o cliente manda planilha e
recebe relatório; quem opera é você.

## 2. Implantação de um novo cliente (roteiro)

| Quando | Quem | O quê |
|---|---|---|
| Antes | Danilo | Qualificar: o site aceita colar script? Quantos produtos/revendedores? Quem é o webmaster? Hoje usa Gofind? |
| Dia 0–1 | Danilo | Demo (`demo.geolynq…`), proposta, aceite e contrato |
| Dia 1–2 | Junior | Criar o tenant (slug, nome, cor) e enviar a planilha-modelo |
| Dia 2–5 | Cliente + Junior | Cliente preenche; rodar a importação; ler `import_batches`; corrigir erros **por linha** com o cliente |
| Dia 5–7 | Webmaster do cliente | Colar o snippet em staging, validar numa página de produto, comparar lado a lado com a solução atual, ir ao ar |
| D+7 e D+30 | Junior | Primeiro relatório de uso; revisão de 30 dias; atualização mensal/trimestral do catálogo |

Pré-requisitos do cliente: lista de revendedores (nome, tipo, endereço ou CEP, telefone/WhatsApp), SKUs, acesso ao site.
Tempo estimado de implantação: **6 a 10 horas de trabalho** (hipótese). Risco nº 1 de churn: planilha ruim e dado desatualizado.

## 3. Como o cliente usa
- **Equipe comercial/marketing do fabricante:** envia a planilha, lê o relatório (buscas, produtos sem cobertura, regiões
  com demanda, cliques em revendedor). Hoje por e-mail/PDF; na Fase 5, por painel com login.
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
