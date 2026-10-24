/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
// Testes da lógica pura dos períodos (lib/periodo.ts). Rodar: node --experimental-strip-types apps/admin/e2e/periodo.test.mts
import assert from "node:assert/strict";
import { periodoDeAtalho, periodoPersonalizado, resolverPeriodo, lerData } from "../lib/periodo.ts";

let n = 0;
const ok = (nome: string, fn: () => void) => {
  try {
    fn();
    console.log(`PASS ${nome}`, ++n && "");
  } catch (e: any) {
    console.log(`FAIL ${nome}\n  ${e.message}`);
    process.exitCode = 1;
  }
};

// sábado, 24/10/2026, 14:30 em Brasília (17:30 UTC)
const SAB = new Date("2026-10-24T17:30:00Z");

ok("últimos N dias: janela móvel e comparação com os N dias imediatamente antes", () => {
  const p = periodoDeAtalho("7d", SAB);
  assert.equal(p.de, "2026-10-17T17:30:00.000Z");
  assert.equal(p.ate, SAB.toISOString());
  assert.equal(p.ant_de, "2026-10-10T17:30:00.000Z");
  assert.equal(p.ant_ate, p.de);
  assert.equal(p.dias, 7);
  assert.equal(p.query, "p=7d");
});

ok("hoje: do início do dia em Brasília até agora; compara com ontem até a mesma hora", () => {
  const p = periodoDeAtalho("hoje", SAB);
  assert.equal(p.de, "2026-10-24T03:00:00.000Z");
  assert.equal(p.ate, SAB.toISOString());
  assert.equal(p.ant_de, "2026-10-23T03:00:00.000Z");
  assert.equal(p.ant_ate, "2026-10-23T17:30:00.000Z");
  assert.equal(p.dias, 1);
});

ok("fuso: 23h de Brasília ainda é o mesmo dia (em UTC já é o dia seguinte)", () => {
  const p = periodoDeAtalho("hoje", new Date("2026-10-25T02:00:00Z")); // 23:00 de sábado em Brasília
  assert.equal(p.de, "2026-10-24T03:00:00.000Z");
});

ok("fuso: 01h de Brasília já é o dia novo (em UTC ainda é o anterior)", () => {
  const p = periodoDeAtalho("hoje", new Date("2026-10-25T04:00:00Z")); // domingo 01:00 em Brasília
  assert.equal(p.de, "2026-10-25T03:00:00.000Z");
});

ok("esta semana: começa na SEGUNDA e compara com os mesmos dias da semana anterior", () => {
  const p = periodoDeAtalho("semana", SAB);
  assert.equal(p.de, "2026-10-19T03:00:00.000Z"); // segunda 19/10
  assert.equal(p.dias, 6); // seg a sáb
  assert.equal(p.ant_de, "2026-10-12T03:00:00.000Z");
  assert.equal(p.ant_ate, new Date(Date.parse("2026-10-12T03:00:00Z") + (SAB.getTime() - Date.parse("2026-10-19T03:00:00Z"))).toISOString());
});

ok("esta semana no domingo: ainda é a semana que começou na segunda anterior", () => {
  const p = periodoDeAtalho("semana", new Date("2026-10-25T15:00:00Z")); // domingo 12:00 em Brasília
  assert.equal(p.de, "2026-10-19T03:00:00.000Z");
  assert.equal(p.dias, 7);
});

ok("esta semana na segunda de manhã: 1 dia", () => {
  const p = periodoDeAtalho("semana", new Date("2026-10-26T13:00:00Z")); // segunda 10:00 em Brasília
  assert.equal(p.de, "2026-10-26T03:00:00.000Z");
  assert.equal(p.dias, 1);
});

ok("semana passada: segunda a domingo anteriores, 7 dias", () => {
  const p = periodoDeAtalho("semana-passada", SAB);
  assert.equal(p.de, "2026-10-12T03:00:00.000Z");
  assert.equal(p.ate, "2026-10-19T03:00:00.000Z");
  assert.equal(p.ant_de, "2026-10-05T03:00:00.000Z");
  assert.equal(p.ant_ate, p.de);
  assert.equal(p.dias, 7);
});

ok("este mês: dia 1 até agora; compara com os mesmos dias do mês anterior", () => {
  const p = periodoDeAtalho("mes", SAB);
  assert.equal(p.de, "2026-10-01T03:00:00.000Z");
  assert.equal(p.dias, 24);
  assert.equal(p.ant_de, "2026-09-01T03:00:00.000Z");
  assert.equal(p.ant_ate, "2026-09-24T17:30:00.000Z");
});

ok("este mês em dia 31, com mês anterior de 30 dias: a comparação não invade o mês atual", () => {
  const p = periodoDeAtalho("mes", new Date("2026-10-31T20:00:00Z")); // 31/10 17:00 em Brasília; setembro tem 30 dias
  assert.equal(p.ant_ate, "2026-10-01T03:00:00.000Z"); // trava no fim de setembro
  assert.ok(Date.parse(p.ant_ate) <= Date.parse(p.de));
});

ok("mês anterior: o mês inteiro, com o nome no rótulo", () => {
  const p = periodoDeAtalho("mes-passado", SAB);
  assert.equal(p.de, "2026-09-01T03:00:00.000Z");
  assert.equal(p.ate, "2026-10-01T03:00:00.000Z");
  assert.equal(p.dias, 30);
  assert.equal(p.rotulo, "Mês anterior (setembro de 2026)");
  assert.equal(p.ant_de, "2026-08-01T03:00:00.000Z");
});

ok("virada de ano: em 1º de janeiro, mês anterior = dezembro e esta semana pode começar em dezembro", () => {
  const jan1 = new Date("2026-01-01T15:00:00Z"); // quinta 12:00 em Brasília
  const m = periodoDeAtalho("mes-passado", jan1);
  assert.equal(m.de, "2025-12-01T03:00:00.000Z");
  assert.equal(m.rotulo, "Mês anterior (dezembro de 2025)");
  assert.equal(m.dias, 31);
  const s = periodoDeAtalho("semana", jan1);
  assert.equal(s.de, "2025-12-29T03:00:00.000Z"); // segunda 29/12
  assert.equal(s.dias, 4);
});

ok("este ano: de 1º de janeiro até agora", () => {
  const p = periodoDeAtalho("ano", SAB);
  assert.equal(p.de, "2026-01-01T03:00:00.000Z");
  assert.equal(p.dias, 297);
  assert.equal(p.ant_de, "2025-01-01T03:00:00.000Z");
});

ok("meia-noite exata: o período nunca tem duração zero (o banco recusaria)", () => {
  for (const chave of ["hoje", "semana", "mes", "ano"] as const) {
    const p = periodoDeAtalho(chave, new Date("2026-10-26T03:00:00Z")); // segunda 00:00:00 em Brasília
    assert.ok(Date.parse(p.ate) > Date.parse(p.de), `${chave}: ate > de`);
    assert.ok(Date.parse(p.ant_ate) > Date.parse(p.ant_de), `${chave}: ant_ate > ant_de`);
  }
});

ok("personalizado: datas inclusivas, fim = começo do dia seguinte, comparação do mesmo tamanho imediatamente antes", () => {
  const p = periodoPersonalizado("2026-10-01", "2026-10-20", SAB);
  assert.ok(typeof p !== "string");
  if (typeof p === "string") return;
  assert.equal(p.de, "2026-10-01T03:00:00.000Z");
  assert.equal(p.ate, "2026-10-21T03:00:00.000Z");
  assert.equal(p.dias, 20);
  assert.equal(p.ant_de, "2026-09-11T03:00:00.000Z");
  assert.equal(p.ant_ate, p.de);
  assert.equal(p.rotulo, "01/10/2026 a 20/10/2026");
  assert.equal(p.id, "pers:2026-10-01:2026-10-20");
  assert.equal(p.query, "p=personalizado&de=2026-10-01&ate=2026-10-20");
});

ok("personalizado até hoje: o fim vira 'agora'; o futuro é cortado em hoje", () => {
  const p = periodoPersonalizado("2026-10-20", "2026-12-31", SAB);
  assert.ok(typeof p !== "string");
  if (typeof p === "string") return;
  assert.equal(p.ate, SAB.toISOString());
  assert.equal(p.dias, 5); // 20 a 24
});

ok("personalizado de um dia só", () => {
  const p = periodoPersonalizado("2026-10-10", "2026-10-10", SAB);
  assert.ok(typeof p !== "string");
  if (typeof p === "string") return;
  assert.equal(p.dias, 1);
  assert.equal(p.rotulo, "10/10/2026");
});

ok("personalizado inválido devolve mensagem", () => {
  for (const [a, b] of [["2026-10-20", "2026-10-01"], ["2026-02-30", "2026-03-01"], ["abc", "2026-10-01"], ["2026-10-01", ""], ["2026-11-10", "2026-11-12"], ["2025-01-01", "2026-10-01"]] as const) {
    assert.equal(typeof periodoPersonalizado(a, b, SAB), "string", `${a} → ${b}`);
  }
});

ok("lerData recusa datas que não existem", () => {
  assert.equal(lerData("2026-02-29"), null);
  assert.equal(lerData("2028-02-29")?.d, 29);
  assert.equal(lerData("26-10-2026"), null);
});

ok("resolverPeriodo: ?p=, ?dias= antigo, valor desconhecido e personalizado inválido", () => {
  assert.equal(resolverPeriodo({ p: "mes" }, SAB).chave, "mes");
  assert.equal(resolverPeriodo({ dias: "90" }, SAB).chave, "90d");
  assert.equal(resolverPeriodo({ dias: "15" }, SAB).chave, "30d");
  assert.equal(resolverPeriodo({}, SAB).chave, "30d");
  assert.equal(resolverPeriodo({ p: "xyz" }, SAB).chave, "30d");
  assert.equal(resolverPeriodo({ p: ["semana", "mes"] }, SAB).chave, "semana");
  const ruim = resolverPeriodo({ p: "personalizado", de: "2026-13-01", ate: "2026-10-01" }, SAB);
  assert.equal(ruim.chave, "30d");
  assert.ok(ruim.aviso && ruim.aviso.length > 5);
  assert.equal(resolverPeriodo({ p: "personalizado", de: "2026-10-01", ate: "2026-10-20" }, SAB).chave, "personalizado");
});

ok("nenhum período passa de 366 dias nem tem início depois do fim", () => {
  for (const chave of ["7d", "30d", "90d", "hoje", "semana", "semana-passada", "mes", "mes-passado", "ano"] as const) {
    const p = periodoDeAtalho(chave, new Date("2026-12-31T20:00:00Z"));
    assert.ok(Date.parse(p.ate) > Date.parse(p.de), chave);
    assert.ok(Date.parse(p.ate) - Date.parse(p.de) <= 366 * 86400000, chave);
    assert.ok(Date.parse(p.ant_ate) <= Date.parse(p.de), `${chave}: a comparação não pode invadir o período`);
  }
});
console.log(n ? "" : "NENHUM TESTE RODOU");
