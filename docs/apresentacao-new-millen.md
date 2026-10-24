<!--
  GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
  Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
  total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
  Unauthorized copying, replication, redistribution or commercial use is prohibited.
-->
# Apresentação à New Millen — material comercial (2026-10-24)

Preço definido pelo Junior em 24/10/2026: **piloto de R$ 990,00/mês, 12 meses, implantação sem custo.**
Quem apresenta à New Millen é o **Danilo (DCM Marketing Digital)**. O contrato é da DCM. Este arquivo tem 4 partes:
**A** resumo de 1 página para o Danilo; **B** roteiro da demonstração; **C** mensagem pronta para o Danilo; **D** checklist interno (Junior).

---

## A. Resumo de 1 página (para o Danilo usar na conversa)

**GeoLynq — Radar de Cobertura. Proposta piloto para a New Millen**

**O problema (segundo a New Millen):** a ferramenta atual atualiza os dados com meses de atraso e o localizador no site é pouco intuitivo.

**O que é o GeoLynq:**
1. **Widget no site da New Millen.** O consumidor digita o CEP e vê o revendedor mais próximo, com WhatsApp, telefone e rota. Visual no padrão da marca.
2. **Painel para o time comercial.** Mostra onde a marca está (rede de revendedores), como está (buscas e cliques por produto e região) e onde **não** está (buscas de consumidores em cidades sem revendedor).
3. **Dado fresco.** Cada busca real feita no site aparece no painel em minutos, e não em meses.

**O que a New Millen recebe (por marcos, não por data fixa):**
| Marco | O que entrega | Situação |
|---|---|---|
| 1 | Widget no site, painel, importação da lista de revendedores, atualização mensal da lista | Pronto para implantar |
| 2 | Lista de candidatos a revendedor por lacuna (a partir de dados públicos da Receita Federal) | Em desenvolvimento, sem data fixa |
| 3 | Relatório mensal em PDF | Em desenvolvimento, sem data fixa |
| — | Reunião mensal de 30 minutos para ler o painel [confirmar quem conduz] | Combinar |

**Investimento:** R$ 990,00 por mês, preço fixo durante 12 meses. Implantação sem custo (valor de tabela R$ 1.500,00).
Hoje a New Millen paga R$ 1.600/mês (valor informado por ela): economia de R$ 610/mês, **R$ 7.320 em 12 meses**.
Em troca: depoimento ou caso de uso **aprovado por escrito por ela** e feedback para melhorar o painel.

**Do que precisamos da New Millen:**
1. Lista de revendedores **com CNPJ**, endereço ou CEP, telefone/WhatsApp e tipo (loja, distribuidor, online).
2. Lista de produtos: código (SKU), nome, categoria e **link da foto**.
3. Decisão de onde o widget aparece: página "Onde encontrar" no site institucional (WordPress), páginas de produto da loja (Nuvemshop), ou os dois. A instalação é feita pela DCM, que mantém os dois sites: 2 linhas de código, cerca de 15 minutos. Não precisamos de senha de nada.
4. E-mail de quem vai usar o painel.

**Limites que dizemos de frente:**
- O painel mostra os visitantes **do site da New Millen**. Com poucas visitas, os gráficos ficam enxutos.
- Um revendedor que não aparece na base é "não consta na nossa base", e não "não vende".

---

## B. Roteiro da demonstração (15 a 20 min)

**Antes de começar (Junior prepara):**
- Tenha prints de cada tela como plano B, caso a internet falhe.
- Dados do painel de demonstração são **simulados**. Diga isso logo no início (a tela já traz o aviso).
- Danilo precisa de um usuário de demonstração do painel [pendente: o Junior cria].

| # | Mostrar | Dizer | Evitar |
|---|---|---|---|
| 1 | Site de amostra: `https://demo.geolynq.personalsupport.tech` (marca fictícia "Pódio", no estilo da New Millen) | "Este é um site de exemplo. O da New Millen terá a sua marca" | Usar logo ou fotos reais da New Millen sem autorização |
| 2 | Digitar um CEP de Santos/SP e abrir o resultado | "O consumidor acha o revendedor mais próximo em 3 toques e chama no WhatsApp" | Prometer rota de entrega ou estoque em tempo real |
| 3 | Painel, tela **Rede** | "Onde a marca está hoje: por cidade, tipo, e se o cadastro está completo" | Dizer que cobre "todo o Brasil" sem a lista deles |
| 4 | Painel, tela **Visão geral** | "Como está: o que as pessoas buscam e clicam" | Tratar número simulado como real |
| 5 | Painel, tela **Lacunas** | "Onde não está: buscas em cidades sem revendedor por perto" | "A loja X não vende". Diga "não consta na base" |
| 6 | Falar do Marco 2 (lista de candidatos), **sem tela** | "A seguir, para cada lacuna, uma lista de lojas candidatas. Estamos construindo, sem data fixa" | Mostrar como se estivesse pronto |
| 7 | Proposta (parte A) | "Piloto de R$ 990 por 12 meses, implantação sem custo" | Citar o Gofind pelo nome ou afirmar como a ferramenta deles funciona |
| 8 | Pedido (parte C, itens 1 a 4) | "Se a lista chegar até segunda, 26/10, colocamos no ar até sexta, 30/10" | Aceitar prazo sem a lista em mãos |

**Perguntas que a New Millen vai fazer, e a resposta honesta:**
- *"E se cair?"* O sistema tem monitoramento a cada 5 minutos. Não há garantia formal de disponibilidade (SLA) nesta fase.
- *"Os dados dos visitantes?"* Medição anônima: sem nome, e-mail ou telefone do visitante. Apagamento automático em 12 meses. Aviso completo em `https://widget.geolynq.personalsupport.tech/privacidade.html`.
- *"E se quisermos sair?"* Contrato de 12 meses. As condições de saída e a devolução dos dados estão no contrato.
- *"Quantas visitas precisamos?"* Não há mínimo, mas poucas visitas = poucos dados. Perguntar o volume do site.

---

## C. Mensagem pronta para o Danilo (WhatsApp)

> Danilo, fechei o material para a New Millen.
>
> **Proposta:** piloto de 12 meses por **R$ 990/mês**, implantação sem custo, em troca de depoimento (que eles aprovam por escrito). Hoje eles pagam R$ 1.600 ao Gofind (valor que eles informaram), então a economia é de R$ 7.320 no ano.
>
> **Antes de apresentar, descubra com eles:**
> 1. **Onde o widget vai ficar?** Só na página "Onde encontrar" do site institucional (WordPress), nas páginas de produto da Nuvemshop, ou nos dois? (Atenção: na loja, o widget leva o consumidor para um revendedor em vez de comprar na loja própria. A New Millen precisa querer isso.)
> 2. **Quantas visitas por mês** tem cada um (site institucional e loja)? Pegue do Google Analytics ou da Nuvemshop.
> 3. Quantos revendedores eles têm e a lista tem o CNPJ de cada um?
> 4. Quantos produtos (SKUs) e se têm foto de cada um?
> 5. Quem assina o contrato pela New Millen? (O site quem cola é você mesmo.)
>
> **Se disserem sim, peça até segunda (26/10):**
> - planilha de revendedores **com CNPJ** (eu mando o modelo);
> - lista de produtos com link das fotos;
> - e-mail de quem vai usar o painel.
>
> **Prazo:** 1º de novembro é **domingo**. Como o site é você que mexe, proponho colocar no ar até **sexta, 30/10**, se a lista chegar na segunda. Se chegar depois, vira segunda 02/11 ou terça 03/11.
>
> **Instalação:** você cola as 2 linhas primeiro numa **página rascunho** do WordPress (e num teste da Nuvemshop, se for usar lá) e só publica depois que eu conferir. Quando eu cadastrar a New Millen, te passo o código exato.
>
> **Privacidade:** a política de privacidade do site da New Millen precisa citar o widget (busca por CEP/localização e medição anônima de uso). Eu te mando o texto.
>
> **Importante:** não prometa relatório em PDF nem a lista de candidatos a revendedor com data. Diga que vêm em marcos, sem data fixa.
>
> Contrato: a minuta está pronta, mas ainda vou passar por revisão antes de assinar. Não mande contrato para eles ainda.

---

## D. Checklist interno (Junior) antes de ligar para valer

Prazo do compromisso com o Danilo: **01/11 (domingo)**. Meta realista: **sexta, 30/10**.

| # | Item | Quem | Estado |
|---|---|---|---|
| 1 | **Lista de revendedores com CNPJ**, produtos e fotos | New Millen via Danilo | Pendente (maior risco) |
| 2 | Instalação do widget. **Resolvido em parte:** o Danilo faz os dois sites (WordPress/HostGator e Nuvemshop). Falta decidir **onde** vai o widget e testar o script na Nuvemshop (não verifiquei se o tema aceita script externo) | Danilo | Parcial |
| 3 | **Contrato:** licença Jucimar↔DCM, MEI (contador), advogado, vencimento e preço pós-piloto | Junior + Danilo | Minuta pronta; revisão pendente |
| 4 | **Supabase Pro** (US$ 25/mês, ~13% da mensalidade): sem ele não há backup do banco | Junior decide | Pendente |
| 5 | Usuário de demonstração do painel para o Danilo | Eu / Junior | Pendente |
| 6 | Confirmar que o painel (`geolynq_admin`) está no ar e com a versão atual | Eu | A conferir |
| 7 | Cadastro da New Millen pelo CNPJ `00385181000111` (conferência, depois gravar) | Eu | Pronto para rodar |
| 8 | Planilha-modelo `docs/geolynq-catalogo-modelo.xlsx` enviada ao Danilo | Junior | Pendente |
| 9 | Frase sobre ViaCEP/OpenStreetMap na página de privacidade do widget (novo deploy) | Eu, com OK do Junior | Pendente |
| 10 | Ir ao ar: Danilo cola o script em página **rascunho**, eu confiro com 10 CEPs de teste, depois ele publica; monitor ativo | Danilo + eu | Depois dos itens 1 a 4 |
| 12 | Política de privacidade do **site da New Millen** citar o widget (ela é a controladora). Eu escrevo o texto, o Danilo publica | Eu + Danilo | Pendente |
| 13 | Decidir se o widget entra na loja (Nuvemshop): conflito entre vender na loja própria e indicar revendedor | New Millen | Pendente (decisão de negócio) |
| 11 | Avisar o Danilo do novo remetente `avisos@personalsupport.tech` | Junior | Pendente |

**Observações técnicas (verificadas no código em 24/10):**
- O widget **não trava por domínio**: funciona em qualquer site com o código e o `tenant`. Não precisa cadastrar o endereço da WordPress nem da Nuvemshop.
- O evento de busca **não guarda a página de origem**: se o widget ficar nos dois sites, o painel mistura os dois e **não separa** quem buscou onde. Se a New Millen quiser separar, precisa de um campo novo (pequena mudança, a combinar).
- O widget só atende cliente com status `active`. Para a página rascunho funcionar, o cliente precisa estar `active` (a página não publicada não é vista por ninguém).

**Regra:** só vai para produção com contrato assinado, porque o widget passa a medir visitantes do site do cliente.
