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
  + 3 por CNAE secundário de canal que não seja o "guarda-chuva" (máx. +6); - 4 se a empresa lista mais de 12 atividades (loja de tudo).
Só empresas ATIVAS (o carregador já filtra) e com CNPJ de DV válido. Traz endereço, telefone e e-mail cadastrais (dado público da
Receita); sem sócios nem razão social. Rodar de novo atualiza esses campos e o score, sem mexer no andamento marcado pela equipe.
O SQL sai na saída padrão; o resumo (cidades, linhas, ignoradas) vai para a saída de erro. Aplicar: SQL Editor do Supabase.
Quem já é revendedor do cliente (ou pediu exclusão) NÃO é removido aqui: o painel (panel_candidates) esconde pela raiz do CNPJ na hora de ler.
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


def gerar(con, tenant, mes, cidades, cnaes, limite, excluir=()):
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
            "select cnpj, nome_fantasia, cnae_principal, matriz_filial, bairro, cep, tipo_logradouro, logradouro, numero, complemento, "
            "cnaes_secundarios, ddd1, telefone1, ddd2, telefone2, email from estabelecimentos "
            "where uf = ? and municipio_receita in (%s) and cnae_principal in (%s)" % (cc, marcadores),
            [uf] + codigos + list(cnaes),
        ).fetchall()
        itens = []
        for cnpj, fantasia, cnae, matriz, bairro, cep, tipo, rua, num, compl, secund, ddd1, tel1, ddd2, tel2, email in rows:
            if cnpj in excluir:
                resumo["excluidas"] = resumo.get("excluidas", 0) + 1
                continue
            if not cnpj_valido(cnpj):
                resumo["ignoradas_cnpj"] += 1
                continue
            peso, ruidoso = cnaes[cnae]
            sec = [x for x in re.findall(r"[0-9]{7}", secund or "") if x != cnae]
            # só CNAE secundário de canal que NÃO seja o "guarda-chuva" conta; quem lista muitas atividades (loja de tudo) perde 4 pontos
            sec_canal = sorted({x for x in sec if x in cnaes and not cnaes[x][1]})
            score = (peso * 10 + (5 if (fantasia or "").strip() else 0) + (3 if matriz == 1 else 0) - (8 if ruidoso else 0)
                     + min(6, 3 * len(sec_canal)) - (4 if len(set(sec)) > 12 else 0))
            cep8 = re.sub(r"\D", "", cep or "")
            rua_txt = " ".join(x.strip() for x in (tipo, rua) if x and x.strip()) or None
            fone = (ddd1 or "") + tel1 if tel1 else ((ddd2 or "") + tel2 if tel2 else None)
            itens.append({
                "score": max(score, 0), "cnpj": cnpj, "fantasia": (fantasia or "").strip() or None, "cnae": cnae,
                "bairro": bairro and bairro.strip() or None, "cep": cep8 if len(cep8) == 8 else None,
                "logradouro": rua_txt, "numero": (num or "").strip() or None, "complemento": (compl or "").strip() or None,
                "telefone": fone, "email": email, "sec": sorted(set(sec))[:20],
            })
        municipio = normaliza_exibicao(con, codigos)
        itens.sort(key=lambda x: (-x["score"], x["cnpj"]))
        itens = itens[:limite]
        resumo["cidades"].append((uf, cidade, "ok", len(itens)))
        for lote in range(0, len(itens), 100):
            valores = ",\n".join(
                "  (%s, %s, %s, %s, %s, %s, %s, %s, %d, %s, %s, %s, %s, %s, %s, %s)"
                % (aspas(tenant), aspas(i["cnpj"]), aspas(i["fantasia"]), aspas(i["cnae"]), aspas(uf), aspas(municipio), aspas(i["bairro"]),
                   aspas(i["cep"]), i["score"], aspas(mes), aspas(i["logradouro"]), aspas(i["numero"]), aspas(i["complemento"]),
                   aspas(i["telefone"]), aspas(i["email"]),
                   ("array[%s]::text[]" % ",".join(aspas(x) for x in i["sec"])) if i["sec"] else "'{}'::text[]")
                for i in itens[lote:lote + 100]
            )
            linhas.append(
                "insert into public.reseller_candidates (tenant_id, cnpj, nome_fantasia, cnae, uf, municipio, bairro, cep, score, fonte_mes, "
                "logradouro, numero, complemento, telefone, email, cnaes_secundarios) values\n"
                + valores + "\non conflict (tenant_id, cnpj) do update set nome_fantasia = excluded.nome_fantasia, cnae = excluded.cnae, "
                "bairro = excluded.bairro, cep = excluded.cep, score = excluded.score, fonte_mes = excluded.fonte_mes, logradouro = excluded.logradouro, "
                "numero = excluded.numero, complemento = excluded.complemento, telefone = excluded.telefone, email = excluded.email, "
                "cnaes_secundarios = excluded.cnaes_secundarios;"
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
    ap.add_argument("--excluir", default="", help="CNPJs (14 caracteres, separados por vírgula) que NÃO devem entrar, ex.: empresas fora do ramo")
    a = ap.parse_args()
    if not re.fullmatch(r"\d{4}-\d{2}", a.mes):
        raise SystemExit("--mes precisa ser AAAA-MM")
    con = sqlite3.connect(a.db)
    linhas, resumo = gerar(con, a.tenant, a.mes, ler_cidades(a.cidades), ler_cnaes(a.cnaes), max(1, a.limite),
                              {re.sub(r"[^0-9A-Za-z]", "", x).upper() for x in a.excluir.split(",") if x.strip()})
    print("-- GeoLynq: candidatos a revendedor (base %s). Gerado por tools/receita/exportar_candidatos.py" % a.mes)
    print("\n\n".join(linhas) if linhas else "-- (nenhum candidato encontrado)")
    for uf, cid, msg, n in resumo["cidades"]:
        print("%s/%s: %s (%d)" % (cid, uf, msg, n), file=sys.stderr)
    print("total: %d linhas; CNPJ de DV inválido ignorados: %d; excluídos por você: %d" % (resumo["linhas"], resumo["ignoradas_cnpj"], resumo.get("excluidas", 0)), file=sys.stderr)


if __name__ == "__main__":
    main()
