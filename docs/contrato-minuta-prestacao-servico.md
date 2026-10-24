<!--
  GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
  Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
  total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
  Unauthorized copying, replication, redistribution or commercial use is prohibited.
-->
# MINUTA — Contrato de prestação de serviços de software (GeoLynq) e tratamento de dados pessoais

> **RASCUNHO DE TRABALHO. NÃO FOI REVISADO POR ADVOGADO. NÃO É ORIENTAÇÃO JURÍDICA.**
> Escrito em 2026-10-24 a partir do que o sistema **realmente faz hoje** (código e banco conferidos). Tudo entre **[colchetes]** é lacuna ou decisão que ainda não foi tomada.
> O plano de 2026-10-15 (seção 2.4) recomenda revisão de advogado antes de assinar com a primeira cliente real.

---

## PARTE A — Leia antes (fora do contrato): pontos que precisam de decisão ou de um profissional

1. **Cadeia de direitos sobre o software (o mais importante).** O software é de **Jucimar Lopes (Personal Support)** e a licença (`LICENSE`) proíbe cópia e comercialização sem autorização escrita. Quem vende e emite nota é a **DCM Marketing Digital**. Falta um **documento entre os dois** (licença/parceria de comercialização, com remuneração e prazo) que autorize a DCM a licenciar o GeoLynq a clientes. Sem ele, o contrato abaixo promete algo que a DCM não tem por escrito. A cláusula 8 assume que esse documento existe.
2. **A DCM é MEI** (Danilo Carlos Machado, CNPJ 52.721.470/0001-48). **Peça a um contador** para conferir: (a) se a atividade "licenciamento/suporte de software" cabe no cadastro do MEI; (b) o **limite anual de faturamento do MEI**, que pode ser ultrapassado se houver mais de uma ou duas clientes nos valores do plano; (c) responsabilidade pessoal do titular. Não verifiquei nada disso.
3. **Não prometa SLA nem backup.** Hoje o banco está no plano **grátis** do Supabase: ficou **fora do ar ~24 h em 15–16/10** e **de novo em 23/10**, e esse plano **não faz backup automático**. O plano comercial (`docs/operacao-e-mercado.md`) cita "SLA" na faixa Indústria: **tire** ou só ofereça depois de migrar para o Supabase Pro e ter backup. A cláusula 7 foi escrita como "melhor esforço".
4. **O visitante do widget fala com terceiros direto do navegador.** O código consulta o **ViaCEP** (CEP) e o **OpenStreetMap/Nominatim** (endereço e coordenadas). Esses serviços recebem o CEP/coordenada e o **IP** do visitante, fora do controle do GeoLynq. A página de privacidade do widget **não menciona isso hoje**: acrescentar uma frase (posso fazer; precisa de novo deploy).
5. **A leitura por IA envia dados ao exterior.** O painel manda um resumo (números e textos que já estão no painel, que podem incluir termos buscados) à API da **Anthropic**. É um subprocessador e uma possível **transferência internacional** (LGPD, art. 33). Por isso o Anexo II o lista. Se a cliente recusar, dá para desligar a leitura por IA para ela.
6. **Valores do plano são hipóteses**, e o teto do Junior para a New Millen era diferente da oferta de tabela. Os preços estão como placeholders no Anexo IV.
7. **Reajuste, multa e juros** (2% de multa e 1% ao mês) são práticas comuns de mercado, **não** orientação jurídica: confirmar.
8. **Foro e assinatura.** Sugeri o foro de Praia Grande/SP (sede da DCM) e assinatura eletrônica. Confirmar.
9. **Papéis na LGPD.** Esta minuta trata a **cliente como controladora** dos dados da medição do widget no site dela e a **DCM como operadora**. Os contatos que chegam pelo formulário da **landing** do GeoLynq são outra coisa: aí a **DCM é controladora** (já descrito na página de privacidade da landing). Não misturar.

---

## PARTE B — Texto do contrato

**CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE SOFTWARE E TRATAMENTO DE DADOS PESSOAIS**

**CONTRATADA:** DCM MARKETING DIGITAL, [forma jurídica: microempreendedor individual, titular Danilo Carlos Machado], inscrita no CNPJ sob o nº 52.721.470/0001-48, com sede em Praia Grande/SP, [endereço completo], e-mail [e-mail da DCM], doravante **CONTRATADA**.

**CONTRATANTE:** [razão social], CNPJ [nº], sede em [endereço], representada por [nome e cargo], e-mail [e-mail], doravante **CONTRATANTE**.

As partes resolvem celebrar este contrato, que se rege pelas cláusulas abaixo.

### 1. Objeto

1.1. A CONTRATADA concede à CONTRATANTE o direito de uso, **não exclusivo e intransferível**, do serviço **GeoLynq** ("Serviço"), que compreende: (a) o localizador "Onde encontrar" (widget) a ser instalado no site da CONTRATANTE; (b) o **painel** de acompanhamento de buscas, cobertura e lacunas; (c) a **importação** do catálogo de produtos e da rede de revendedores a partir de planilha; (d) o suporte descrito na cláusula 7. O detalhamento está no **Anexo I**.

1.2. O Serviço **não** garante vendas, nem que um revendedor listado mantenha o produto em estoque, nem a exatidão de dados de terceiros usados como apoio (por exemplo, dados públicos do cadastro de CNPJ). Resultados de busca e de "lacunas" são **indicadores**, não afirmações sobre um revendedor ou concorrente.

### 2. Definições

**Dados da CONTRATANTE:** catálogo, lista de revendedores e demais informações que a CONTRATANTE fornecer. **Dados de medição:** registros gerados pelo widget no site da CONTRATANTE (termos de busca, produto escolhido, localização aproximada, cliques e código aleatório de visita). **LGPD:** Lei nº 13.709/2018. **Subprocessador:** terceiro contratado pela CONTRATADA que trata Dados de medição em nome dela (Anexo II).

### 3. Prazo

3.1. O contrato vigora por **12 (doze) meses** a partir da assinatura. [Decidir: renovação automática por períodos de 12 meses, com aviso de não renovação de 30 dias; ou renovação só por escrito.]

### 4. Preço e pagamento

4.1. A CONTRATANTE pagará a **implantação** e a **mensalidade** do **Anexo IV**, mediante nota fiscal emitida pela CONTRATADA, com vencimento até o dia [dia] de cada mês.

4.2. Reajuste a cada 12 meses pela variação do **IPCA** acumulada no período. [Confirmar índice.]

4.3. Atraso: multa de [2%] e juros de [1% ao mês] sobre o valor devido, mais correção pelo índice do item 4.2. [Confirmar com advogado.]

### 5. Obrigações da CONTRATADA

5.1. Disponibilizar o Serviço conforme o Anexo I; zelar pela segurança dos dados conforme o Anexo V; tratar os Dados de medição **somente** conforme a cláusula 9; prestar o suporte da cláusula 7; avisar com antecedência razoável sobre manutenções que possam indisponibilizar o Serviço.

### 6. Obrigações da CONTRATANTE

6.1. Fornecer dados corretos e atualizados, com **CNPJ válido** para cada revendedor; manter a lista atualizada; instalar o widget conforme as instruções e **exibir o aviso de medição e o link da página de privacidade** que acompanham o widget; **não** inserir no catálogo nem em campos livres dados pessoais ou sensíveis de terceiros; não usar o Serviço de modo ilícito, nem para identificar ou perfilar pessoas.

6.2. A CONTRATANTE declara ter **base legal** para a medição no seu site (indicada no Anexo III) e responde pelo conteúdo do seu site e pelo relacionamento com seus visitantes e revendedores.

### 7. Disponibilidade e suporte

7.1. O Serviço é prestado em regime de **melhor esforço**. **Não há garantia de disponibilidade contínua nem nível de serviço (SLA) com créditos**, e a CONTRATADA **não se compromete com backup e restauração dos dados** além do descrito no Anexo V. [Revisar quando o banco migrar para plano com backup e SLA.]

7.2. Suporte por e-mail ([e-mail]) em dias úteis, com primeira resposta em até [2 dias úteis]. Falhas graves (Serviço totalmente indisponível) terão prioridade.

7.3. A CONTRATADA monitora a disponibilidade do Serviço e poderá comunicar interrupções relevantes à CONTRATANTE.

### 8. Propriedade intelectual

8.1. O software GeoLynq, sua marca, código, documentação e melhorias são de titularidade de **Jucimar Lopes (Personal Support)**, licenciados à CONTRATADA para comercialização [conforme instrumento próprio entre eles, a ser firmado: ver Parte A, item 1]. **Nada neste contrato transfere propriedade** do software à CONTRATANTE.

8.2. É vedado à CONTRATANTE copiar, redistribuir, sublicenciar, descompilar ou usar o Serviço para criar produto concorrente, salvo autorização escrita.

8.3. Os **Dados da CONTRATANTE** (catálogo, lista de revendedores) **continuam sendo dela**. A CONTRATADA poderá usar **estatísticas agregadas e anonimizadas**, sem identificar a CONTRATANTE, para melhorar o Serviço. [Decidir se mantém.]

### 9. Proteção de dados pessoais (LGPD)

9.1. **Papéis.** Quanto aos **Dados de medição**, a CONTRATANTE é **controladora** e a CONTRATADA é **operadora**, e trata os dados **somente** para prestar o Serviço e conforme as instruções documentadas da CONTRATANTE (este contrato e seus anexos).

9.2. **O que o Serviço registra** (Anexo III): termo digitado na busca (textos que parecem telefone, e-mail ou documento são descartados), produto escolhido, localização aproximada (cidade, bairro, 5 primeiros dígitos do CEP, coordenadas arredondadas), cliques em revendedor, data e hora e um código aleatório da visita que só existe na memória da página. **Não** registra nome, e-mail, telefone, CPF, endereço completo, cookies de rastreio entre sites nem IP **na base de medição**. O aviso do widget permite **recusar** a medição.

9.3. **Subprocessadores.** A CONTRATANTE autoriza os subprocessadores do **Anexo II**. A CONTRATADA avisará por e-mail, com [15 dias] de antecedência, sobre inclusão ou troca; a CONTRATANTE poderá se opor por motivo razoável, e não havendo acordo poderá rescindir sem multa.

9.4. **Transferência internacional.** Alguns subprocessadores armazenam ou processam dados fora do Brasil (Anexo II). A CONTRATADA adotará as salvaguardas exigidas pela LGPD [indicar o mecanismo adotado: cláusulas-padrão, adequação ou outro; **confirmar com advogado**].

9.5. **Segurança.** A CONTRATADA mantém as medidas do **Anexo V** e as revisará conforme a evolução técnica. A CONTRATADA **não garante** ausência total de incidentes.

9.6. **Confidencialidade.** Quem na CONTRATADA acessa Dados de medição está sujeito a dever de sigilo.

9.7. **Incidentes.** A CONTRATADA comunicará a CONTRATANTE por e-mail, em até **[48 horas]** da ciência, sobre incidente de segurança que envolva Dados de medição, com as informações disponíveis (natureza, dados afetados, medidas adotadas), para que a controladora cumpra suas obrigações legais.

9.8. **Direitos dos titulares.** A CONTRATADA auxiliará a CONTRATANTE, dentro do que for tecnicamente possível, a atender pedidos de titulares. Como os registros são anônimos, em geral não é possível ligar um registro a uma pessoa; isso será informado ao titular.

9.9. **Retenção, devolução e eliminação.** Registros individuais de medição são **apagados automaticamente após 12 meses** (rotina diária). Ao fim do contrato, a CONTRATANTE terá [30 dias] para **exportar** seus Dados; depois a CONTRATADA os **eliminará** em até [60 dias], salvo obrigação legal de guarda.

9.10. **Informações e auditoria.** A CONTRATADA fornecerá informações razoáveis para demonstrar conformidade. Auditoria presencial ou por terceiro depende de acordo prévio, **no máximo uma vez por ano**, com aviso de [30 dias], sigilo e custo da CONTRATANTE.

9.11. **Contato (privacidade):** [e-mail do encarregado/contato da CONTRATADA; hoje a página de privacidade usa personalsupport@hotmail.com] e [contato da CONTRATANTE].

### 10. Confidencialidade

10.1. Cada parte manterá em sigilo as informações confidenciais da outra recebidas por força deste contrato, durante a vigência e por [5 anos] após o término, exceto o que for público, já conhecido ou exigido por lei ou ordem judicial.

### 11. Limitação de responsabilidade

11.1. A responsabilidade total da CONTRATADA por danos decorrentes deste contrato fica limitada ao **valor pago pela CONTRATANTE nos 12 meses anteriores** ao fato, **exceto** em caso de dolo. Nenhuma das partes responde por lucros cessantes ou danos indiretos. [**Validar com advogado**: a eficácia e o alcance dessa limitação.]

11.2. A CONTRATADA não responde por indisponibilidade de serviços de terceiros que o Serviço utiliza (Anexo II) além do esforço razoável para contorná-la.

### 12. Rescisão

12.1. Qualquer parte pode rescindir por **descumprimento** não sanado em **[15 dias]** após notificação escrita.

12.2. [Decidir: rescisão sem motivo durante o prazo de 12 meses, com aviso de 30 dias e multa de [__]% das mensalidades restantes; ou sem rescisão antecipada.]

12.3. Rescindido ou encerrado o contrato, aplica-se a cláusula 9.9 e permanecem as cláusulas de confidencialidade, propriedade intelectual e limitação de responsabilidade.

### 13. Disposições gerais

13.1. Comunicações por e-mail para os endereços do preâmbulo. 13.2. Este contrato e seus anexos são o acordo integral; alterações só por escrito. 13.3. A tolerância de uma parte não é renúncia. 13.4. Nenhuma parte cede o contrato sem consentimento escrito da outra. 13.5. Pode ser assinado **eletronicamente**, nos termos da legislação aplicável.

### 14. Foro

14.1. Fica eleito o foro da comarca de **[Praia Grande/SP — confirmar]**, com renúncia a qualquer outro.

[Local], [data].

______________________________ DCM Marketing Digital (CONTRATADA)

______________________________ [Razão social] (CONTRATANTE)

---

## ANEXO I — Escopo e entregáveis [ajustar à proposta]

| Item | Descrição |
|---|---|
| Widget | Localizador "Onde encontrar" no site da CONTRATANTE, com cores e tema ajustados; raio de busca de 100 km; contato por WhatsApp, ligação, rota e site |
| Painel | Acesso com login a buscas, funil de uso, mapa de cobertura, lacunas por produto e cidade, rede de revendedores e importações; leitura do período escrita por IA com números conferidos |
| Importação | Cadastro da marca, importação do catálogo e dos revendedores por planilha (com CNPJ), conferência de erros e reimportação sem duplicar |
| Implantação | Instalação do widget, treinamento da equipe [nº de horas] |
| Fora do escopo | Integração com ERP/loja, domínio próprio do painel, relatório mensal automático, mapa de oportunidades com base de CNPJ [incluir só se contratado] |

## ANEXO II — Subprocessadores e destinatários de dados (conferido no código em 2026-10-24)

| Quem | Para quê | Dados | Onde |
|---|---|---|---|
| **Supabase** | Banco de dados e API do Serviço | Dados da CONTRATANTE e Dados de medição | Servidor em **São Paulo** (região sa-east-1); a empresa é estrangeira [confirmar] |
| **Hostinger + EasyPanel** | Servidor (VPS) que hospeda widget, painel, n8n e landing | Tráfego e registros técnicos; sem Dados de medição gravados no disco além do banco acima | [confirmar país do data center] |
| **n8n (instalação própria, na VPS)** | Importação de planilhas e avisos | Dados de revendedores da CONTRATANTE; contatos da landing | VPS acima |
| **Google (Planilhas/Drive)** | Fonte da planilha de importação | Lista de revendedores (empresas) da CONTRATANTE | [EUA/global; confirmar] |
| **Resend** | E-mails de aviso da CONTRATADA | Contatos do formulário da landing (controle da DCM); não Dados de medição | EUA [confirmar] |
| **Anthropic (API de IA)** | Leitura do período no painel | Resumo numérico e textos que já aparecem no painel, podendo incluir termos buscados | EUA [confirmar]; **pode ser desligado a pedido** |
| **UptimeRobot** | Monitoramento externo | Apenas endereços públicos; sem dados pessoais | [confirmar] |
| **ViaCEP** e **OpenStreetMap/Nominatim** | Localizar CEP e endereço **no navegador do visitante** | CEP/endereço/coordenada e o **IP do visitante**, recebidos direto por eles | Fora do controle da CONTRATADA; **declarar na página de privacidade do widget** |
| **BrasilAPI** | Consulta unitária de CNPJ no cadastro de clientes | CNPJ (empresa) | [confirmar] |

## ANEXO III — Descrição do tratamento (Dados de medição)

| Dado | Finalidade | Base legal (a cargo da CONTRATANTE) | Prazo |
|---|---|---|---|
| Termo digitado, produto escolhido, lista aberta | Saber o que é procurado e onde faltam revendedores | Legítimo interesse da CONTRATANTE (LGPD, art. 7º, IX), com aviso e opção de recusar | 12 meses; depois apagado |
| Localização aproximada (cidade, bairro, 5 dígitos do CEP, coordenada arredondada) | Mapa de cobertura e lacunas | idem | 12 meses |
| Cliques (WhatsApp, rota, ligação, site) | Desempenho por revendedor | idem | 12 meses |
| Data/hora e código aleatório da visita | Funil de uso; limite de abuso | idem | 12 meses |

## ANEXO IV — Condições comerciais [placeholders]

| Item | Valor |
|---|---|
| Implantação | R$ [____] (cortesia no contrato de 12 meses, se aplicável) |
| Mensalidade | R$ [____] por mês |
| Vencimento | dia [__] |
| Reajuste | IPCA a cada 12 meses |
| Piloto/preço de fundador | [condições, se houver] |

## ANEXO V — Medidas de segurança (estado real em 2026-10-24)

**Existem hoje:** conexão criptografada (HTTPS) em todos os endereços; isolamento por cliente no banco (RLS); chave `service_role` e senhas fora do código e fora de páginas públicas; chave pública do banco apenas com permissões mínimas; **limite de abuso** nos registros do widget; **apagamento automático** de dados por prazo; monitoramento de disponibilidade a cada 5 minutos, por dentro e por fora; acesso ao painel com login; cópias semanais do servidor (VPS) pela Hostinger.

**NÃO existem hoje (não prometer):** backup automático do **banco de dados** (plano grátis do Supabase); SLA de disponibilidade; auditoria ou certificação de segurança por terceiro; teste de intrusão; plano formal de resposta a incidentes escrito.
