# Segurança e backup do GeoLynq (24/10/2026)

> GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados. Proibida a cópia, réplica ou comercialização sem autorização escrita (ver `LICENSE`).

## 1. O que foi encontrado e corrigido (aplicado em produção em 24/10)
| # | Problema | Gravidade | Correção |
|---|---|---|---|
| 1 | **O papel "viewer" só era respeitado na tela.** As políticas `tenant_admin_all_*` deixavam qualquer membro do cliente (inclusive viewer) inserir, alterar e apagar revendedores, produtos, endereços, cobertura e importações **direto na API**, com o token de login. Provado em teste: antes, o viewer inseria revendedor; agora é barrado (`new row violates row-level security policy`) também em produção. | **Alta** | Todos os membros **leem** (`members_read_*`); só `owner` e `admin` **escrevem** (a política antiga passou a exigir o papel e a valer só para `authenticated`). O painel não escreve nessas tabelas; a importação usa a chave de serviço do n8n, que ignora RLS. |
| 2 | `anon` e `authenticated` tinham `TRUNCATE`, `REFERENCES` e `TRIGGER` (e `INSERT/UPDATE/DELETE`) em quase todas as tabelas. `TRUNCATE` não passa por RLS. A API REST não expõe `TRUNCATE`, mas é defesa em profundidade. | Média | Revogados. `anon` ficou só com `INSERT` em `widget_events` (o widget) e a leitura do catálogo/rede ativos; `authenticated` não escreve mais em `tenants`, `tenant_users`, `widget_events`, `commercial_opportunities`. |
| 3 | Três funções de gatilho (`widget_events_limit`, `panel_ai_readings_limit`, `widget_events_sem_dado_pessoal`) chamáveis pela API por qualquer pessoa. | Baixa | `EXECUTE` revogado (gatilho não precisa). |
| 4 | `candidate_optout` e `reseller_receita` com RLS e sem política (alerta). | Informativo | Política explícita `negar_tudo` (só o `service_role` acessa). |

Testes: `supabase/tests/19_endurecimento_seguranca.sql` (hermético; falha no estado antigo e passa no novo), mais os SQL 13, 15, 16, 17, 18 e o E2E do painel (160/160) continuam passando. Migrations: `20261028000000_endurecimento_seguranca.sql` (aplicada) e `20261028010000_spatial_ref_sys_rls.sql` (**não aplicável**, ver abaixo).

## 2. Riscos que continuam (decisão consciente)
| Risco | Por que continua | O que fazer |
|---|---|---|
| **`public.spatial_ref_sys` sem RLS e com escrita para `anon`** (alerta ERRO do Supabase). É a tabela de projeções do PostGIS, do dono `supabase_admin`: o usuário `postgres` não pode ligar RLS nem revogar (`must be owner`). A chave anônima é pública (está no widget), então, em tese, alguém poderia apagar ou alterar linhas de projeções pela API. Não há dado de cliente nela; o widget usa `geography` em SRID 4326. | Só o dono altera. Mover o PostGIS para outro schema resolveria, mas mexe nas colunas e nas funções do widget (risco de quebrar a busca por distância). | Tratar como **risco aceito** por ora. Quando houver tempo: testar a mudança do PostGIS para o schema `extensions` num banco local e abrir chamado no suporte do Supabase. Monitorar: `select count(*) from public.spatial_ref_sys` (deve ser cerca de 8.500 linhas). |
| `SECURITY DEFINER` chamável por `anon`: `is_active_tenant` (necessária às políticas de leitura do widget), `widget_get_tenant` e `widget_get_tenant_v2` (API pública do widget), `st_estimatedextent` (PostGIS). | São intencionais ou do PostGIS. | Manter; documentadas aqui. |
| `SECURITY DEFINER` chamável por `authenticated`: `panel_candidate_status`, `panel_term_set`, `panel_term_remove` (conferem o vínculo e o papel dentro da função), `candidato_optout` (devolve só sim/não de uma raiz de CNPJ). | Intencionais. | Manter. |
| "Leaked password protection" desligada. | É uma opção do Auth e só existe no plano **Pro**. | Ligar quando migrar para o Pro. Enquanto isso, usar senha longa e única. |
| Qualquer membro (inclusive viewer) pode inserir "leitura de IA" em `panel_ai_readings` pela API. | O painel precisa que o próprio usuário logado grave a leitura (Danilo, viewer, gera leituras na demo). O pior caso é texto falso na tela do **próprio** cliente. | Aceito. Se virar problema: gravar a leitura por função com a chave de serviço. |

## 3. O que só você pode fazer (painel do Supabase e das contas)
1. **Desligar o cadastro aberto**: Authentication → Sign In / Providers → desligue "Allow new users to sign up". Os usuários são criados por você; o cadastro aberto só gera contas sem acesso a dado nenhum, mas não há motivo para deixar. Depois do ajuste, confira que o login do Danilo continua funcionando.
2. **Senha forte e 2FA** nas contas que mandam em tudo: Supabase, GitHub, EasyPanel, Hostinger e o e-mail `personalpg51@gmail.com`.
3. **Plano Pro do Supabase** quando entrar o primeiro cliente pagante: backup automático, "leaked password protection" e suporte. Até lá, o backup abaixo.
4. **Nunca** colar a senha do banco, a `service_role` ou o token de deploy no chat nem no repositório.

## 4. Backup pela VPS (enquanto o plano é gratuito)
O plano gratuito **não tem backup**. Script: `tools/backup/backup_supabase.sh` (testado em ambiente local: gera os dois arquivos, recusa senha com permissão aberta, confere se o arquivo abre, guarda o SHA-256, apaga o que passa de 14 dias, e a restauração em um banco novo devolveu as mesmas contagens de linhas). **Não testado:** a conexão real com o Supabase a partir da VPS.

Passo a passo na VPS (um bloco por vez):
```bash
# 1) cliente do Postgres (versão 16 ou maior)
apt-get install -y postgresql-client
# 2) arquivo da senha, só seu (a senha vem do painel do Supabase: Connect > Session pooler)
install -m 600 /dev/null ~/.geolynq-backup.env
nano ~/.geolynq-backup.env      # uma linha:  DATABASE_URL='postgresql://postgres.vshlsisnuaugeceafipt:SUASENHA@HOST-DO-POOLER:5432/postgres'
# 3) rodar uma vez para testar
bash ~/geolynq-tools/backup_supabase.sh
ls -la ~/backups/geolynq
# 4) todo dia às 3h
(crontab -l 2>/dev/null; echo "0 3 * * * bash /root/geolynq-tools/backup_supabase.sh >> /root/backups/geolynq/cron.log 2>&1") | crontab -
```
- Use o **Session pooler** (IPv4). A conexão direta (`db.<ref>.supabase.co`) é só IPv6 e costuma falhar em VPS sem IPv6.
- Os arquivos têm dados pessoais (e-mails, telefones): ficam em pasta `700`, arquivos `600`. Copiar para fora da VPS (Google Drive, outro servidor) é o próximo passo, **ainda não feito**: a VPS é um ponto único de falha.
- **Restaurar:** crie um projeto Supabase novo (ou Postgres com PostGIS e as funções `auth.*`), `pg_restore --no-owner -d "$URL" public-AAAAMMDD-HHMMSS.dump` e, para os logins, `pg_restore --data-only -d "$URL" auth-AAAAMMDD-HHMMSS.dump`. Treine a restauração **uma vez** antes de precisar dela.

## 5. Rotina
- A cada mudança de banco: rodar `get_advisors` (segurança) e os testes SQL 13 a 19.
- Mensal: conferir `backup.log`, restaurar o último backup em um banco de teste e comparar contagens; revisar quem está em `tenant_users` e com qual papel.
- Antes de cada cliente novo: conferir o papel de cada pessoa (owner/admin escrevem; viewer só lê).
