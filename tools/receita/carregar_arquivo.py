#!/usr/bin/env python3
# GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
# Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
# total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
# Unauthorized copying, replication, redistribution or commercial use is prohibited.
"""Carrega UM arquivo .zip da base de CNPJ da Receita, lido em fluxo da entrada padrão, num SQLite local.

Só precisa de python3 e curl (nada de unzip/funzip/iconv/sqlite3). Nunca grava o zip nem o CSV descompactado em disco.

  curl -s -u 'CODIGO:' URL/Estabelecimentos1.zip | python3 carregar_arquivo.py --db cnpj.db --mes 2026-10 \\
       --arquivo Estabelecimentos1.zip --cnaes 4729699,4617600

Tipos: estabelecimentos (padrão; filtra por situação ativa e CNAE principal), municipios, cnaes.
Minimização de dados (LGPD): NÃO guarda telefone, e-mail, sócios nem razão social; só o necessário para localizar a loja.
--amostra N imprime só campos técnicos das N primeiras linhas (sem nomes) e sai: serve para conferir o layout.
"""
import argparse
import csv
import re
import sqlite3
import struct
import sys
import time
import zlib
from datetime import datetime, timezone

CAMPOS = 30  # layout de Estabelecimentos: 30 colunas, separador ';', aspas '"', sem cabeçalho, latin-1


def ler_exato(entrada, n):
    dados = b""
    while len(dados) < n:
        pedaco = entrada.read(n - len(dados))
        if not pedaco:
            break
        dados += pedaco
    return dados


def blocos_do_zip(entrada, estado, tam=1 << 20):
    """Descompacta em fluxo o primeiro (e único) arquivo do zip. Cada zip da Receita tem um arquivo só."""
    cab = ler_exato(entrada, 30)
    if len(cab) < 30 or cab[:4] != b"PK\x03\x04":
        raise SystemExit("A entrada não parece um arquivo zip (faltou a assinatura PK). Download com erro ou endereço errado?")
    metodo = struct.unpack("<H", cab[8:10])[0]
    n_nome, n_extra = struct.unpack("<HH", cab[26:30])
    ler_exato(entrada, n_nome + n_extra)
    if metodo != 8:
        raise SystemExit("Método de compressão %d não suportado (esperava deflate, 8)." % metodo)
    d = zlib.decompressobj(-15)
    while True:
        bloco = entrada.read(tam)
        if not bloco:
            break
        try:
            saida = d.decompress(bloco)
        except zlib.error as e:
            raise SystemExit("Erro ao descompactar: %s" % e)
        if saida:
            yield saida
        if d.eof:
            break
    estado["completo"] = d.eof


def linhas(blocos):
    resto = b""
    for b in blocos:
        partes = (resto + b).split(b"\n")
        resto = partes.pop()
        for p in partes:
            yield p.rstrip(b"\r").decode("latin-1")
    if resto:
        yield resto.rstrip(b"\r").decode("latin-1")


def campos_da_linha(linha):
    return next(csv.reader([linha], delimiter=";", quotechar='"'))


def abrir_banco(caminho, rapido=True):
    con = sqlite3.connect(caminho)
    if rapido:
        con.execute("pragma journal_mode = wal")
        con.execute("pragma synchronous = off")
    con.executescript(
        """
        create table if not exists estabelecimentos (
          cnpj text primary key, cnpj_basico text not null, matriz_filial integer, nome_fantasia text,
          situacao text, data_inicio text, cnae_principal text,
          tipo_logradouro text, logradouro text, numero text, complemento text, bairro text,
          cep text, uf text, municipio_receita text, mes_referencia text
        ) without rowid;
        create index if not exists est_cnae_uf on estabelecimentos (cnae_principal, uf);
        create index if not exists est_uf_mun on estabelecimentos (uf, municipio_receita);
        create index if not exists est_basico on estabelecimentos (cnpj_basico);
        create table if not exists municipios (codigo text primary key, nome text);
        create table if not exists cnaes (codigo text primary key, descricao text);
        create table if not exists carga (
          mes text, arquivo text, linhas_lidas integer, linhas_gravadas integer, malformadas integer,
          cnpj_com_letras integer, completo integer, segundos real, quando text, primary key (mes, arquivo)
        );
        """
    )
    return con


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", default="cnpj.db")
    ap.add_argument("--mes", default="")
    ap.add_argument("--arquivo", default="(stdin)")
    ap.add_argument("--tipo", choices=["estabelecimentos", "municipios", "cnaes"], default="estabelecimentos")
    ap.add_argument("--cnaes", default="", help="CNAEs de canal, separados por vírgula (obrigatório em estabelecimentos)")
    ap.add_argument("--ufs", default="", help="opcional: só estas UFs (ex.: SP,RJ). Vazio = Brasil inteiro")
    ap.add_argument("--amostra", type=int, default=0)
    a = ap.parse_args()
    inicio = time.time()
    estado = {"completo": False}
    fluxo = linhas(blocos_do_zip(sys.stdin.buffer, estado))

    if a.amostra:
        n = 0
        try:
            for ln in fluxo:
                c = campos_da_linha(ln)
                n += 1
                print("%d campos | cnpj=%s;%s;%s | matriz_filial=%s | situacao=%s | cnae=%s | uf=%s | municipio=%s | cep=%s"
                      % (len(c), c[0], c[1], c[2], c[3], c[5], c[11], c[19], c[20], c[18]) if len(c) >= 21 else "%d campos" % len(c))
                if n >= a.amostra:
                    break
        except SystemExit:
            if n == 0:
                raise
        return

    con = abrir_banco(a.db)
    lidas = gravadas = malformadas = com_letras = 0

    if a.tipo in ("municipios", "cnaes"):
        tabela = a.tipo
        lote = []
        for ln in fluxo:
            c = campos_da_linha(ln)
            lidas += 1
            if len(c) < 2:
                malformadas += 1
                continue
            lote.append((c[0], c[1]))
        con.executemany("insert or replace into %s values (?, ?)" % tabela, lote)
        gravadas = len(lote)
    else:
        if not a.cnaes:
            raise SystemExit("Informe --cnaes (CNAEs de canal do segmento).")
        cnaes = {x.strip() for x in a.cnaes.split(",") if x.strip()}
        ufs = {x.strip().upper() for x in a.ufs.split(",") if x.strip()}
        prefiltro = re.compile("|".join(sorted(cnaes)))  # barato: só linhas que citam algum CNAE vão para o parser
        lote = []
        sql = "insert or replace into estabelecimentos values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
        for ln in fluxo:
            lidas += 1
            if any(ch.isalpha() for ch in ln[1:9]):
                com_letras += 1  # CNPJ alfanumérico (ainda não confirmado pela fonte oficial; só contamos)
            if not prefiltro.search(ln):
                continue
            c = campos_da_linha(ln)
            if len(c) != CAMPOS:
                malformadas += 1
                continue
            if c[5] != "02" or c[11] not in cnaes:
                continue
            if ufs and c[19].upper() not in ufs:
                continue
            lote.append((c[0] + c[1] + c[2], c[0], int(c[3]) if c[3].isdigit() else None, c[4], c[5], c[10], c[11],
                         c[13], c[14], c[15], c[16], c[17], c[18], c[19], c[20], a.mes))
            if len(lote) >= 5000:
                con.executemany(sql, lote)
                gravadas += len(lote)
                lote = []
        if lote:
            con.executemany(sql, lote)
            gravadas += len(lote)

    seg = time.time() - inicio
    con.execute("insert or replace into carga values (?,?,?,?,?,?,?,?,?)",
                (a.mes, a.arquivo, lidas, gravadas, malformadas, com_letras, int(estado["completo"]), round(seg, 1),
                 datetime.now(timezone.utc).isoformat(timespec="seconds")))
    con.commit()
    con.close()
    print("%s: lidas=%d gravadas=%d malformadas=%d cnpj_com_letras=%d completo=%s em %.0fs"
          % (a.arquivo, lidas, gravadas, malformadas, com_letras, estado["completo"], seg))
    if not estado["completo"]:
        print("ATENÇÃO: o fluxo terminou antes do fim do arquivo (download cortado). Rode este arquivo de novo.", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
