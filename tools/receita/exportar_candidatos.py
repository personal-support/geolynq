#!/usr/bin/env python3
# GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
# Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
# total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
# Unauthorized copying, replication, redistribution or commercial use is prohibited.
"""Gera o SQL (INSERT ... ON CONFLICT DO NOTHING) dos candidatos a revendedor de UM cliente, a partir do cnpj.db da VPS.

  python3 exportar_candidatos.py --db ~/cnpj/cnpj.db --tenant 8f0c...-uuid --mes 2026-10 \\
      --cidades "SP:Santos,SP:Mirassol" --cnaes 4763602:3,9313100:1,4729699:1:ruidoso > candidatos.sql

Só as cidades pedidas (as que têm lacuna), no máximo --limite por cidade (padrão 60), os de maior aderência primeiro:
  score = peso do CNAE x 10 + 5 (tem nome fantasia) + 3 (matriz) - 8 (CNAE ruidoso, "guarda-chuva").
Só empresas ATIVAS (o carregador já filtra) e com CNPJ de DV válido. Sem telefone, e-mail, sócios nem razão social.
O SQL sai na saída padrão; o resumo (cidades, linhas, ignoradas) vai para a saída de erro. Aplicar: SQL Editor do Supabase.
Quem já é revendedor do cliente NÃO é removido aqui: o painel (panel_candidates) esconde pela raiz do CNPJ na hora de ler.
"""
import argparse
import re
import sqlite3
import sys
import unicodedata


def normaliza(txt):
    """Minúsculas e sem acento: 'São José' == 'SAO JOSE'."""
    s = unicodedata.normalize("NFD", txt or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()


def cnpj_valido(c):
    """14 caracteres [0-9A-Z]; 2 dígitos verificadores mod 11, valor = ASCII - 48 (vale para CNPJ numérico e alfanumérico)."""
    if not re.fullmatch(r"[0-9A-Z]{12}[0-9]{2}", c or ""):
        return False

    def dv(v):
        w, t = 2, 0
        for x in reversed(v):
            t += x * w
            w = w + 1 if w < 9 else 2
        r = t % 11
        return 0 if r < 2 else 11 - r

    v = [ord(ch) - 48 for ch in c[:12]]
    d1 = dv(v)
    return c[12] == str(d1) and c[13] == str(dv(v + [d1]))


def aspas(v):
    return "null" if v is None or v == "" else "'" + str(v).replace("'", "''") + "'"


def ler_cnaes(txt):
    """'4763602:3,9313100:1,4729699:1:ruidoso' -> {cnae: (peso, ruidoso)}"""
    out = {}
    for item in [x.strip() for x in txt.split(",") if x.strip()]:
        p = item.split(":")
        if not re.fullmatch(r"[0-9]{7}", p[0]):
            raise SystemExit("CNAE inválido (precisa de 7 dígitos): %r" % p[0])
        peso = int(p[1]) if len(p) > 1 and p[1] else 1
        if not 1 <= peso <= 3:
            raise SystemExit("peso do CNAE %s precisa estar entre 1 e 3" % p[0])
        out[p[0]] = (peso, "ruidoso" in p[2:])
    if not out:
        raise SystemExit("Informe --cnaes")
    return out


def ler_cidades(txt):
    out = []
    for item in [x.strip() for x in txt.split(",") if x.strip()]:
        uf, _, cid = item.partition(":")
        if not re.fullmatch(r"[A-Za-z]{2}", uf) or not cid.strip():
            raise SystemExit("Cidade inválida %r (use UF:Cidade, ex.: SP:Santos)" % item)
        out.append((uf.upper(), cid.strip()))
    if not out:
        raise SystemExit("Informe --cidades")
    return out


def gerar(con, tenant, mes, cidades, cnaes, limite):
    """Devolve (linhas_sql, resumo). `con` é uma conexão SQLite do cnpj.db."""
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", tenant):
        raise SystemExit("--tenant precisa ser o UUID do cliente")
    nomes = {}
    for cod, nome in con.execute("select codigo, nome from municipios"):
        nomes.setdefault(normaliza(nome), []).append(cod)
    resumo = {"cidades": [], "ignoradas_cnpj": 0, "linhas": 0}
    linhas = []
    marcadores = ",".join("?" * len(cnaes))
    for uf, cidade in cidades:
        codigos = nomes.get(normaliza(cidade), [])
        if not codigos:
            resumo["cidades"].append((uf, cidade, "município não encontrado na tabela da Receita", 0))
            continue
        cc = ",".join("?" * len(codigos))
        rows = con.execute(
            "select cnpj, nome_fantasia, cnae_principal, matriz_filial, bairro, cep from estabelecimentos "
            "where uf = ? and municipio_receita in (%s) and cnae_principal in (%s)" % (cc, marcadores),
            [uf] + codigos + list(cnaes),
        ).fetchall()
        itens = []
        for cnpj, fantasia, cnae, matriz, bairro, cep in rows:
            if not cnpj_valido(cnpj):
                resumo["ignoradas_cnpj"] += 1
                continue
            peso, ruidoso = cnaes[cnae]
            score = peso * 10 + (5 if (fantasia or "").strip() else 0) + (3 if matriz == 1 else 0) - (8 if ruidoso else 0)
            cep8 = re.sub(r"\D", "", cep or "")
            itens.append((max(score, 0), cnpj, (fantasia or "").strip() or None, cnae, bairro and bairro.strip() or None, cep8 if len(cep8) == 8 else None))
        municipio = normaliza_exibicao(con, codigos)
        itens.sort(key=lambda x: (-x[0], x[1]))
        itens = itens[:limite]
        resumo["cidades"].append((uf, cidade, "ok", len(itens)))
        for lote in range(0, len(itens), 100):
            valores = ",\n".join(
                "  (%s, %s, %s, %s, %s, %s, %s, %s, %d, %s)"
                % (aspas(tenant), aspas(c), aspas(f), aspas(cn), aspas(uf), aspas(municipio), aspas(b), aspas(cp), s, aspas(mes))
                for s, c, f, cn, b, cp in itens[lote:lote + 100]
            )
            linhas.append(
                "insert into public.reseller_candidates (tenant_id, cnpj, nome_fantasia, cnae, uf, municipio, bairro, cep, score, fonte_mes) values\n"
                + valores + "\non conflict (tenant_id, cnpj) do nothing;"
            )
        resumo["linhas"] += len(itens)
    return linhas, resumo


def normaliza_exibicao(con, codigos):
    """Nome do município como a Receita grava (MAIÚSCULAS, com acento): é o que fica na coluna `municipio`."""
    return con.execute("select nome from municipios where codigo = ?", (codigos[0],)).fetchone()[0].strip()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", default="cnpj.db")
    ap.add_argument("--tenant", required=True, help="UUID do cliente (public.tenants.id)")
    ap.add_argument("--mes", required=True, help="mês da base da Receita, AAAA-MM")
    ap.add_argument("--cidades", required=True, help="UF:Cidade separadas por vírgula (as cidades com lacuna)")
    ap.add_argument("--cnaes", required=True, help="cnae:peso[:ruidoso], separados por vírgula")
    ap.add_argument("--limite", type=int, default=60, help="máximo de candidatos por cidade (padrão 60)")
    a = ap.parse_args()
    if not re.fullmatch(r"\d{4}-\d{2}", a.mes):
        raise SystemExit("--mes precisa ser AAAA-MM")
    con = sqlite3.connect(a.db)
    linhas, resumo = gerar(con, a.tenant, a.mes, ler_cidades(a.cidades), ler_cnaes(a.cnaes), max(1, a.limite))
    print("-- GeoLynq: candidatos a revendedor (base %s). Gerado por tools/receita/exportar_candidatos.py" % a.mes)
    print("\n\n".join(linhas) if linhas else "-- (nenhum candidato encontrado)")
    for uf, cid, msg, n in resumo["cidades"]:
        print("%s/%s: %s (%d)" % (cid, uf, msg, n), file=sys.stderr)
    print("total: %d linhas; CNPJ de DV inválido ignorados: %d" % (resumo["linhas"], resumo["ignoradas_cnpj"]), file=sys.stderr)


if __name__ == "__main__":
    main()
