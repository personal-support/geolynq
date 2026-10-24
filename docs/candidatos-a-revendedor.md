# Candidatos a revendedor — passo a passo (Marco 2)

> GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados. Proibida a cópia, réplica ou comercialização sem autorização escrita (ver `LICENSE`).

**O que entrega:** na tela **Lacunas**, para cada cidade onde houve busca sem revendedor, a lista de empresas ativas do ramo do cliente que
**não constam na rede dele** (nome fantasia, CNPJ, bairro/CEP, atividade), com andamento (novo, contatado, vende, não vende, sem interesse).
**O que não é:** não diz que a empresa "não vende" (diz "não consta na sua base"); não traz telefone, e-mail, sócios nem razão social.

## Como funciona (3 ideias)
1. **Os CNAEs de canal vêm da rede do próprio cliente.** A planilha de revendedores já tem CNPJ. Descobrimos o CNAE (principal + secundários) de cada um,
   contamos sem repetir e **propomos** os que aparecem em pelo menos 5% da rede e em 3 ou mais revendedores. Quem confirma é uma pessoa.
2. **Nenhuma base de clientes futuros é guardada.** A base da Receita é lida em fluxo, uma vez por cliente (ou por mês), filtrada pelos CNAEs
   confirmados e descartada. Fica num SQLite por cliente na VPS (`~/cnpj/<cliente>.db`), e só as cidades com lacuna sobem para o Supabase (máx. 60 por cidade).
3. **Tudo que sai é excluído de forma visível:** `reseller_receita_resumo()` lista quantas linhas ficaram de fora e por quê (sem CNPJ, CNPJ inválido, não
   encontrado, inativo, consulta falhou, pendente).

## Passo a passo para um cliente novo
**0. Uma vez só:** aplicar `supabase/migrations/20261025000000_candidatos_a_revendedor.sql` e `20261025010000_candidatos_optout.sql` no SQL Editor (já aplicadas em produção em 24/10) (tabelas novas; não altera nada existente).
Sem isso o painel continua igual e a tela Lacunas mostra "Em breve".

**1. Lista de revendedores já importada** (Import v2). Pegar `id` e `cnpj` (SQL Editor → "Download CSV" ou copiar o resultado para `revendedores.csv` na VPS):
```sql
select id, cnpj from public.resellers where tenant_id = '<UUID DO CLIENTE>' and status = 'active' and cnpj is not null;
```

**2. Consultar a Receita pelo CNPJ de cada revendedor** (na VPS; ~0,5 s por CNPJ; 500 revendedores ≈ 5 min):
```bash
cd ~/geolynq/tools/receita && python3 cnae_dos_revendedores.py --entrada ~/revendedores.csv > ~/receita_revendedores.sql
```
O resumo no fim mostra `ok`, `nao_encontrado`, `consulta_falhou`, `cnpj_invalido`. Colar o `.sql` no SQL Editor.
*Não verificado:* a BrasilAPI com CNPJ **alfanumérico** e o limite de consultas por minuto. Se `consulta_falhou` vier alto, rodar de novo mais tarde (é seguro repetir).

**3. Propor e confirmar os CNAEs de canal** (SQL Editor):
```sql
select * from public.propose_channel_cnaes('<UUID DO CLIENTE>');          -- cnae, n_revendedores, participacao, n_principal, peso, ruidoso
select public.reseller_receita_resumo('<UUID DO CLIENTE>');               -- o que ficou de fora e por quê
update public.tenant_channel_cnaes set status = 'confirmado' where tenant_id = '<UUID>' and cnae in ('4763602', '9313100');
update public.tenant_channel_cnaes set status = 'descartado' where tenant_id = '<UUID>' and cnae = '4729699';
```
Conferir a descrição de cada CNAE (IBGE) antes de confirmar. `ruidoso = true` é o CNAE "guarda-chuva" (4729699): só entra com score menor.

**4. Carregar a Receita só com os CNAEs confirmados** (VPS, dentro do `tmux`; ~5,2 GB lidos em fluxo; nada de zip no disco):
```bash
CNAES="4763602,9313100" DB=$HOME/cnpj/cliente.db bash ~/geolynq/tools/receita/carregar_mes.sh 2026-10 tudo
```

**5. Cidades com lacuna** (SQL Editor; últimos 90 dias):
```sql
select upper(btrim(state)) as uf, btrim(city) as cidade, count(*) as buscas
  from public.widget_events
 where tenant_id = '<UUID>' and event_type = 'search' and product_id is not null and coalesce(results_count, 0) = 0
   and created_at >= now() - interval '90 days' and nullif(btrim(city), '') is not null and nullif(btrim(state), '') is not null
 group by 1, 2 order by buscas desc limit 15;
```

**6. Gerar e aplicar os candidatos** (VPS → SQL Editor). `cnae:peso[:ruidoso]`; peso 3 = CNAE principal da maioria dos revendedores, 1 = só secundário:
```bash
python3 ~/geolynq/tools/receita/exportar_candidatos.py --db ~/cnpj/cliente.db --tenant <UUID> --mes 2026-10 \
  --cidades "SP:Santos,SP:Mirassol" --cnaes 4763602:3,9313100:1 > ~/candidatos.sql
```
Colar `candidatos.sql` no SQL Editor. Repetir o passo 6 todo mês (e quando surgir lacuna em cidade nova): `ON CONFLICT DO NOTHING` preserva o andamento já marcado.

## Privacidade e regras
- Guardamos só dado cadastral de **empresa**: CNPJ, nome fantasia, CNAE, bairro, CEP, cidade. Sem telefone, e-mail, sócios, razão social (que em MEI traz o nome da pessoa).
- **Pedido de exclusão** (a página de privacidade da landing promete): o titular escreve com o CNPJ; no SQL Editor: `insert into public.candidate_optout (raiz) values ('<8 primeiros caracteres do CNPJ>') on conflict do nothing;`. Vale para matriz e filiais e para todos os clientes, e continua valendo quando a base for recarregada.
- Quem já é revendedor (mesmo CNPJ **ou mesma raiz de 8 caracteres**, isto é, filial) nunca aparece como candidato.
- Só `owner` e `admin` do cliente mudam o andamento; `viewer` só lê (o banco confere, não só a tela).
- Texto ao cliente: "não constam na sua rede". Antes de abordar, a equipe confere o contato por fontes próprias.

## Testes
`supabase/tests/17_candidatos_a_revendedor.sql` (banco), `python3 tools/receita/testes.py` (scripts da VPS; sem rede), E2E do painel (`apps/admin/e2e/painel.e2e.cjs`).
**Não testado em produção:** consulta real à BrasilAPI, carga real de um cliente novo e o desempenho com dezenas de milhares de candidatos.
