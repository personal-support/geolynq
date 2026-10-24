#!/usr/bin/env python3
# GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
# Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
# total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
# Unauthorized copying, replication, redistribution or commercial use is prohibited.
"""Testes dos scripts da VPS (sem rede e sem Postgres): python3 tools/receita/testes.py
Um servidor HTTP local faz o papel da BrasilAPI; um SQLite em memória faz o papel do cnpj.db."""
import http.server
import json
import sqlite3
import threading
import io
import os
import subprocess
import sys
import tempfile
import unittest
import zipfile

import cnae_dos_revendedores as rev
import exportar_candidatos as exp

TENANT = "00000000-0000-4000-8000-0000000017aa"


def banco():
    con = sqlite3.connect(":memory:")
    con.executescript(
        """
        create table municipios (codigo text primary key, nome text);
        create table estabelecimentos (cnpj text primary key, cnpj_basico text, matriz_filial integer, nome_fantasia text, situacao text,
          data_inicio text, cnae_principal text, tipo_logradouro text, logradouro text, numero text, complemento text, bairro text,
          cep text, uf text, municipio_receita text, mes_referencia text, cnaes_secundarios text, ddd1 text, telefone1 text, ddd2 text, telefone2 text, email text);
        insert into municipios values ('7071', 'SANTOS'), ('6285', 'SÃO JOSÉ DO RIO PRETO'), ('1111', 'SANTOS');  -- 1111 = Santos de outra UF
        """
    )
    linhas = [
        # cnpj, matriz, fantasia, cnae, bairro, cep, uf, mun
        ("19283746000188", 1, "Alfa Suplementos", "4763602", "Gonzaga", "11060001", "SP", "7071"),
        ("86420975000194", 0, "Beta Academia", "9313100", "Boqueirão", "11055100", "SP", "7071"),
        ("24681012000197", 1, "", "4763602", "Embaré", "11040000", "SP", "7071"),               # sem nome fantasia
        ("13579113000135", 1, "Delta Esportes", "4729699", "Aparecida", "1103", "SP", "7071"),    # CEP malformado, CNAE ruidoso
        ("13579113000136", 1, "DV errado", "4763602", "X", "11030400", "SP", "7071"),            # DV inválido: ignorado
        ("98765432000198", 1, "Outra UF", "4763602", "Centro", "20000000", "RJ", "1111"),
        ("77123456000173", 1, "O'Brien & Filhos", "4763602", "Centro", "15000000", "SP", "6285"),  # aspa simples + acento na cidade
        ("55800012000192", 1, "Fora do canal", "1099607", "Centro", "11000000", "SP", "7071"),    # CNAE fora da lista
    ]
    for cnpj, m, f, cn, b, cep, uf, mun in linhas:
        con.execute("insert into estabelecimentos (cnpj, cnpj_basico, matriz_filial, nome_fantasia, situacao, data_inicio, cnae_principal, tipo_logradouro, logradouro, numero, complemento, bairro, cep, uf, municipio_receita, mes_referencia) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (cnpj, cnpj[:8], m, f, "02", "", cn, "", "", "", "", b, cep, uf, mun, "2026-10"))
    # contato, endereço e CNAEs secundários de dois estabelecimentos
    con.execute("update estabelecimentos set tipo_logradouro='AVENIDA', logradouro='ANA COSTA', numero='100', complemento='SALA 2', cnaes_secundarios='9313100,4729699', ddd1='13', telefone1='999990000', email='alfa@exemplo.com.br' where cnpj='19283746000188'")
    con.execute("update estabelecimentos set ddd1=null, telefone1=null, ddd2='13', telefone2='33334444' where cnpj='86420975000194'")
    return con


class Exportar(unittest.TestCase):
    def test_dv_numerico_e_alfanumerico(self):
        for ok in ["11222333000181", "AB12CD34000184", "ZX9Q7M21000111"]:
            self.assertTrue(exp.cnpj_valido(ok), ok)
        for ruim in ["11222333000180", "", "1122233300018", "ab12cd34000184", "AB12CD3400018A"]:
            self.assertFalse(exp.cnpj_valido(ruim), ruim)

    def test_cnaes_e_cidades(self):
        self.assertEqual(exp.ler_cnaes("4763602:3,4729699:1:ruidoso,9313100"), {"4763602": (3, False), "4729699": (1, True), "9313100": (1, False)})
        with self.assertRaises(SystemExit):
            exp.ler_cnaes("123:1")
        with self.assertRaises(SystemExit):
            exp.ler_cnaes("4763602:9")
        self.assertEqual(exp.ler_cidades("sp:Santos, RJ:Niterói"), [("SP", "Santos"), ("RJ", "Niterói")])
        with self.assertRaises(SystemExit):
            exp.ler_cidades("Santos")

    def test_gera_so_o_que_deve(self):
        cn = exp.ler_cnaes("4763602:3,9313100:1,4729699:1:ruidoso")
        linhas, r = exp.gerar(banco(), TENANT, "2026-10", [("SP", "santos"), ("SP", "Sao Jose do Rio Preto"), ("SP", "Cidade Que Nao Existe")], cn, 60)
        sql = "\n".join(linhas)
        self.assertEqual(r["linhas"], 5)                       # Alfa, Beta, sem fantasia, Delta, O'Brien (DV errado, outra UF e outro CNAE ficam de fora)
        self.assertEqual(r["ignoradas_cnpj"], 1)
        self.assertNotIn("Outra UF", sql)
        self.assertNotIn("Fora do canal", sql)
        self.assertNotIn("DV errado", sql)
        self.assertIn("'SÃO JOSÉ DO RIO PRETO'", sql)           # nome como a Receita grava, não o digitado
        self.assertIn("'O''Brien & Filhos'", sql)               # aspa simples escapada
        self.assertIn("null, '4763602', 'SP', 'SANTOS', 'Embaré'", sql)   # sem nome fantasia vira null
        # CEP malformado vira null; score: Alfa = 3*10+5+3 = 38; Delta (ruidoso) = 1*10+5+3-8 = 10
        self.assertIn("'Delta Esportes', '4729699', 'SP', 'SANTOS', 'Aparecida', null, 10,", sql)
        # Alfa: 3*10 + 5 (fantasia) + 3 (matriz) + 3 (só 9313100 conta: o 4729699 é o guarda-chuva e não pontua) = 41
        self.assertIn("'Alfa Suplementos', '4763602', 'SP', 'SANTOS', 'Gonzaga', '11060001', 41, '2026-10', 'AVENIDA ANA COSTA', '100', 'SALA 2', '13999990000', 'alfa@exemplo.com.br', array['4729699','9313100']::text[]", sql)
        self.assertIn("'1333334444'", sql)                       # sem telefone 1: usa o 2
        self.assertIn("on conflict (tenant_id, cnpj) do update set", sql)
        self.assertNotIn("do nothing", sql)
        self.assertEqual([c for c in r["cidades"] if c[2] != "ok"][0][1], "Cidade Que Nao Existe")
        # maior aderência primeiro dentro da cidade
        self.assertLess(sql.index("Alfa Suplementos"), sql.index("Delta Esportes"))

    def test_loja_de_tudo_perde_pontos(self):
        con = banco()
        muitos = ",".join("%07d" % (4500000 + i) for i in range(13))
        con.execute("update estabelecimentos set cnaes_secundarios=? where cnpj='24681012000197'", (muitos,))
        linhas, r = exp.gerar(con, TENANT, "2026-10", [("SP", "Santos")], exp.ler_cnaes("4763602:3,9313100:1,4729699:1:ruidoso"), 60)
        # sem nome fantasia: 3*10 + 3 (matriz) - 4 (13 atividades) = 29
        self.assertIn("'4763602', 'SP', 'SANTOS', 'Embaré', '11040000', 29,", "\n".join(linhas))

    def test_excluir_cnpj(self):
        linhas, r = exp.gerar(banco(), TENANT, "2026-10", [("SP", "Santos")], exp.ler_cnaes("4763602:3,9313100:1,4729699:1:ruidoso"), 60, {"86420975000194"})
        sql = "\n".join(linhas)
        self.assertNotIn("Beta Academia", sql)
        self.assertIn("Alfa Suplementos", sql)
        self.assertEqual(r["excluidas"], 1)

    def test_limite_por_cidade(self):
        linhas, r = exp.gerar(banco(), TENANT, "2026-10", [("SP", "Santos")], exp.ler_cnaes("4763602:3,9313100:1,4729699:1:ruidoso"), 2)
        self.assertEqual(r["linhas"], 2)
        self.assertNotIn("Delta", "\n".join(linhas))

    def test_tenant_precisa_ser_uuid(self):
        with self.assertRaises(SystemExit):
            exp.gerar(banco(), "x'; drop table t; --", "2026-10", [("SP", "Santos")], {"4763602": (1, False)}, 5)


def linha_receita(cnpj, fantasia, cnae, sec, tel1=("13", "33334444"), email="CONTATO@Exemplo.COM.BR", cep="11060001", uf="SP", mun="7071", situacao="02", ddd2="", tel2=""):
    """Uma linha de Estabelecimentos no layout da Receita: 30 colunas, ';', aspas, latin-1."""
    c = [""] * 30
    c[0], c[1], c[2] = cnpj[:8], cnpj[8:12], cnpj[12:]
    c[3], c[4], c[5], c[10], c[11], c[12] = "1", fantasia, situacao, "20200101", cnae, sec
    c[13], c[14], c[15], c[16], c[17], c[18], c[19], c[20] = "AVENIDA", "ANA COSTA", "100", "SALA 2", "GONZAGA", cep, uf, mun
    c[21], c[22], c[23], c[24], c[27] = tel1[0], tel1[1], ddd2, tel2, email
    return ";".join('"%s"' % x for x in c)


class Carregar(unittest.TestCase):
    def rodar(self, linhas, db):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("K.ESTABELE", "\n".join(linhas).encode("latin-1"))
        aqui = os.path.dirname(os.path.abspath(__file__))
        r = subprocess.run([sys.executable, os.path.join(aqui, "carregar_arquivo.py"), "--db", db, "--mes", "2026-10", "--arquivo", "t.zip", "--cnaes", "4763602,4771701"],
                           input=buf.getvalue(), capture_output=True)
        self.assertEqual(r.returncode, 0, r.stderr.decode())

    def test_guarda_endereco_contato_e_secundarios_e_limpa_placeholders(self):
        with tempfile.TemporaryDirectory() as d:
            db = os.path.join(d, "cnpj.db")
            self.rodar([
                linha_receita("19283746000188", "ALFA SUPLEMENTOS", "4763602", "9313100,4729699"),
                linha_receita("86420975000194", "BETA", "4771701", "", tel1=("00", "000000000"), email="isto nao e email", ddd2="13", tel2="999990000"),
                linha_receita("24681012000197", "INATIVA", "4763602", "", situacao="08"),     # situação não ativa: ignorada
                linha_receita("13579113000135", "OUTRO CNAE", "1099607", ""),                  # CNAE fora da lista: ignorado
            ], db)
            con = sqlite3.connect(db)
            alfa = con.execute("select logradouro, numero, complemento, bairro, ddd1, telefone1, email, cnaes_secundarios, tipo_logradouro from estabelecimentos where cnpj='19283746000188'").fetchone()
            self.assertEqual(alfa, ("ANA COSTA", "100", "SALA 2", "GONZAGA", "13", "33334444", "contato@exemplo.com.br", "9313100,4729699", "AVENIDA"))
            beta = con.execute("select ddd1, telefone1, ddd2, telefone2, email from estabelecimentos where cnpj='86420975000194'").fetchone()
            self.assertEqual(beta, (None, None, "13", "999990000", None))   # zeros e e-mail inválido viram null
            self.assertEqual(con.execute("select count(*) from estabelecimentos").fetchone()[0], 2)

    def test_banco_antigo_ganha_as_colunas_novas(self):
        with tempfile.TemporaryDirectory() as d:
            db = os.path.join(d, "cnpj.db")
            c = sqlite3.connect(db)
            c.executescript("create table estabelecimentos (cnpj text primary key, cnpj_basico text not null, matriz_filial integer, nome_fantasia text, situacao text, data_inicio text, cnae_principal text, tipo_logradouro text, logradouro text, numero text, complemento text, bairro text, cep text, uf text, municipio_receita text, mes_referencia text) without rowid; insert into estabelecimentos (cnpj, cnpj_basico, nome_fantasia) values ('11222333000181','11222333','ANTIGO');")
            c.commit(); c.close()
            self.rodar([linha_receita("19283746000188", "ALFA", "4763602", "")], db)
            con = sqlite3.connect(db)
            cols = {r[1] for r in con.execute("pragma table_info(estabelecimentos)")}
            self.assertTrue({"cnaes_secundarios", "ddd1", "telefone1", "ddd2", "telefone2", "email"} <= cols)
            self.assertEqual(con.execute("select nome_fantasia from estabelecimentos where cnpj='11222333000181'").fetchone()[0], "ANTIGO")   # nada se perde


class Fake(http.server.BaseHTTPRequestHandler):
    chamadas = []
    falhas_429 = {"ZX9Q7M21000111": 1}

    def log_message(self, *a):
        pass

    def do_GET(self):
        cnpj = self.path.rsplit("/", 1)[-1]
        Fake.chamadas.append(cnpj)
        if cnpj == "45997418000153":
            self.send_response(404); self.end_headers(); self.wfile.write(b"{}"); return
        if cnpj == "33000167000101":
            self.send_response(400); self.end_headers(); self.wfile.write(b"{}"); return
        if Fake.falhas_429.get(cnpj, 0) > 0:
            Fake.falhas_429[cnpj] -= 1
            self.send_response(429); self.end_headers(); self.wfile.write(b"{}"); return
        corpo = {"cnpj": cnpj, "descricao_situacao_cadastral": "Ativa", "cnae_fiscal": 4763602,
                 "cnaes_secundarios": [{"codigo": 4763602}, {"codigo": 9313100}, {"codigo": 9313100}, {"codigo": 0}, {"codigo": 4729699}]}
        if cnpj == "60701190000104":
            corpo["descricao_situacao_cadastral"] = "BAIXADA"; corpo["cnae_fiscal"] = 1099607; corpo["cnaes_secundarios"] = []
        self.send_response(200); self.send_header("content-type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(corpo).encode())


class Revendedores(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Fake)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.base = "http://127.0.0.1:%d/api/cnpj/v1" % cls.srv.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def test_processa_a_lista(self):
        Fake.chamadas.clear()
        ids = ["00000000-0000-4000-8000-00000000000%d" % i for i in range(1, 8)]
        entrada = [
            {"id": ids[0], "cnpj": "11.222.333/0001-81"},   # ok, com máscara
            {"id": ids[1], "cnpj": "45997418000153"},       # 404
            {"id": ids[2], "cnpj": "33000167000101"},       # 400 -> consulta_falhou
            {"id": ids[3], "cnpj": "60701190000104"},       # baixada
            {"id": ids[4], "cnpj": "ZX9Q7M21000111"},       # 429 uma vez e depois ok (alfanumérico)
            {"id": ids[5], "cnpj": "11222333000180"},       # DV inválido: nem consulta
            {"id": ids[0], "cnpj": "11222333000181"},       # id repetido: nem consulta
            {"id": "nao-e-uuid", "cnpj": "11222333000181"}, # id inválido: ignora
        ]
        sqls, r = rev.processar(entrada, self.base, pausa=0, dormir=lambda s: None)
        self.assertEqual(r, {"consultados": 5, "ok": 3, "nao_encontrado": 1, "consulta_falhou": 1, "cnpj_invalido": 1, "duplicados": 1})
        self.assertEqual(len(sqls), 5)
        self.assertNotIn("11222333000180", Fake.chamadas)
        self.assertEqual(Fake.chamadas.count("11222333000181"), 1)
        self.assertEqual(Fake.chamadas.count("ZX9Q7M21000111"), 2)          # repetiu depois do 429
        s0 = sqls[0]
        self.assertIn("'ATIVA', '4763602', array['9313100','4729699']::text[]", s0)   # sem repetidos, sem o principal, sem 0000000
        self.assertIn("'nao_encontrado'", sqls[1])
        self.assertIn("'consulta_falhou'", sqls[2])
        self.assertIn("'BAIXADA', '1099607', '{}'::text[]", sqls[3])
        self.assertIn("on conflict (reseller_id) do update", s0)


if __name__ == "__main__":
    unittest.main(verbosity=1)
