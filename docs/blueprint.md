# GeoLynq — Blueprint de Desenvolvimento do Zero

SaaS multi-tenant de localização de revendedores por produto — substituto do Gofind.
Infra base já disponível: VPS Hostinger + EasyPanel + GitHub + Supabase (cloud) + n8n self-hosted.

---

## Como usar este blueprint com o Claude Code

- Cada fase abaixo foi escrita para ser entregue ao Claude Code como uma instrução única — copiar o bloco da fase e colar direto.
- **Regra fixa desde o primeiro commit**: manter um arquivo `status.md` na raiz do repositório. Ao final de cada passo concluído, o Claude Code atualiza esse arquivo antes de avançar para o próximo — é o registro de progresso entre sessões, para retomar o trabalho sem precisar reexplicar o que já foi feito.

Template mínimo do `status.md`:
```markdown
# Status — GeoLynq

## Última atualização
[data]

## Fase atual
[Fase X — nome da fase]

## Concluído
- [ ] item

## Pendente
- [ ] item

## Decisões tomadas nesta fase
- decisão

## Bloqueios
- bloqueio, se houver
```

---

## Fase 0 — Contas e decisões antes de escrever qualquer código

Nenhuma dessas exige gastar dinheiro além do que você já tem contratado (VPS).

| # | O que fazer | Onde | Decisão/observação |
|---|---|---|---|
| 0.1 | Registrar repositório privado no GitHub + criar `status.md` na raiz (primeiro commit do repo) | github.com | Nome sugerido: `personal-support/geolynq`. Usar o template da seção anterior, com "Fase 0" marcada como fase atual |
| 0.2 | Configurar subdomínio wildcard | painel DNS da Hostinger | Sem domínio novo — reaproveita `personalsupport.tech`, já na VPS. Criar registro `*.geolynq.personalsupport.tech` (wildcard) apontando pro IP da VPS. Cobre `geolynq.`, `admin.geolynq.`, `widget.geolynq.` e `demo.geolynq.` de uma vez, sem precisar voltar no DNS a cada subdomínio novo. Custo: zero |
| 0.3 | Checagem básica de marca | gru.inpi.gov.br | Busca por "GeoLynq" nas classes de software/SaaS — não impede começar a construir, mas evita surpresa depois |
| 0.4 | **Decidir organização Supabase** | supabase.com/dashboard | Você já tem pelo menos 2 organizações Supabase em uso (uma para Korin, outra provavelmente para Comprovai/FleetCheck). **Não reaproveite o projeto do Korin** — é produto isolado e não deve ser alterado. Decida se cria uma organização nova ("Personal Support SaaS") ou usa a mesma de Comprovai/FleetCheck. |
| 0.5 | Confirmar acesso EasyPanel na VPS Hostinger | painel EasyPanel | Você já usa para n8n — este projeto vira um novo "app" dentro do mesmo EasyPanel, não uma VPS nova |
| 0.6 | Gerenciador de senhas | Bitwarden (gratuito) ou similar | Você vai gerar ~6 credenciais novas nesta fase. Não guarde em bloco de notas ou WhatsApp |

**Resultado da Fase 0**: repositório vazio, subdomínio wildcard configurado, organização Supabase escolhida, VPS pronta para receber um novo serviço.

---

## Fase 1 — Provisionar o banco de dados (Supabase)

1. Criar novo projeto Supabase na organização escolhida (0.4).
   - Região: `sa-east-1` (São Paulo) — menor latência para usuários e revendedores no Brasil.
   - Nome do projeto: `geolynq-prod`
2. Anotar as 3 credenciais geradas automaticamente (Project Settings → API):
   - `Project URL`
   - `anon public key`
   - `service_role key` — **esta nunca vai para o navegador, nunca para o widget, nunca para o GitHub**
3. Habilitar a extensão **PostGIS** (Database → Extensions → buscar "postgis" → Enable). Sem isso, a busca por revendedor mais próximo não funciona.
4. Aplicar o schema já desenhado (`schema-locator-v2.sql`) via SQL Editor ou `apply_migration`.
5. Criar um segundo projeto Supabase idêntico chamado `geolynq-dev` (tier gratuito também) — para testar sem risco de estragar dado de cliente real. Aplicar o mesmo schema nele.

**Por que dois projetos (dev/prod) desde o início**: você só tem 2 clientes agora, mas qualquer erro de migration direto em produção pode derrubar o widget nos dois sites ao mesmo tempo. Custo: zero, ambos no tier gratuito.

---

## Fase 2 — Estrutura do projeto (código)

```
geolynq/
├── apps/
│   ├── admin/          → painel de gestão (Next.js 14, App Router)
│   └── widget/          → o componente embutido no site do cliente
├── packages/
│   └── shared/          → tipos e client Supabase compartilhados
├── status.md              → atualizado a cada passo concluído (ver seção no topo do documento)
├── .env.local            → NUNCA commitado
├── .gitignore
└── package.json
```

1. `npx create-next-app@latest apps/admin` (App Router, TypeScript, Tailwind).
2. `.gitignore` — confirmar que já inclui `.env*.local`, `node_modules`, `.next`.
3. Primeiro commit **sem nenhuma chave**. Rodar antes de commitar:
   ```bash
   git diff --staged | grep -E "(KEY|SECRET|PASSWORD|TOKEN)"
   ```
   Se aparecer algo, remover do stage antes de prosseguir.

### Variáveis de ambiente — mapa completo

| Variável | Valor vem de | Onde é usada | Pode aparecer no navegador? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Fase 1.2 | Admin + Widget | Sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Fase 1.2 | Admin + Widget | Sim (protegido por RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Fase 1.2 | Só em rotas server-side do Admin (import de planilha, criação de tenant) | **Nunca** |
| `NEXTAUTH_SECRET` ou equivalente | Gerar com `openssl rand -base64 32` | Sessão do Admin | Não |

---

## Fase 3 — Pipeline de dados (a "logística reversa" que você definiu)

Vocês ditam o formato — não o cliente.

1. Criar planilha-modelo (Google Sheets, para facilitar automação via n8n): abas `Produtos`, `Revendedores`, `Cobertura`. Estrutura já definida no schema.
2. Workflow n8n novo (nome sugerido: `geolynq-import-catalogo`):
   - Trigger manual (botão) para o piloto com os 2 clientes — automatizar por agendamento só depois de validar.
   - Lê a planilha → valida linhas obrigatórias → geocodifica endereço via **ViaCEP** (CEP → cidade/bairro) e **Nominatim/OpenStreetMap** (endereço → lat/long) — ambos gratuitos, sem API key.
   - Grava em `products`, `resellers`, `addresses`, `product_reseller_coverage`.
   - Registra o resultado em `import_batches` (linhas processadas, linhas com erro).
3. Nenhuma credencial nova aqui além do que o n8n já usa para conectar no Supabase (`service_role key` da Fase 1, guardada nas credentials do n8n, nunca em texto no workflow).
4. **Erro específico por linha, não erro genérico.** Ao falhar validação (ex: CEP inválido, SKU duplicado), gravar em `import_batches.error_log` o número da linha e o motivo exato — nunca só "falhou". Cliente com planilha mal preenchida abandona o onboarding se não souber o que corrigir; isso é a causa mais provável de churn precoce num produto que depende de dado fornecido pelo próprio cliente.

---

## Fase 4 — O widget (o que aparece no site do cliente)

Este é o diferencial sobre o iframe do Gofind.

1. Construir como **Web Component** (Custom Element + Shadow DOM) — isola estilo do site hospedeiro, funciona em qualquer CMS (resolve o problema de hospedagens diferentes entre clientes).
2. Contrato de uso, o que o Danilo (ou qualquer webmaster de cliente) vai colar no site:
   ```html
   <script src="https://widget.geolynq.personalsupport.tech/v1/embed.js" defer></script>
   <geolynq-widget tenant="new-millen" color="#E84E0E"></geolynq-widget>
   ```
3. O widget consome a API pública do Supabase direto (`anon key` + RLS), sem backend intermediário — menos peça pra manter.
4. Build do bundle: Vite (`vite build --lib`), gera um único `.js` minificado.
5. Hospedagem do bundle: dentro da mesma VPS/EasyPanel, servido como arquivo estático via Nginx — sem custo de CDN paga.

---

## Fase 4.1 — Site de amostra (template de loja de suplementos)

Peça nova, não existia no blueprint original. Prioridade alta: o Danilo precisa de algo
para mostrar ao 1º cliente assim que o widget funcionar (fim da Fase 4) — não esperar até
a Fase 8. Construir em paralelo com a Fase 5 (painel admin), não em sequência.

1. **Não é e-commerce funcional.** Zero carrinho, zero checkout — é vitrine estática.
   Usar um template gratuito de loja de suplementos (HTML/Tailwind), 4–5 produtos fictícios.
2. Reaproveitar o tenant de demonstração já previsto na Fase 8.1 (`slug='demo'`, 3
   revendedores fictícios) — não criar tenant novo, só usar esse nele em vez de num "site
   qualquer".
3. Instalar o widget de verdade nas páginas de produto do template — o Danilo precisa
   mostrar o "Onde Encontrar" funcionando, não uma maquete.
4. Hospedagem: mesmo container estático do bundle do widget (Fase 4.5), servido em
   `demo.geolynq.personalsupport.tech`.

---

## Fase 5 — Painel administrativo

1. Login via Supabase Auth (email/senha) — só para `tenant_users`.
2. Middleware Next.js protegendo `/dashboard/*` (ver padrão obrigatório abaixo).
3. Telas mínimas do MVP:
   - Status da última importação (sucesso/erro, linhas processadas — vem de `import_batches`)
   - Lista de produtos e revendedores (leitura, edição básica)
   - Preview do widget com os dados reais do tenant

### Dashboard e relatórios — o que entra e o que fica pra depois

Isso não é opcional: você mesmo definiu lá no início que o resultado pro fabricante precisa ser **concreto e mensurável**. Sem rastrear uso, o produto vira "confia em mim que funciona" — exatamente o tipo de argumento fraco que vocês descartaram na análise crítica do plano original.

Nada abaixo exige infraestrutura nova além da tabela `widget_events` — são queries SQL sobre dado que já existe no schema. O que separa MVP de Fase 2 não é custo de engenharia, é maturidade de uso (precisa de volume real acumulado pra fazer sentido, tipo comparativo de tendência).

**Categoria 1 — Demanda e uso (depende de gente usando o widget)**

| Relatório | Por que importa |
|---|---|
| Total de buscas no período | Prova de uso — base de qualquer conversa de renovação |
| Buscas sem produto correspondente no catálogo | Termo buscado não bate com nenhum SKU cadastrado — sinal de demanda por produto que o fabricante nem vende ainda. Isso é insight pro time de **produto** dele, não só comercial |
| Buscas com produto identificado mas sem revendedor próximo | Produto existe, ninguém vende perto de quem procurou — o gap de cobertura comercial geolocalizado, o argumento mais forte do sistema |
| Taxa de conversão busca → clique em revendedor | Mede se o widget gera ação (alguém foi atrás do revendedor) ou só visualização |
| Top 10 produtos mais buscados | Prioriza onde focar reposição/expansão comercial |
| Top 10 regiões com mais busca | Onde a demanda está concentrada geograficamente |

**Categoria 2 — Saúde do catálogo (não depende de uso real, disponível desde o dia 1 após a importação)**

| Relatório | Por que importa |
|---|---|
| Produtos sem nenhum revendedor vinculado | Gap estrutural visível imediatamente — nem precisa esperar alguém buscar pra saber que aquele SKU não tem onde ser vendido |
| Revendedores sem nenhum produto vinculado | Possível erro de cadastro na planilha ou revendedor "morto" na base |
| Distribuição geográfica de revendedores por cidade/estado | Mostra onde a rede está concentrada vs. onde está vazia — cruzado com o relatório de demanda, vira decisão de onde recrutar revendedor novo |

**Categoria 3 — Tendência (só faz sentido com histórico acumulado, ainda assim é MVP, não Fase 2)**

| Relatório | Por que importa |
|---|---|
| Comparativo de volume de busca: período atual vs. anterior | Mostra se o interesse pelo produto está crescendo ou caindo — o argumento de renovação de contrato |

**Fase 2 — evolução (só construir se o cliente pedir depois de validar, não é MVP):**
- Mapa de calor geográfico
- Filtro de data customizado + exportação CSV
- Ranking de revendedores ponderado por engajamento

Queries de referência para o Claude Code implementar direto:

```sql
-- Buscas sem produto correspondente no catálogo
select query_text, count(*) as buscas
from widget_events
where tenant_id = :tenant_id and event_type = 'search' and product_id is null
group by query_text
order by buscas desc;

-- Buscas com produto identificado mas sem revendedor próximo
select p.name, p.sku, count(*) as buscas_sem_cobertura
from widget_events e
join products p on p.id = e.product_id
where e.tenant_id = :tenant_id and e.results_count = 0 and e.product_id is not null
group by p.id, p.name, p.sku
order by buscas_sem_cobertura desc;

-- Produtos sem nenhum revendedor vinculado (saúde do catálogo, sem depender de uso)
select p.name, p.sku
from products p
left join product_reseller_coverage c on c.product_id = p.id
where p.tenant_id = :tenant_id and c.id is null and p.active = true;

-- Revendedores sem nenhum produto vinculado
select r.name
from resellers r
left join product_reseller_coverage c on c.reseller_id = r.id
where r.tenant_id = :tenant_id and c.id is null and r.status = 'active';

-- Taxa de conversão busca -> clique (últimos 30 dias)
select
  count(*) filter (where event_type = 'search') as buscas,
  count(*) filter (where event_type = 'reseller_click') as cliques,
  round(100.0 * count(*) filter (where event_type = 'reseller_click')
    / nullif(count(*) filter (where event_type = 'search'), 0), 1) as taxa_conversao_pct
from widget_events
where tenant_id = :tenant_id and created_at >= now() - interval '30 days';
```

### Implicação para o widget (Fase 4)
O widget precisa emitir dois eventos via `anon key` a cada interação: `search` (toda busca, mesmo sem resultado) e `reseller_click` (quando o usuário final clica pra ver um revendedor). Sem isso gravado desde o primeiro dia em produção, você perde o histórico de uso dos primeiros meses — não dá pra reconstruir depois.

```typescript
// middleware.ts — padrão obrigatório, protege /dashboard
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return res
}
```

---

## Fase 6 — Deploy contínuo

```
GitHub (push na main) → EasyPanel detecta → build (Nixpacks) → VPS Hostinger
```

1. No EasyPanel: criar novo "App" apontando pro repositório GitHub, branch `main`.
2. Configurar as variáveis de ambiente **dentro do painel EasyPanel** — nunca no código, nunca no `.env` commitado.
3. Quatro propriedades apontando pra VPS (o wildcard da Fase 0.2 já cobre todas, só criar o app de cada uma no EasyPanel):
   - `geolynq.personalsupport.tech` (raiz) → página de vendas institucional — porta de entrada do tráfego pago do Danilo
   - `admin.geolynq.personalsupport.tech` → painel administrativo (login do cliente)
   - `widget.geolynq.personalsupport.tech` → arquivo estático do widget
   - `demo.geolynq.personalsupport.tech` → site de amostra (template de loja de suplementos, Fase 4.1) — o que o Danilo mostra pro cliente em prospecção
4. SSL: EasyPanel gera certificado Let's Encrypt automático por subdomínio ao criar cada app — sem custo, sem configuração manual de certificado.

### Página de vendas (`geolynq.personalsupport.tech`) — escopo e captura de lead

Divisão clara, pra não misturar de novo: **conteúdo, oferta, preço exibido e copy da página são do Danilo** (comercial). **Estrutura técnica, hospedagem e formulário são seus.**

Não existe cadastro/self-signup — já ficou definido que a entrada de cliente é sempre manual, via você. Então a página não precisa de fluxo de conta, só de captura de lead:

- Formulário simples (nome, empresa, e-mail, telefone, mensagem) gravando na tabela `leads` (nova, ver schema abaixo).
- Ao enviar, dispara um workflow n8n que notifica você e o Danilo — WhatsApp ou e-mail, reaproveitando a infra que você já usa em outros projetos.
- Sem necessidade de painel de visualização de leads no MVP — a tabela serve de registro; consulta direta pelo Supabase Table Editor resolve enquanto o volume for baixo.

---

## Fase 7 — Checklist de segurança antes do primeiro cliente real

- [ ] RLS ativo em **todas** as tabelas (`products`, `resellers`, `addresses`, `product_reseller_coverage`, `import_batches`, `tenant_users`) — já veio pronto no schema da Fase 1, só confirmar que não foi desativado em algum teste
- [ ] `service_role key` só existe em: painel EasyPanel (env do Admin) e credentials do n8n — em nenhum outro lugar
- [ ] `.gitignore` testado — rodar `git log --all -p | grep -E "(SUPABASE_SERVICE|SECRET)"` no repositório antes do primeiro push
- [ ] Rate limit básico no endpoint de leitura pública do widget (evita que alguém sobrecarregue com requisições) — pode usar Upstash Redis, tier gratuito
- [ ] Teste de isolamento: logar como usuário do tenant A, confirmar que não enxerga nada do tenant B

---

## Fase 8 — Onboarding dos 2 primeiros clientes

1. **Sandbox antes de qualquer compromisso.** O tenant `demo` e o site de amostra já existem desde a Fase 4.1 — não recriar aqui, só confirmar que ainda está funcionando antes de levar ao cliente. Mesmo padrão que você já usa no FleetCheck (demo funcional da Alpha para prospecção): reduz objeção antes de qualquer cobrança ou assinatura.
2. Enviar a planilha-modelo (Fase 3) com uma aba de exemplo preenchida.
3. Rodar o workflow n8n de importação manualmente, conferir `import_batches` antes de liberar o widget.
4. Enviar ao Danilo (ou ao responsável do site de cada cliente) o snippet de embed (Fase 4.2) com o `tenant` correto.
5. Confirmar visualmente no site do cliente: comparar lado a lado com o iframe antigo do Gofind (que ainda deve estar no ar até a troca ser validada).

---

## Fase 9 — Cobrança (deliberadamente manual por agora)

Com 2 clientes, **não vale integrar Stripe ou gateway de pagamento ainda** — isso é custo de engenharia sem ganho real nesse volume. Fatura avulsa (PIX ou boleto direto) resolve. Reavaliar automação de cobrança a partir do 5º cliente, quando o volume de conciliação manual começar a doer.

---

## Tabela-resumo de todas as credenciais do projeto

| Credencial | Gerada em | Nível | Onde fica armazenada |
|---|---|---|---|
| `SUPABASE_URL` (prod e dev) | Supabase dashboard | Pública | `.env` local + EasyPanel |
| `SUPABASE_ANON_KEY` (prod e dev) | Supabase dashboard | Pública (RLS protege) | `.env` local + EasyPanel |
| `SUPABASE_SERVICE_ROLE_KEY` (prod e dev) | Supabase dashboard | **Secreta** | EasyPanel (env do Admin) + n8n credentials |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | Secreta | EasyPanel |
| Login GitHub (2FA obrigatório) | github.com | Secreta | Gerenciador de senhas |
| Login EasyPanel/VPS Hostinger | Já existente | Secreta | Gerenciador de senhas |
| Credencial n8n → Supabase | Fase 1 | Secreta | Dentro do n8n (criptografado) |

Nenhuma chave paga é necessária nesta fase — ViaCEP, Nominatim, Supabase (tier gratuito), EasyPanel/VPS (já contratado) e Let's Encrypt cobrem 100% do MVP.

---

## Por onde começar amanhã (3 ações concretas)

1. Fase 0.4 — decidir e criar a organização Supabase.
2. Fase 1 completa — provisionar `geolynq-prod` e `geolynq-dev`, aplicar o schema.
3. Fase 0.1 — criar o repositório GitHub vazio, já com `.gitignore` correto antes do primeiro commit.
