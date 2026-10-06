# B0 — Cadastro do cliente por CNPJ e perfil de mercado (desenho, 2026-10-02)

> **Estado (2026-10-02): B0.1 APLICADO em produção** (migration `supabase/migrations/20261003000000_b0_tenant_profile.sql`,
> autorizada pelo Junior). Os passos B0.2 em diante continuam só desenho. A seção 5 é o rascunho original; **vale o arquivo da migration**
> (diferença: CNPJ guardado só com 14 dígitos puros, `check (cnpj ~ '^[0-9]{14}$')`, para a chave única não duplicar por causa de máscara).
> Decisão confirmada pelo Junior: **território = Brasil inteiro e todos os canais, e o sistema não é só para a New Millen.**
>
> **Verificado em produção:** `is_valid_cnpj` (CNPJ da New Millen e do BB válidos; dígito errado, repetido, curto recusados); as 3 recusas
> da tabela `resellers` (dígito errado, com máscara, duplicado no mesmo tenant) e a aceitação de CNPJ válido; as 12 linhas existentes
> intactas e sem CNPJ; 6 tabelas novas com RLS e 6 policies; anônimo sem acesso às tabelas novas; anônimo sem acesso às colunas `cnpj`,
> `verification_status`, `verified_at` de `resellers`; **a RPC `widget_resellers_in_radius` e a `widget_get_tenant` continuam funcionando como anônimo**.
> **Não verificado:** o widget no navegador depois da mudança de permissão (a RPC foi testada, o widget não foi reaberto); nenhuma
> consulta do painel logado (não existe ainda).
>
> **Mudança de permissão a lembrar:** `anon` agora lê `resellers` só nestas colunas: id, tenant_id, name, type, status, phone, whatsapp,
> website, created_at, updated_at. Coluna nova em `resellers` nasce fechada para o público; se o widget precisar dela, conceder
> explicitamente (`grant select (coluna) ... to anon`).

## 1. O caso real: New Millen (dados informados pelo Junior + fontes públicas)

| Campo | Valor |
|---|---|
| Razão social / fantasia | **NM Alimentos LTDA** / **New Millen** |
| CNPJ da matriz | **00.385.181/0001-11** (Cajamar/SP). Há também a filial **/0002-00** (São Paulo/SP) |
| Situação / abertura / porte | Ativa · 05/01/1995 · Empresa de Pequeno Porte |
| Atividade principal (CNAE) | **1099-6/07**, Fabricação de alimentos dietéticos e complementos alimentares |
| Endereço da matriz | Av. Dr. José Luís Leme Maciel, 327, Santa Terezinha (Jordanésia), Cajamar/SP, CEP 07786-450 |
| Site | newmillen.com.br |
| Segmento | **Suplementos em geral** |
| Território e canais | **"Todos"**: interpretado como **Brasil inteiro** e **todos os canais** (confirmar) |

> **Correção:** o CNAE é **1099-6/07**. Eu havia citado `/04` de memória; a consulta mostrou que `/04` é fabricação de gelo. Códigos de
> atividade só entram no sistema depois de conferidos na tabela do IBGE ou na base da Receita, nunca de memória.

**Como a New Millen vende hoje (busca pública, indicativa):** marketplaces (Mercado Livre), e-commerces de esporte e suplementos
(Netshoes, Scoop, Corpore, Suplevita), **redes de farmácia** (Drogarias Pacheco) e venda direta da fábrica; há também atacado.
Ou seja: o canal é **misto, com muito online e redes**.

## 2. Decisões de modelagem

1. **Cliente = empresa (raiz do CNPJ, 8 dígitos), não um estabelecimento.** A New Millen tem matriz e filial; a Receita publica por
   estabelecimento (14 dígitos). Guardar a raiz como chave do cliente e o CNPJ da matriz como referência.
2. **Revendedor = CNPJ de 14 dígitos por cliente** (`unique(tenant_id, cnpj)`), e **rede = mesma raiz**. Isso resolve a duplicação na
   reimportação e permite tratar "Drogarias X" como uma rede com N lojas.
3. **Perfil de canal aprendido da própria base do cliente.** Quando o cliente subir os revendedores com CNPJ, consultamos a atividade
   (CNAE) de cada um e calculamos a distribuição ("38% varejo especializado, 22% farmácias, 15% atacado, 6% academias"). **Esses
   são os CNAEs de canal do cliente, medidos, não adivinhados.** A tabela curada de segmentos vira só **ponto de partida** para
   cliente sem lista.
4. **Rede vs loja:** para redes (muitas filiais), a abordagem é **uma só, na matriz da rede** (compras). O relatório de candidatos
   agrupa por raiz ("Rede X: 14 lojas na sua região") em vez de listar 14 linhas.
5. **Online é outra lógica:** marketplaces e e-commerces não têm raio; entram como revendedor `online` (já suportado) e a "lacuna"
   online é de **presença** (quais marketplaces/sites listam o produto), tratada à parte.
6. **Ruído do CNAE de varejo:** a atividade 4729-6/99 é um "guarda-chuva" (alimentos em geral) e mistura lojas irrelevantes. O universo
   de candidatos precisa de **filtro extra** (palavras no nome fantasia/razão como suplement, nutri, fit, natural, vitamin; e o perfil
   medido do cliente) e de um **score de aderência**, validado numa amostra antes de mostrar ao cliente.
7. **Território "Brasil"** gera um universo enorme; a priorização é por **município**: potencial (empresas elegíveis) × cobertura atual
   do cliente × demanda (buscas). O foco inicial do relatório é "onde há muito potencial e pouca presença".

## 3. Fluxo de cadastro (como o Junior/Danilo cadastram um cliente)

1. Digitar o **CNPJ** → consulta (API pública BrasilAPI/Minha Receita; plano B: nossa carga da Receita) → ficha preenchida e **situação
   conferida** (só cadastra se *ativa*).
2. Escolher **segmento** (ponto de partida) e **território** (Brasil / UFs / municípios). Confirmar com o cliente.
3. Gerar o **slug**, a cor e criar o `tenant` + perfil.
4. Receber a planilha de revendedores **com CNPJ** → importar (validar dígito verificador, deduplicar por CNPJ).
5. Calcular o **perfil de canal medido** e propor os CNAEs de canal; confirmar.
6. A partir daí o sistema monta o **universo** daquele cliente (B3) e roda a **verificação mensal** dos revendedores.

Sem painel (B2) ainda, os passos 1–3 rodam por uma função de cadastro restrita ao `service_role` e um workflow n8n manual
(`geolynq-cadastro-cliente`); a tela vem no B2.

## 4. Impacto no que já existe
- **Planilha-modelo:** a aba Revendedores ganha a coluna **CNPJ** (obrigatória para novos clientes; opcional no `demo`).
- **Importador n8n:** validar CNPJ (dígito verificador), normalizar (só dígitos), **upsert por (tenant, CNPJ)** em vez de *create*.
- **Widget:** nenhuma mudança.
- **Dados existentes:** os 12 revendedores do `demo` ficam sem CNPJ (campo opcional); o índice único ignora linhas sem CNPJ.

## 5. Esquema proposto (RASCUNHO, NÃO APLICADO)

```sql
-- Perfil de mercado do cliente (1:1 com tenants). Só dados de pessoa jurídica; não guarda sócios.
create table public.tenant_profiles (
  tenant_id          uuid primary key references public.tenants(id) on delete cascade,
  cnpj_raiz          text not null unique check (cnpj_raiz ~ '^[0-9]{8}$'),
  cnpj_matriz        text not null check (cnpj_matriz ~ '^[0-9]{14}$'),
  razao_social       text not null,
  nome_fantasia      text,
  situacao_cadastral text,
  data_abertura      date,
  porte              text,
  cnae_principal     text check (cnae_principal ~ '^[0-9]{7}$'),   -- a API devolve NÚMERO (1099607): normalizar com lpad(x::text, 7, '0')
  cnae_principal_desc text,
  cnaes_secundarios  text[] not null default '{}',
  uf                 text check (uf ~ '^[A-Z]{2}$'),
  municipio          text,
  municipio_ibge     integer,                                       -- código IBGE (7 dígitos), ex.: 3509205
  municipio_receita  integer,                                       -- código interno da Receita (o dump usa este), ex.: 6285
  cep                text check (cep ~ '^[0-9]{8}$'),
  website            text,
  fonte              text not null default 'manual' check (fonte in ('brasilapi','receita_dump','manual')),
  consultado_em      timestamptz,
  created_at         timestamptz not null default now()
);

-- Catálogo de atividades (código → descrição), carregado da tabela auxiliar da Receita
create table public.cnae_catalog (
  cnae      text primary key check (cnae ~ '^[0-9]{7}$'),
  descricao text not null
);

-- Segmentos (ponto de partida) e seus CNAEs de canal
create table public.segments (
  id    text primary key check (id ~ '^[a-z0-9_]+$'),
  nome  text not null,
  ativo boolean not null default true
);
create table public.segment_channel_cnaes (
  segment_id text not null references public.segments(id) on delete cascade,
  cnae       text not null check (cnae ~ '^[0-9]{7}$'),
  tipo_canal text not null check (tipo_canal in ('varejo','atacado','representante','online','outro')),
  peso       smallint not null default 1,
  primary key (segment_id, cnae)
);
create table public.tenant_segments (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  segment_id text not null references public.segments(id),
  primary key (tenant_id, segment_id)
);

-- Território de atuação (scope 'brasil' = país inteiro)
create table public.tenant_territories (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  scope          text not null check (scope in ('brasil','uf','municipio')),
  uf             text check (uf ~ '^[A-Z]{2}$'),
  municipio_ibge integer,
  check ((scope = 'brasil' and uf is null and municipio_ibge is null)
      or (scope = 'uf' and uf is not null and municipio_ibge is null)
      or (scope = 'municipio' and municipio_ibge is not null))
);

-- CNPJ como chave de negócio do revendedor + verificação
alter table public.resellers
  add column if not exists cnpj text check (cnpj ~ '^[0-9]{14}$'),
  add column if not exists verification_status text
    check (verification_status in ('nao_verificado','ativa','suspensa','inapta','baixada','nula')),
  add column if not exists verified_at timestamptz;
create unique index if not exists resellers_tenant_cnpj_uq on public.resellers (tenant_id, cnpj) where cnpj is not null;

-- RLS: ligado em todas; leitura só para quem pertence ao tenant; escrita só service_role (sem policy de escrita).
-- segments / segment_channel_cnaes: leitura para authenticated; escrita só service_role.
-- Função de cadastro: public.provision_tenant(...) SECURITY DEFINER, EXECUTE somente para service_role.
-- Função public.is_valid_cnpj(text) (dígito verificador) usada pelo importador.
```

## 6. Dados da Receita e infraestrutura (alimenta o B3 e a verificação mensal)
- Base completa: CSV mensal, **~85 GB descompactados** (fonte secundária), com CNAE principal e secundários por estabelecimento.
  Fica **na VPS**; o Supabase recebe só o recorte do cliente. **Antes de planejar é preciso saber o disco/RAM da VPS.**
- A **verificação mensal** ("N revendedores ficaram inativos") e o **perfil de canal medido** dependem dessa base; por isso o
  ETL da Receita na VPS entra **junto** com o B0 (não depois). API pública só para consulta unitária no cadastro.

## 7. Ordem de execução do B0
1. ~~**B0.1** Migration das tabelas e colunas acima + RLS + `is_valid_cnpj`~~ (**FEITO em 2026-10-02**).
2. **B0.2** Função `provision_tenant` (service_role) e semente do segmento **suplementos** (CNAEs conferidos na base real).
   - **B0.2a FEITO (2026-10-02)** `supabase/migrations/20261003010000_b0_provision_tenant.sql`: recebe o perfil já normalizado em jsonb (o mapeamento
     da BrasilAPI fica no n8n, B0.3). Cria tenant + perfil + segmentos + territórios numa transação. Regras: CNPJ válido, **só matriz (final 0001)**,
     situação **ativa**, raiz e slug únicos, segmento existente, CNAE completado com zeros, território padrão Brasil. Cliente nasce **`trial`** (o widget só
     serve `active`; o Junior ativa de propósito). **Verificado em produção (com rollback):** cadastro completo (perfil, CNAE secundário deduplicado,
     CEP sem máscara, UF em maiúscula, 2 territórios, widget não enxerga o cliente `trial`) e 5 recusas (filial, dígito, baixada, slug repetido, segmento
     inexistente); `anon` e `authenticated` **sem** EXECUTE, só `service_role`. **Não verificado:** chamada real via service_role pela API (o teste rodou
     como dono do banco) e o mapeamento BrasilAPI → jsonb.
   - **B0.2b FEITO (2026-10-02)** `supabase/migrations/20261003020000_b0_segment_suplementos.sql`: `cnae_catalog` com **16 códigos conferidos** na API
     oficial do IBGE (`https://servicodados.ibge.gov.br/api/v2/cnae/subclasses/{codigo}`, consultada pela VPS do Junior; do sandbox o IBGE e os sites de
     CNAE ficam bloqueados; a rota `/api/cnae/v1` da BrasilAPI que eu havia sugerido **não existe**) e o segmento **`suplementos`** com 10 CNAEs de canal
     (varejo 4, atacado 3, representante 2, outro 1). **A escolha dos códigos e os pesos 1–3 são julgamento meu, não medição**; ficam só como ponto de partida
     até o perfil medido do cliente (B0.5). Fora do canal de propósito: 4789099, supermercados/mercearias (4711301, 4711302, 4712100) e hortifrúti (4724500).
     Verificado: 16 no catálogo, 10 canais sem nenhum órfão do catálogo, `anon` sem leitura, `provision_tenant` vinculando o segmento (em rollback).
     **Não verificado:** se esses canais realmente cobrem os revendedores da New Millen (depende da lista com CNPJ do Danilo).
3. **B0.3 FEITO (2026-10-02, em modo de teste; nada ativado):** workflow de cadastro por CNPJ + importador v2 + planilha-modelo + função `import_reseller`.
   - **Banco:** `supabase/migrations/20261003030000_b0_import_reseller.sql`. Upsert por `(tenant, CNPJ)` **dentro do Postgres**, porque o upsert do PostgREST/n8n
     não consegue usar o índice único **parcial** `resellers_tenant_cnpj_uq`. Só `service_role`. Reimportar atualiza em vez de duplicar; se a nova geocodificação falha
     e o endereço não mudou, mantém as coordenadas antigas. Testada em rollback (inserção, reimportação sem duplicar, coordenada preservada, CNPJ ruim e tipo ruim recusados).
   - **n8n `GeoLynq — Cadastro de Cliente por CNPJ`** (id `toU5IgMP0wvoaE1b`, inativo; fonte versionada em `docs/n8n-geolynq-cadastro-cliente.workflow.ts`): valida CNPJ
     (matriz, dígito), consulta a BrasilAPI, mapeia o perfil e chama `provision_tenant`. **Nasce com `gravar = false`** (só mostra o que gravaria).
     **Verificado de verdade:** rodou no n8n da VPS contra a BrasilAPI real com o CNPJ da New Millen em modo conferência (**nada gravado**): razão social, fantasia, situação,
     CNAE 1099607 + 7 secundários, Cajamar/SP, códigos 3509205 (IBGE) e 6285 (Receita) mapearam certo, lista de avisos vazia. Nomes reais dos campos da API:
     `descricao_situacao_cadastral` ("ATIVA"), `cnae_fiscal` (número), `cnaes_secundarios[].codigo`, `codigo_municipio` (Receita), `codigo_municipio_ibge`, `data_inicio_atividade`, `porte`.
   - **n8n `GeoLynq — Import Catálogo v2 (CNPJ)`** (id `vCFeM2DItVsorH5f`, inativo; fonte `docs/n8n-geolynq-import-catalogo-v2.workflow.ts`). Mudanças sobre o v1:
     coluna `cnpj` (validada, normalizada, zero à esquerda recuperado, duplicado no lote recusado, obrigatória salvo `exigir_cnpj = false` no tenant demo);
     produtos, revendedores e cobertura **reimportáveis** (upsert); cobertura por `cnpj_revendedor` ou nome (nome ambíguo é recusado); geocodificação a **1 req/s** (política do Nominatim).
     **Defeitos do v1 corrigidos:** (a) linha sem resultado no Nominatim sumia do fluxo (resposta vazia = zero itens); (b) erros de gravação dos nós do Supabase não entravam no resumo
     (lote ficaria "success" com falha); (c) o ViaCEP era chamado e a resposta ignorada (removido); (d) etapa que não roda por falta de linha válida agora aparece no resumo.
     **Verificado:** grafo válido (20 nós) e a lógica dos nós de código com dados simulados (13 linhas: CNPJ com máscara, numérico, repetido, dígito errado, vazio, tipo inválido, geocodificação
     que falhou, cobertura por CNPJ e por nome, produto/revendedor inexistente; resumo "partial", 8 erros certos). **Não verificado:** leitura real do Google Sheets, Nominatim real a 1/s,
     autenticação real contra o Supabase (nenhum nó de gravação rodou com credencial) e o pareamento de itens com respostas HTTP reais (no teste os nós HTTP foram simulados).
   - **Planilha-modelo** `docs/geolynq-catalogo-modelo.xlsx`: aba Revendedores ganhou `cnpj` (1ª coluna) e Cobertura `cnpj_revendedor`, ambas em formato Texto.
   - **Limitação conhecida:** se **nenhum** produto for válido, as etapas seguintes não rodam (o resumo avisa "etapa não executada"). O v1 antigo (`2ZPDQymNwVSENTIf`) segue inativo e
     nunca foi executado; arquivar depois que o v2 rodar de verdade.
   - **Risco LGPD:** a resposta crua da BrasilAPI traz o **quadro societário (nomes de sócios, CPF mascarado)**. O mapeamento **não grava** isso no banco, mas o histórico de execuções
     do n8n guarda a resposta crua (na sua VPS). Considerar reduzir a retenção das execuções desse workflow antes de cadastrar clientes de terceiros.
   - **Pendências do Junior:** (1) no n8n, abrir o nó "Cadastrar Cliente (provision_tenant)" e os nós HTTP do importador e escolher a credencial **"Supabase account"**; confirmar que ela guarda a
     chave **service_role** (a chave anon não passa: as funções são só do service_role). (2) escolher a planilha real nos 3 nós "Ler Aba ...".
4. **B0.4** Cadastro da New Millen como tenant real (só quando o Junior mandar).
5. **B0.5** ETL da Receita na VPS + perfil de canal medido + verificação mensal (continua no B3).

## 8. Riscos e dúvidas
- API pública de CNPJ é de terceiros: limites/disponibilidade **não verificados**; precisa de cache e plano B.
- Se "Todos" não for Brasil inteiro e todos os canais, o universo e os relatórios mudam.
- Cliente sem lista de revendedores com CNPJ: cai no ponto de partida do segmento (menos preciso).
- Sem painel (B2), o cadastro é operado pelo Junior/Claude (não é autoatendimento).
- LGPD: o perfil guarda só dados de PJ; os revendedores MEI podem ter nome de pessoa na razão social.

## 9. Pedidos ao Junior
(1) ~~Confirmar "Todos" = Brasil inteiro + todos os canais~~ (**confirmado**); (2) ~~consulta do CNPJ e disco/RAM da VPS~~ (**feito**, seção 10);
(3) ~~OK para o B0.1~~ (**dado e aplicado**); (4) mandar, quando o Danilo tiver, a **lista de revendedores
da New Millen com CNPJ**.

## 10. Verificação com a API real e com a VPS (2026-10-02)

**BrasilAPI respondeu da VPS do Junior** (HTTP com dados reais da New Millen). O que a resposta confirma e o que muda:

| Achado | Consequência no desenho |
|---|---|
| Campos conferem com o esquema: situação (`2` = ATIVA), porte, endereço, CEP, matriz/filial, data de início | esquema da seção 5 está certo |
| **CNAE vem como NÚMERO** (`1099607`, `4763602`): códigos que começam com 0 perdem o zero | normalizar com `lpad(codigo::text, 7, '0')` em todo lugar (importador, cadastro, ETL) |
| Vêm **dois códigos de município**: `codigo_municipio` (**6285**, interno da Receita) e `codigo_municipio_ibge` (**3509205**) | o **dump usa o código da Receita**; guardar os dois e ter um mapeamento Receita ↔ IBGE |
| **E-mail nulo e telefone `000000000000`** (placeholder) | **contato cadastral da Receita é fraco**: não prometer "lista com telefone"; o "como chegar" precisa de enriquecimento (site, telefone) por outras fontes |
| Vem `qsa` (sócios: nome, CPF parcial, faixa etária) | **dado pessoal: não guardar**; o perfil só grava dados da empresa |
| Atividades secundárias: pós alimentícios, bebidas, atacadista de embalagens, **varejo de artigos esportivos (4763-6/02)**, depósito, **envasamento sob contrato (8292-0/00)** | a New Millen também **fabrica para terceiros** (co-packer) e tem varejo próprio; não muda o desenho, mas confirma que o CNAE do fabricante não explica o canal |
| Resposta traz regime tributário, capital social etc. | ignorar; guardar só o necessário |

**Descrição das atividades:** a API já traz o texto de cada CNAE; para a base inteira usar a tabela auxiliar da Receita (`cnae_catalog`).

### VPS (Hostinger, medida pelo Junior)
Disco **95,8 GB, 61,9 GB livres**; RAM **7,8 GB** (~5,2 GB disponíveis, sem swap); **2 vCPU**. Hospeda também EasyPanel, n8n e o widget.
- A base da Receita (~85 GB descompactada, fonte secundária) **não cabe extraída** nos 61,9 GB livres, e a RAM não comporta carga em banco.
- **Plano viável: ETL em streaming**, um arquivo por vez: baixar o `.zip`, filtrar durante a leitura (`unzip -p | …`, só estabelecimentos
  ativos, nos CNAEs e territórios que interessam), gravar só o resultado e apagar o zip. Disco necessário ≈ um zip + o recorte.
  Rodar de madrugada, com prioridade baixa, para não competir com n8n/widget. **Não verificado:** tamanho real de cada arquivo e tempo
  de execução; medir com um `HEAD` por arquivo antes de agendar.
- Encoding e separador do CSV seguem o layout oficial (ponto e vírgula, sem cabeçalho, ISO-8859-1): conferir no 1º arquivo.
