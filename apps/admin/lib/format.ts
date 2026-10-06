const TZ = "America/Sao_Paulo";

const nInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nDec = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const num = (v: number | null | undefined) => (v == null ? "—" : nInt.format(v));
export const dec = (v: number | null | undefined) => (v == null ? "—" : nDec.format(v));
export const pct = (v: number | null | undefined) => (v == null ? "—" : `${nDec.format(v).replace(",0", "")}%`);
export const km = (v: number | null | undefined) => (v == null ? "—" : `${nDec.format(v)} km`);

/** Variação em relação ao período anterior. `bomQuando` diz se subir é bom ou ruim (ex.: lacunas subindo é ruim). */
export function variacao(atual: number, anterior: number, bomQuando: "subir" | "descer" = "subir") {
  if (anterior === 0 && atual === 0) return { texto: "sem variação", tom: "neutro" as const, seta: "→" };
  if (anterior === 0) return { texto: "novo no período", tom: "neutro" as const, seta: "↑" };
  const p = ((atual - anterior) / anterior) * 100;
  if (Math.abs(p) < 1) return { texto: "estável", tom: "neutro" as const, seta: "→" };
  const subiu = p > 0;
  const bom = (bomQuando === "subir") === subiu;
  return {
    texto: `${subiu ? "+" : "−"}${nInt.format(Math.abs(p))}% vs. período anterior`,
    tom: (bom ? "bom" : "ruim") as "bom" | "ruim",
    seta: subiu ? "↑" : "↓",
  };
}

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function diaCurto(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

/** "há 3 horas", "há 2 dias" */
export function haQuanto(iso: string | null | undefined, agora = Date.now()): string {
  if (!iso) return "—";
  const seg = Math.round((new Date(iso).getTime() - agora) / 1000);
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const abs = Math.abs(seg);
  if (abs < 60) return "agora há pouco";
  if (abs < 3600) return rtf.format(Math.round(seg / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seg / 3600), "hour");
  return rtf.format(Math.round(seg / 86400), "day");
}

export const STATUS_CLIENTE: Record<string, { rotulo: string; tom: "ok" | "aviso" | "ruim" }> = {
  active: { rotulo: "Ativo", tom: "ok" },
  trial: { rotulo: "Em teste", tom: "aviso" },
  suspended: { rotulo: "Suspenso", tom: "ruim" },
  cancelled: { rotulo: "Cancelado", tom: "ruim" },
};

export const TIPO_REVENDEDOR: Record<string, string> = {
  loja_fisica: "Loja física",
  farmacia: "Farmácia",
  distribuidor: "Distribuidor",
  online: "Online",
  outro: "Outro",
};

export const ACAO_CLIQUE: Record<string, string> = {
  whatsapp: "WhatsApp",
  directions: "Como chegar",
  call: "Ligar",
  site: "Site",
};

export const STATUS_IMPORTACAO: Record<string, { rotulo: string; tom: "ok" | "aviso" | "ruim" }> = {
  success: { rotulo: "Concluída", tom: "ok" },
  partial: { rotulo: "Com pendências", tom: "aviso" },
  failed: { rotulo: "Falhou", tom: "ruim" },
};
