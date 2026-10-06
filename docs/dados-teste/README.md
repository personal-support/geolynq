# Dados hipotéticos — "Fábrica Teste"

Cliente **fictício** para testar o pipeline (cadastro por CNPJ + importação) enquanto não há cliente real.
Não use o tenant `demo` para isso: ele é a vitrine de apresentação.

## O que tem
- **5 produtos** `TST-001..005`
- **8 revendedores** (Santos x2, Guarujá, São Paulo x3 incl. 1 online, Campinas [distribuidor], Rio)
- **20 vínculos de cobertura**, com histórias de propósito:
  - `TST-001` Whey: em todos os 8
  - `TST-002` Creatina: em 7 (sem o Rio)
  - `TST-003` Glutamina: só São Paulo capital + online
  - `TST-004` Barra: só online + distribuidor
  - `TST-005` Hipercalórico: **sem nenhum revendedor** (caso "produto sem cobertura")

## Por que é seguro
- Nomes inventados, todos terminam em "(Teste)".
- Telefones/WhatsApp **inválidos de propósito** (`13900000001`…) — ninguém recebe mensagem por engano.
- Sites em `example.com`.
- CNPJs `91000001000191` … `91000008000103`: **fictícios**, com dígito verificador válido (o importador exige).
  Por acaso podem coincidir com um CNPJ real; só o número, nenhum nome real é usado.
- Ruas são reais (para o geocodificador achar coordenadas); números e nomes dos estabelecimentos são inventados.
- Sem CEP, como no demo (o v2 geocodifica por rua/número/bairro/cidade, não por CEP).

## Arquivos
- `fabrica-teste-catalogo.xlsx` — 3 abas (`Produtos`, `Revendedores`, `Cobertura`) no formato de `docs/geolynq-catalogo-modelo.xlsx`
- `fabrica-teste-*.tsv` — as mesmas abas em texto separado por tabulação (colar direto no Google Sheets)

## Como usar
1. Cadastrar o cliente de teste (`slug: fabrica-teste`) — workflow n8n "Cadastro de Cliente por CNPJ", `gravar=true`.
2. Colocar estes dados numa planilha do Google compartilhada com a service account do n8n.
3. Rodar o workflow "Import Catálogo v2 (CNPJ)" com o `tenant_id` do cliente de teste e `exigir_cnpj=true`.
4. Rodar de novo: não pode duplicar nada (upsert por SKU / CNPJ / par produto+revendedor).
