# GeoLynq — Fase 10: Opportunity Score (pós-MVP)

Continuação do `vendeperto-blueprint-desenvolvimento.md` (Fases 0–9). Usa o schema real
(`schema-locator-v2.sql`) — `tenants`, `resellers`, `product_reseller_coverage`, `widget_events`.
Não redefine nada que já existe no blueprint (Fase 5 já cobre dashboard básico).

---

## 0. Query que faltava no blueprint (isso é MVP, Fase 5 — não espera Fase 10)

O blueprint já classificou "comparativo de volume vs. período anterior" como Categoria 3,
MVP, mas não chegou a escrever o SQL. Aqui está, pronto para o Claude Code usar na Fase 5:

```sql
-- Crescimento de buscas por produto/cidade: 30 dias atuais vs. 30 dias anteriores
with atual as (
  select product_id, city, state, count(*) as buscas
  from widget_events
  where tenant_id = :tenant_id and event_type = 'search'
    and product_id is not null
    and created_at >= now() - interval '30 days'
  group by product_id, city, state
),
anterior as (
  select product_id, city, state, count(*) as buscas
  from widget_events
  where tenant_id = :tenant_id and event_type = 'search'
    and product_id is not null
    and created_at >= now() - interval '60 days'
    and created_at < now() - interval '30 days'
  group by product_id, city, state
)
select
  a.product_id, a.city, a.state, a.buscas as buscas_atuais,
  coalesce(an.buscas, 0) as buscas_anteriores,
  round(100.0 * (a.buscas - coalesce(an.buscas, 0))
    / nullif(an.buscas, 0), 1) as crescimento_pct
from atual a
left join anterior an using (product_id, city, state)
order by crescimento_pct desc nulls last;
```

---

## 1. O que é genuinamente novo (Fase 10, não construir antes de 2–3 meses de dado real)

`commercial_opportunities` — tabela agregada, recalculada 1x/dia via n8n, já definida em
`schema-locator-v2.sql`. Score de 0 a 100, fórmula fechada, sem IA:

```
Opportunity Score = Demand×0.40 + CoverageGap×0.35 + Growth×0.15 + Engagement×0.10
```

### 1.1 Demand Score
```sql
demand_score = LEAST(100,
  (unique_sessions::numeric / NULLIF(max_unique_sessions_no_periodo_do_tenant, 0)) * 100
)
```
Usa `unique_sessions` (contagem de `session_id` distintos), não `searches` bruto — evita que
uma pessoa insistindo 10x infle o score mais que 10 pessoas diferentes buscando 1x cada.

### 1.2 Coverage Gap Score
```sql
no_coverage_pct = coverage_gap_searches::numeric / NULLIF(searches, 0)  -- resultado de results_count = 0

coverage_gap_score = LEAST(100, no_coverage_pct * 100)
```
Mais simples que a v1 do meu rascunho anterior — o schema real não guarda distância do
revendedor mais próximo por evento, só `results_count`. Adicionar distância exigiria
lat/long em `widget_events`, o que o blueprint já descartou para o MVP ("cidade+estado já é
suficiente"). Manter assim até haver sinal de que falta precisão.

### 1.3 Growth Score (50 = neutro)
```sql
growth_score = LEAST(100, GREATEST(0, 50 + (LEAST(1, GREATEST(-1, growth_rate / 100)) * 50)))
```
`growth_rate` vem da query da seção 0, já calculada.

### 1.4 Engagement Score
```sql
engagement_score = LEAST(100, engagement_rate * 100)
-- engagement_rate = count(reseller_click) / NULLIF(count(search), 0), mesmo produto/cidade
```

### 1.5 Classificação
```
0–39 baixa · 40–59 moderada · 60–79 alta · 80–100 muito_alta
```

---

## 2. Pipeline n8n (1x/dia, não em tempo real)

```
Cron diário
  → Supabase: agrupar widget_events dos últimos 30 dias por tenant_id + product_id + city + state
  → Calcular searches, unique_sessions (distinct session_id), coverage_gap_searches, reseller_count
  → Rodar a query de crescimento (seção 0) para growth_rate
  → Calcular engagement_rate
  → Aplicar fórmulas da seção 1
  → UPSERT em commercial_opportunities (service_role key — RLS não permite insert de usuário comum)
  → Se opportunity_score >= limiar do tenant → alerta (canal a definir)
```

---

## 3. Dashboard — delta sobre o que o blueprint (Fase 5) já define

O blueprint já cobre: status de importação, buscas sem produto, buscas sem cobertura,
produtos/revendas órfãs, taxa de conversão. Fase 10 adiciona só:
- **Ranking de oportunidades**: tabela produto × cidade × score, ordenável, lendo direto de `commercial_opportunities`
- **Página de produto/cidade**: drill-down com os 4 sub-scores

Sem mapa de calor na v1 — já descartado no blueprint original por custo/retorno.

---

## 4. Checklist antes de criar `commercial_opportunities` de verdade

- [ ] Fases 1–9 do blueprint rodando em produção com o 1º cliente
- [ ] `session_id` (adicionado no schema v2) sendo gravado pelo widget desde o dia 1 — conferir na Fase 4
- [ ] Pelo menos 60 dias de `widget_events` acumulado (a query de crescimento precisa de 2 períodos completos)
- [ ] Limiar de alerta do opportunity_score definido com o Danilo antes de ligar notificação automática
