#!/usr/bin/env bash
# GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
# Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
# total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
# Unauthorized copying, replication, redistribution or commercial use is prohibited.
#
# Carrega um mês da base de CNPJ da Receita (só leitura da fonte; grava num SQLite local). Lê em fluxo, um arquivo por vez:
# nenhum zip nem CSV descompactado vai para o disco. Precisa só de bash, curl e python3.
#
#   bash carregar_mes.sh 2026-10 teste    # carrega só Estabelecimentos1.zip (326 MB) e as tabelas pequenas: mede tempo e linhas
#   bash carregar_mes.sh 2026-10 tudo     # os 10 arquivos de Estabelecimentos (≈5,2 GB); pode demorar, rode dentro do tmux/screen
#
# Variáveis (opcionais): DB (padrão $HOME/cnpj/cnpj.db), CODIGO (código do compartilhamento da Receita), UFS (ex.: SP,RJ; vazio = Brasil).
set -u -o pipefail

MES="${1:?Use: bash carregar_mes.sh AAAA-MM teste|tudo}"
MODO="${2:-teste}"
CODIGO="${CODIGO:-gn672Ad4CF8N6TK}"
DB="${DB:-$HOME/cnpj/cnpj.db}"
UFS="${UFS:-}"
# CNAEs de canal do segmento "suplementos" (tabela segment_channel_cnaes do Supabase, conferida em 2026-10-24)
CNAES="4729699,4617600,4637199,4763602,4771701,4619200,4639701,4691500,4771702,9313100"
BASE="https://arquivos.receitafederal.gov.br/public.php/webdav/Dados/Cadastros/CNPJ/$MES"
AQUI="$(cd "$(dirname "$0")" && pwd)"
CARGA="$AQUI/carregar_arquivo.py"

command -v curl >/dev/null || { echo "Falta o curl."; exit 1; }
command -v python3 >/dev/null || { echo "Falta o python3."; exit 1; }
mkdir -p "$(dirname "$DB")"
echo "Banco: $DB | mês: $MES | modo: $MODO | disco livre: $(df -h "$(dirname "$DB")" | awk 'NR==2{print $4}')"

baixar() { # $1 = arquivo, resto = argumentos do carregador
  local arq="$1"; shift
  echo "--- $arq  ($(date +%H:%M:%S))"
  if ! curl -sf --retry 3 --retry-delay 5 -u "$CODIGO:" "$BASE/$arq" | python3 "$CARGA" --db "$DB" --mes "$MES" --arquivo "$arq" "$@"; then
    echo "FALHOU: $arq (rode de novo; o carregador é seguro para repetir)"; return 1
  fi
}

FALHAS=0
baixar Cnaes.zip --tipo cnaes || FALHAS=$((FALHAS+1))
baixar Municipios.zip --tipo municipios || FALHAS=$((FALHAS+1))

if [ "$MODO" = "teste" ]; then
  baixar Estabelecimentos1.zip --cnaes "$CNAES" --ufs "$UFS" || FALHAS=$((FALHAS+1))
else
  for i in 1 2 3 4 5 6 7 8 9 0; do   # o 0 (2,2 GB) por último
    baixar "Estabelecimentos$i.zip" --cnaes "$CNAES" --ufs "$UFS" || FALHAS=$((FALHAS+1))
  done
fi

echo "=== resumo"
python3 - "$DB" <<'PY'
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
print("estabelecimentos gravados:", c.execute("select count(*) from estabelecimentos").fetchone()[0])
print("por UF (top 8):", c.execute("select uf, count(*) n from estabelecimentos group by uf order by n desc limit 8").fetchall())
print("por CNAE:", c.execute("select cnae_principal, count(*) from estabelecimentos group by 1 order by 2 desc").fetchall())
print("cargas:", c.execute("select arquivo, linhas_lidas, linhas_gravadas, malformadas, cnpj_com_letras, completo, segundos from carga order by quando").fetchall())
PY
ls -lh "$DB" | awk '{print "tamanho do banco:", $5}'
[ "$FALHAS" -eq 0 ] && echo "TUDO OK" || { echo "$FALHAS arquivo(s) falharam"; exit 1; }
