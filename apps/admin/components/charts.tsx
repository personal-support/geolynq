import { diaCurto, num } from "@/lib/format";

/**
 * Tendência diária: buscas (tinta, com área) e cliques em revendedor (teal).
 * SVG puro, renderizado no servidor: sem biblioteca de gráfico, sem JS no navegador.
 */
export function TrendChart({ serie }: { serie: { dia: string; buscas: number; cliques: number }[] }) {
  const W = 760;
  const H = 320;
  const m = { t: 14, r: 12, b: 28, l: 34 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const max = Math.max(4, ...serie.map((d) => Math.max(d.buscas, d.cliques)));
  const teto = Math.ceil(max / 4) * 4;
  const x = (i: number) => m.l + (serie.length <= 1 ? iw / 2 : (i / (serie.length - 1)) * iw);
  const y = (v: number) => m.t + ih - (v / teto) * ih;
  const linha = (k: "buscas" | "cliques") => serie.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d[k]).toFixed(1)}`).join(" ");
  const area = `${linha("buscas")} L${x(serie.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(teto * f));
  const passoX = Math.max(1, Math.round(serie.length / 6));
  const total = serie.reduce((s, d) => s + d.buscas, 0);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Buscas e cliques por dia. Total de ${num(total)} buscas no período.`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" />
          <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-3)" fontFamily="var(--font-mono)">
            {t}
          </text>
        </g>
      ))}
      <path d={area} fill="var(--color-ink)" fillOpacity="0.07" />
      <path d={linha("buscas")} fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d={linha("cliques")} fill="none" stroke="var(--color-ok)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
      {serie.map((d, i) =>
        i % passoX === 0 || i === serie.length - 1 ? (
          <text key={d.dia} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink-3)" fontFamily="var(--font-mono)">
            {diaCurto(d.dia)}
          </text>
        ) : null,
      )}
      {serie.map((d, i) => (
        <rect key={`h${d.dia}`} x={x(i) - iw / serie.length / 2} y={m.t} width={iw / serie.length} height={ih} fill="transparent">
          <title>{`${diaCurto(d.dia)} · ${d.buscas} ${d.buscas === 1 ? "busca" : "buscas"} · ${d.cliques} ${d.cliques === 1 ? "clique" : "cliques"}`}</title>
        </rect>
      ))}
    </svg>
  );
}

export interface BarItem {
  rotulo: string;
  sub?: string;
  valor: number;
  /** parte do valor que é "lacuna" (desenhada em laranja) */
  lacuna?: number;
  extra?: string;
}

/** Barras horizontais em HTML (rótulo à esquerda, valor à direita). Parte laranja = buscas sem revendedor por perto. */
export function BarList({ itens, vazio, neutro = false }: { itens: BarItem[]; vazio?: string; neutro?: boolean }) {
  if (itens.length === 0) return <p className="px-5 py-6 text-sm text-ink-3">{vazio ?? "Sem dados no período."}</p>;
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="divide-y divide-line">
      {itens.map((i) => {
        const largura = (i.valor / max) * 100;
        const gapPct = i.lacuna && i.valor ? (i.lacuna / i.valor) * 100 : 0;
        return (
          <li key={i.rotulo + (i.sub ?? "")} className="px-5 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium">
                {i.rotulo}
                {i.sub ? <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">{i.sub}</span> : null}
              </p>
              <p className="shrink-0 font-display text-base font-semibold">{num(i.valor)}</p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="flex h-full" style={{ width: `${largura}%` }}>
                <div className={`h-full ${neutro ? "bg-ink-2" : "bg-ok"}`} style={{ width: `${100 - gapPct}%` }} />
                <div className="h-full bg-gap" style={{ width: `${gapPct}%` }} />
              </div>
            </div>
            {i.extra ? <p className="mt-1 text-xs text-ink-3">{i.extra}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
