# Testes de banco (Postgres local, sem tocar na produção)

Valida as migrations e os relatórios do painel contra um Postgres **local** com PostGIS, num "mini Supabase"
(papéis `anon`/`authenticated`/`service_role`, `auth.uid()`), porque o conector MCP do Supabase tem limite de 60 s e
não deve ser usado para testes com dados simulados.

```bash
# uma vez: apt-get install -y postgresql postgresql-16-postgis-3 && pg_ctlcluster 16 main start
createdb geolynq_test                                  # como usuário postgres
psql -d geolynq_test -f supabase/tests/00_supabase_stub.sql
psql -d geolynq_test -f docs/schema-locator-v2.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d geolynq_test -f $f; done
psql -d geolynq_test -f supabase/tests/02_fixture_fabrica_teste.sql      # cliente de teste + catálogo
psql -d geolynq_test -f supabase/tests/03_eventos_simulados.sql          # 420 buscas + cliques simulados
psql -t -A -d geolynq_test -f supabase/tests/04_painel_isolamento_e_relatorios.sql   # grava /tmp/res.json
psql -d geolynq_test -f supabase/tests/05_busca_sem_acento_e_limite_eventos.sql        # busca sem acento + limite de eventos (imprime OK 05; faz rollback)
psql -d geolynq_test -f supabase/tests/09_widget_v2_nucleo.sql                         # widget v2: tema, grade, lista de revendedores, regras de exposição (OK 09)
```

`04_*` confere: membro do cliente A lê os relatórios do A; usuário só do cliente B recebe NULL/0 linhas ao tentar ler o A;
anônimo não vê nada e não executa as funções.

`03_eventos_simulados.sql` também serve para popular o tenant `fabrica-teste` em produção (todas as sessões começam com
`seed-`; para apagar: `delete from public.widget_events where session_id like 'seed-%';` no SQL Editor).
