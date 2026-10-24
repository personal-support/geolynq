#!/usr/bin/env python3
# GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
# Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
# total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
# Unauthorized copying, replication, redistribution or commercial use is prohibited.
"""Descobre situação e CNAEs (principal + secundários) de cada revendedor do cliente pelo CNPJ e gera o SQL para
`public.reseller_receita`. Depois, `select * from public.propose_channel_cnaes('<tenant>')` propõe os CNAEs de canal.

Entrada (CSV com cabeçalho `id,cnpj`; é o resultado de `select id, cnpj from public.resellers where tenant_id = '...' and cnpj is not null`):

  python3 cnae_dos_revendedores.py --entrada revendedores.csv > receita_revendedores.sql

Consulta a BrasilAPI (https://brasilapi.com.br/api/cnpj/v1/<cnpj>), uma por revendedor, com pausa entre as chamadas (padrão 0,5 s) e
repetição em 429/5xx. 404 vira erro 'nao_encontrado'; qualquer outra falha vira 'consulta_falhou' (a linha fica registrada e pode ser
repetida). Só situação e atividades são guardadas: nenhum dado pessoal. Seguro para repetir (ON CONFLICT DO UPDATE).
CNPJ alfanumérico (novo): se a BrasilAPI ainda não o aceitar, a linha sai como 'consulta_falhou' e o relatório mostra quantas.
"""
import argparse
import csv
import json
import re
import sys
import time
import urllib.error
import urllib.request

from exportar_candidatos import aspas, cnpj_valido


def digitos(txt):
    return re.sub(r"[^0-9A-Za-z]", "", txt or "").upper()


def cod7(x):
    s = re.sub(r"\D", "", str(x or ""))
    return s.zfill(7) if s else None


def consultar(base, cnpj, tentativas=3, pausa_erro=2.0, abrir=urllib.request.urlopen):
    """Devolve (dados|None, erro|None)."""
    for t in range(tentativas):
        try:
            req = urllib.request.Request("%s/%s" % (base.rstrip("/"), cnpj), headers={"User-Agent": "GeoLynq/1.0", "Accept": "application/json"})
            with abrir(req, timeout=20) as r:
                return json.loads(r.read().decode("utf-8")), None
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None, "nao_encontrado"
            if e.code == 429 or e.code >= 500:
                time.sleep(pausa_erro * (t + 1))
                continue
            return None, "consulta_falhou"
        except (urllib.error.URLError, TimeoutError, ValueError, OSError):
            time.sleep(pausa_erro * (t + 1))
    return None, "consulta_falhou"


def linha_sql(rid, cnpj, dados, erro):
    if erro:
        situacao, principal, sec = None, None, []
    else:
        situacao = (dados.get("descricao_situacao_cadastral") or "").upper() or None
        principal = cod7(dados.get("cnae_fiscal"))
        vistos, sec = set(), []
        for x in dados.get("cnaes_secundarios") or []:
            c = cod7(x.get("codigo") if isinstance(x, dict) else x)
            if c and c != principal and c != "0000000" and c not in vistos:
                vistos.add(c)
                sec.append(c)
    arr = "array[%s]::text[]" % ",".join(aspas(c) for c in sec) if sec else "'{}'::text[]"
    return (
        "insert into public.reseller_receita (reseller_id, tenant_id, cnpj, situacao, cnae_principal, cnaes_secundarios, erro, fonte, consultado_em)\n"
        "select r.id, r.tenant_id, %s, %s, %s, %s, %s, 'brasilapi', now() from public.resellers r where r.id = %s\n"
        "on conflict (reseller_id) do update set cnpj = excluded.cnpj, situacao = excluded.situacao, cnae_principal = excluded.cnae_principal,\n"
        "  cnaes_secundarios = excluded.cnaes_secundarios, erro = excluded.erro, fonte = excluded.fonte, consultado_em = excluded.consultado_em;"
        % (aspas(cnpj), aspas(situacao), aspas(principal), arr, aspas(erro), aspas(rid))
    )


def processar(linhas, base, pausa=0.5, abrir=urllib.request.urlopen, dormir=time.sleep):
    """linhas: iterável de dicts {id, cnpj}. Devolve (sqls, resumo)."""
    sqls, resumo = [], {"consultados": 0, "ok": 0, "nao_encontrado": 0, "consulta_falhou": 0, "cnpj_invalido": 0, "duplicados": 0}
    vistos = set()
    for lin in linhas:
        rid = (lin.get("id") or "").strip()
        cnpj = digitos(lin.get("cnpj"))
        if not re.fullmatch(r"[0-9a-fA-F-]{36}", rid):
            continue
        if not cnpj_valido(cnpj):
            resumo["cnpj_invalido"] += 1
            continue
        if rid in vistos:
            resumo["duplicados"] += 1
            continue
        vistos.add(rid)
        dados, erro = consultar(base, cnpj, abrir=abrir, pausa_erro=0.0 if pausa == 0 else 2.0)
        resumo["consultados"] += 1
        resumo["ok" if not erro else erro] += 1
        sqls.append(linha_sql(rid, cnpj, dados, erro))
        dormir(pausa)
    return sqls, resumo


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--entrada", required=True, help="CSV com cabeçalho id,cnpj")
    ap.add_argument("--base", default="https://brasilapi.com.br/api/cnpj/v1")
    ap.add_argument("--pausa", type=float, default=0.5)
    a = ap.parse_args()
    with open(a.entrada, newline="", encoding="utf-8-sig") as f:
        sqls, resumo = processar(csv.DictReader(f), a.base, a.pausa)
    print("-- GeoLynq: situação e CNAEs dos revendedores (BrasilAPI). Gerado por tools/receita/cnae_dos_revendedores.py")
    print("\n".join(sqls) if sqls else "-- (nada consultado)")
    print("resumo: %s" % json.dumps(resumo, ensure_ascii=False), file=sys.stderr)


if __name__ == "__main__":
    main()
