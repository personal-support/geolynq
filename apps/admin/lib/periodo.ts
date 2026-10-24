/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
/**
 * Períodos do painel (hoje, esta semana, semana passada, este mês, mês anterior, este ano, personalizado, e os "últimos N dias").
 * Lógica pura (sem Next, sem relógio escondido): quem chama passa `agora`, o que permite testar com datas fixas
 * (apps/admin/e2e/periodo.test.mts).
 *
 * Calendário em horário de Brasília. O Brasil não tem horário de verão desde 2019, então Brasília é UTC−3 o ano todo;
 * se isso mudar por lei, ajustar DESLOCAMENTO_H. A semana começa na SEGUNDA-feira.
 *
 * Intervalos são "meio abertos": [de, ate). A comparação ("anterior") usa os MESMOS dias do período anterior, para que um mês
 * pela metade não seja comparado com um mês inteiro.
 */

const DESLOCAMENTO_H = 3; // Brasília = UTC−3
const HORA = 3600_000;
const DIA = 24 * HORA;

/** Máximo de dias de um período (a retenção dos dados é de 12 meses; o banco também recusa mais de 366 dias). */
export const MAX_DIAS = 366;

export type PeriodoChave =
  | "7d"
  | "30d"
  | "90d"
  | "hoje"
  | "semana"
  | "semana-passada"
  | "mes"
  | "mes-passado"
  | "ano"
  | "personalizado";

export interface Periodo {
  chave: PeriodoChave;
  /** Identifica o período para guardar a leitura de IA: a própria chave, ou `pers:AAAA-MM-DD:AAAA-MM-DD`. */
  id: string;
  rotulo: string;
  /** Instantes ISO (UTC) enviados ao banco. */
  de: string;
  ate: string;
  ant_de: string;
  ant_ate: string;
  /** Dias de calendário do período (≥ 1): textos e leitura de IA. */
  dias: number;
  /** "comparados com os 7 dias anteriores" */
  comparacao: string;
  /** Parâmetros de URL que reproduzem este período: `p=mes`, `p=personalizado&de=…&ate=…`. */
  query: string;
  /** Mensagem quando o pedido era inválido e caímos no padrão (ou null). */
  aviso: string | null;
}

export const PERIODO_PADRAO: PeriodoChave = "30d";

/** Os três botões fixos (como sempre foi) e o menu "Outros períodos". */
export const BOTOES: { chave: PeriodoChave; rotulo: string }[] = [
  { chave: "7d", rotulo: "7 dias" },
  { chave: "30d", rotulo: "30 dias" },
  { chave: "90d", rotulo: "90 dias" },
];
export const MENU: { chave: PeriodoChave; rotulo: string }[] = [
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "semana", rotulo: "Esta semana" },
  { chave: "semana-passada", rotulo: "Semana passada" },
  { chave: "mes", rotulo: "Este mês" },
  { chave: "mes-passado", rotulo: "Mês anterior" },
  { chave: "ano", rotulo: "Este ano" },
];

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

interface Data {
  a: number; // ano
  m: number; // mês 0-11
  d: number; // dia 1-31
}

/** Data de calendário em Brasília de um instante. */
function dataBrasilia(t: number): Data {
  const x = new Date(t - DESLOCAMENTO_H * HORA);
  return { a: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate() };
}

/** Instante em que começa o dia (00:00 de Brasília) da data informada. `d` pode estourar o mês (Date.UTC normaliza). */
function inicioDoDia(a: number, m: number, d: number): number {
  return Date.UTC(a, m, d) + DESLOCAMENTO_H * HORA;
}

/** 0 = segunda … 6 = domingo, para o dia de calendário de Brasília. */
function diaDaSemana(a: number, m: number, d: number): number {
  return (new Date(Date.UTC(a, m, d)).getUTCDay() + 6) % 7;
}

const iso = (t: number) => new Date(t).toISOString();
const pad = (n: number) => String(n).padStart(2, "0");
const dataTexto = (x: Data) => `${pad(x.d)}/${pad(x.m + 1)}/${x.a}`;
const dataIso = (x: Data) => `${x.a}-${pad(x.m + 1)}-${pad(x.d)}`;
const diasEntre = (de: number, ate: number) => Math.max(1, Math.round((ate - de) / DIA));

function montar(p: Omit<Periodo, "de" | "ate" | "ant_de" | "ant_ate" | "query" | "aviso"> & { de: number; ate: number; ant_de: number; ant_ate: number; query?: string; aviso?: string | null }): Periodo {
  // No instante exato da meia-noite o período "até agora" teria duração zero e o banco o recusaria: garante 1 segundo.
  if (p.ate <= p.de) p.ate = p.de + 1000;
  if (p.ant_ate <= p.ant_de) p.ant_ate = p.ant_de + 1000;
  return { ...p, de: iso(p.de), ate: iso(p.ate), ant_de: iso(p.ant_de), ant_ate: iso(p.ant_ate), query: p.query ?? `p=${p.chave}`, aviso: p.aviso ?? null };
}

/** "Últimos N dias": janela móvel até agora, comparada com os N dias imediatamente antes. */
function movel(n: 7 | 30 | 90, agora: number): Periodo {
  const de = agora - n * DIA;
  return montar({
    chave: `${n}d` as PeriodoChave,
    id: `${n}d`,
    rotulo: `Últimos ${n} dias`,
    de,
    ate: agora,
    ant_de: de - n * DIA,
    ant_ate: de,
    dias: n,
    comparacao: `comparados com os ${n} dias anteriores`,
  });
}

/**
 * Período pelo atalho. `agora` é o relógio da requisição. Não valida o personalizado (use `resolverPeriodo`).
 */
export function periodoDeAtalho(chave: Exclude<PeriodoChave, "personalizado">, agora: Date): Periodo {
  const t = agora.getTime();
  const hoje = dataBrasilia(t);
  const ini0 = inicioDoDia(hoje.a, hoje.m, hoje.d);

  switch (chave) {
    case "7d":
      return movel(7, t);
    case "30d":
      return movel(30, t);
    case "90d":
      return movel(90, t);
    case "hoje": {
      const ant = ini0 - DIA;
      return montar({
        chave, id: chave, rotulo: "Hoje", de: ini0, ate: t, ant_de: ant, ant_ate: ant + (t - ini0), dias: 1,
        comparacao: "comparado com ontem, até a mesma hora",
      });
    }
    case "semana": {
      const ini = inicioDoDia(hoje.a, hoje.m, hoje.d - diaDaSemana(hoje.a, hoje.m, hoje.d));
      const ant = ini - 7 * DIA;
      return montar({
        chave, id: chave, rotulo: "Esta semana", de: ini, ate: t, ant_de: ant, ant_ate: ant + (t - ini), dias: diasEntre(ini, ini0 + DIA),
        comparacao: "comparados com os mesmos dias da semana anterior",
      });
    }
    case "semana-passada": {
      const seg = inicioDoDia(hoje.a, hoje.m, hoje.d - diaDaSemana(hoje.a, hoje.m, hoje.d));
      const ini = seg - 7 * DIA;
      return montar({
        chave, id: chave, rotulo: "Semana passada", de: ini, ate: seg, ant_de: ini - 7 * DIA, ant_ate: ini, dias: 7,
        comparacao: "comparados com a semana anterior a ela",
      });
    }
    case "mes": {
      const ini = inicioDoDia(hoje.a, hoje.m, 1);
      const antIni = inicioDoDia(hoje.a, hoje.m - 1, 1);
      return montar({
        chave, id: chave, rotulo: "Este mês", de: ini, ate: t, ant_de: antIni, ant_ate: Math.min(antIni + (t - ini), ini), dias: hoje.d,
        comparacao: "comparados com os mesmos dias do mês anterior",
      });
    }
    case "mes-passado": {
      const fim = inicioDoDia(hoje.a, hoje.m, 1);
      const ini = inicioDoDia(hoje.a, hoje.m - 1, 1);
      const x = dataBrasilia(ini + 12 * HORA);
      return montar({
        chave, id: chave, rotulo: `Mês anterior (${MESES[x.m]} de ${x.a})`, de: ini, ate: fim,
        ant_de: inicioDoDia(hoje.a, hoje.m - 2, 1), ant_ate: ini, dias: diasEntre(ini, fim),
        comparacao: "comparados com o mês anterior a ele",
      });
    }
    case "ano": {
      const ini = inicioDoDia(hoje.a, 0, 1);
      const antIni = inicioDoDia(hoje.a - 1, 0, 1);
      return montar({
        chave, id: chave, rotulo: "Este ano", de: ini, ate: t, ant_de: antIni, ant_ate: Math.min(antIni + (t - ini), ini), dias: diasEntre(ini, ini0 + DIA),
        comparacao: "comparados com o mesmo período do ano anterior (o painel guarda no máximo 12 meses de dados)",
      });
    }
  }
}

const REGEX_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** AAAA-MM-DD válido (dia que existe no calendário) ou null. */
export function lerData(v: string | null | undefined): Data | null {
  const m = REGEX_DATA.exec((v ?? "").trim());
  if (!m) return null;
  const a = Number(m[1]);
  const mes = Number(m[2]) - 1;
  const d = Number(m[3]);
  const x = new Date(Date.UTC(a, mes, d));
  if (x.getUTCFullYear() !== a || x.getUTCMonth() !== mes || x.getUTCDate() !== d) return null;
  if (a < 2020 || a > 2100) return null;
  return { a, m: mes, d };
}

/** Período personalizado, de `de` a `ate` (os dois inclusive, como o usuário pensa). Devolve texto de erro quando inválido. */
export function periodoPersonalizado(deTxt: string | null | undefined, ateTxt: string | null | undefined, agora: Date): Periodo | string {
  const de = lerData(deTxt);
  const ate = lerData(ateTxt);
  if (!de || !ate) return "Datas inválidas. Use o formato dia/mês/ano.";
  const t = agora.getTime();
  const hoje = dataBrasilia(t);
  const iniDe = inicioDoDia(de.a, de.m, de.d);
  const iniAte = inicioDoDia(ate.a, ate.m, ate.d);
  const iniHoje = inicioDoDia(hoje.a, hoje.m, hoje.d);
  if (iniDe > iniAte) return "A data inicial não pode ser depois da data final.";
  if (iniDe > iniHoje) return "A data inicial está no futuro.";
  const fimCalendario = Math.min(iniAte, iniHoje) + DIA; // fim do último dia pedido (nunca depois de hoje)
  const dias = diasEntre(iniDe, fimCalendario);
  if (dias > MAX_DIAS) return `Escolha no máximo ${MAX_DIAS} dias (o painel guarda 12 meses de dados).`;
  const ateInstante = Math.min(fimCalendario, t);
  const a = dataBrasilia(iniDe);
  const b = dataBrasilia(fimCalendario - DIA);
  const rotulo = dias === 1 ? dataTexto(a) : `${dataTexto(a)} a ${dataTexto(b)}`;
  return montar({
    chave: "personalizado",
    id: `pers:${dataIso(a)}:${dataIso(b)}`,
    rotulo,
    de: iniDe,
    ate: ateInstante,
    ant_de: iniDe - dias * DIA,
    ant_ate: iniDe,
    dias,
    comparacao: `comparados com os ${dias} ${dias === 1 ? "dia" : "dias"} anteriores`,
    query: `p=personalizado&de=${dataIso(a)}&ate=${dataIso(b)}`,
  });
}

type Param = string | string[] | undefined;
const um = (v: Param) => (Array.isArray(v) ? v[0] : v);

/**
 * Lê o período dos parâmetros da URL. Aceita `?p=<chave>` (+ `de`/`ate` no personalizado) e, por compatibilidade, o antigo `?dias=7|30|90`.
 * Pedido inválido não derruba a página: cai no padrão (30 dias) e devolve `aviso`.
 */
export function resolverPeriodo(sp: { p?: Param; dias?: Param; de?: Param; ate?: Param }, agora: Date): Periodo {
  const p = um(sp.p);
  if (p === "personalizado") {
    const r = periodoPersonalizado(um(sp.de), um(sp.ate), agora);
    if (typeof r !== "string") return r;
    return { ...periodoDeAtalho(PERIODO_PADRAO as "30d", agora), aviso: r };
  }
  const validas: string[] = [...BOTOES, ...MENU].map((x) => x.chave);
  if (p && validas.includes(p)) return periodoDeAtalho(p as Exclude<PeriodoChave, "personalizado">, agora);
  const dias = Number(um(sp.dias));
  if (dias === 7 || dias === 30 || dias === 90) return periodoDeAtalho(`${dias}d` as "7d" | "30d" | "90d", agora);
  return periodoDeAtalho(PERIODO_PADRAO as "30d", agora);
}
