#!/usr/bin/env bash
# GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
# Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
# total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
# Unauthorized copying, replication, redistribution or commercial use is prohibited.
#
# Backup diário do banco do GeoLynq (Supabase) feito PELA VPS, enquanto o projeto está no plano gratuito (que não tem backup).
# Guarda (1) o schema public inteiro (dados e estrutura) e (2) os usuários do login (auth.users e auth.identities, só dados),
# em formato comprimido do pg_dump, confere se o arquivo abre, grava o SHA-256 e apaga o que passar de KEEP_DAYS dias.
#
# A senha do banco NUNCA vai para este arquivo nem para o repositório: fica só em um arquivo do usuário root da VPS (permissão 600):
#   ~/.geolynq-backup.env   com uma linha:   DATABASE_URL='postgresql://postgres.<ref>:<SENHA>@<host-do-pooler>:5432/postgres'
# Use a conexão "Session pooler" do painel do Supabase (Connect > Session pooler): ela funciona em IPv4. A conexão direta
# (db.<ref>.supabase.co) é só IPv6 e costuma falhar em VPS sem IPv6.
#
#   bash backup_supabase.sh            # roda um backup agora
#   0 3 * * * bash /root/geolynq-tools/backup_supabase.sh >> /root/backups/geolynq/cron.log 2>&1     # todo dia às 3h (crontab -e)
#
# Variáveis opcionais: GEOLYNQ_BACKUP_ENV (arquivo com a senha), GEOLYNQ_BACKUP_DIR (padrão ~/backups/geolynq), KEEP_DAYS (padrão 14).
# Sai com código diferente de zero se algo falhar (o cron registra no cron.log). Precisa do cliente do Postgres na MESMA versão (ou maior) que o servidor do Supabase (17 em 2026-10): postgresql-client-17 (repositório PGDG).
set -euo pipefail
umask 077

ENV_FILE="${GEOLYNQ_BACKUP_ENV:-$HOME/.geolynq-backup.env}"
DEST="${GEOLYNQ_BACKUP_DIR:-$HOME/backups/geolynq}"
KEEP_DAYS="${KEEP_DAYS:-14}"

falha() {
  echo "$(date '+%F %T') ERRO: $*" | tee -a "$DEST/backup.log" >&2
  # não deixa arquivo parcial (ou vazio) desta rodada parecendo um backup bom
  [ -z "${stamp:-}" ] || rm -f "$DEST/public-$stamp.dump"* "$DEST/auth-$stamp.dump"*
  exit 1
}
mkdir -p "$DEST"; chmod 700 "$DEST"

command -v pg_dump >/dev/null || falha "pg_dump não encontrado (instale postgresql-client-17, ver docs/seguranca-e-backup.md)"
[ -f "$ENV_FILE" ] || falha "falta o arquivo $ENV_FILE com a linha DATABASE_URL='...'"
perm="$(stat -c '%a' "$ENV_FILE")"
[ "$perm" = "600" ] || [ "$perm" = "400" ] || falha "o arquivo $ENV_FILE precisa ter permissão 600 (chmod 600 $ENV_FILE); está $perm"
# lê só a linha DATABASE_URL (sem executar o arquivo)
DATABASE_URL="$(sed -n "s/^DATABASE_URL=//p" "$ENV_FILE" | head -1 | sed "s/^['\"]//; s/['\"]$//")"
[ -n "$DATABASE_URL" ] || falha "DATABASE_URL vazio em $ENV_FILE"

stamp="$(date +%Y%m%d-%H%M%S)"
pub="$DEST/public-$stamp.dump"
aut="$DEST/auth-$stamp.dump"

# 1) schema public (estrutura + dados); sem donos e sem permissões (o destino define os dele)
pg_dump "$DATABASE_URL" --no-owner --no-privileges --schema=public --format=custom --file="$pub" || falha "pg_dump do schema public falhou"
# 2) usuários do login (só dados; as tabelas existem em todo projeto Supabase)
pg_dump "$DATABASE_URL" --no-owner --no-privileges --data-only --format=custom -t auth.users -t auth.identities --file="$aut" || falha "pg_dump do auth falhou"

# 3) o arquivo precisa abrir e ter o conteúdo esperado
for f in "$pub" "$aut"; do
  pg_restore --list "$f" > "$f.lista" || falha "o arquivo $f não abre (corrompido?)"
  [ "$(wc -l < "$f.lista")" -gt 5 ] || falha "o arquivo $f está vazio demais"
  rm -f "$f.lista"
  sha256sum "$f" > "$f.sha256"
done
grep -q "TABLE DATA public tenants" <(pg_restore --list "$pub") || falha "o backup não tem a tabela public.tenants"

# 4) rotação
find "$DEST" -maxdepth 1 \( -name 'public-*.dump*' -o -name 'auth-*.dump*' \) -mtime +"$KEEP_DAYS" -delete

tam="$(du -h "$pub" "$aut" | awk '{print $1}' | paste -sd+ )"
echo "$(date '+%F %T') OK: $(basename "$pub") + $(basename "$aut") ($tam); mantendo $KEEP_DAYS dias" | tee -a "$DEST/backup.log"
