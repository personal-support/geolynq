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
import unittest

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
          cep text, uf text, municipio_receita text, mes_referencia text);
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
        con.execute("insert into estabelecimentos values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (cnpj, cnpj[:8], m, f, "02", "", cn, "", "", "", "", b, cep, uf, mun, "2026-10"))
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
        self.assertIn("on conflict (tenant_id, cnpj) do nothing", sql)
        self.assertIn("null, '4763602', 'SP', 'SANTOS', 'Embaré'", sql)   # sem nome fantasia vira null
        # CEP malformado vira null; score: Alfa = 3*10+5+3 = 38; Delta (ruidoso) = 1*10+5+3-8 = 10
        self.assertIn("'Delta Esportes', '4729699', 'SP', 'SANTOS', 'Aparecida', null, 10,", sql)
        self.assertIn("'Alfa Suplementos', '4763602', 'SP', 'SANTOS', 'Gonzaga', '11060001', 38,", sql)
        self.assertEqual([c for c in r["cidades"] if c[2] != "ok"][0][1], "Cidade Que Nao Existe")
        # maior aderência primeiro dentro da cidade
        self.assertLess(sql.index("Alfa Suplementos"), sql.index("Delta Esportes"))

    def test_limite_por_cidade(self):
        linhas, r = exp.gerar(banco(), TENANT, "2026-10", [("SP", "Santos")], exp.ler_cnaes("4763602:3,9313100:1,4729699:1:ruidoso"), 2)
        self.assertEqual(r["linhas"], 2)
        self.assertNotIn("Delta", "\n".join(linhas))

    def test_tenant_precisa_ser_uuid(self):
        with self.assertRaises(SystemExit):
            exp.gerar(banco(), "x'; drop table t; --", "2026-10", [("SP", "Santos")], {"4763602": (1, False)}, 5)


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
