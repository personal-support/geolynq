import type { ReactNode } from "react";

type Tom = "ok" | "aviso" | "ruim" | "neutro";

const PILL: Record<Tom, string> = {
  ok: "bg-ok-soft text-ok-deep",
  aviso: "bg-warn-soft text-warn",
  ruim: "bg-gap-soft text-gap-deep",
  neutro: "bg-line text-ink-2",
};

export function Pill({ tom = "neutro", children }: { tom?: Tom; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[tom]}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <Tag className={`min-w-0 rounded-2xl border border-line bg-card shadow-card ${className}`}>{children}</Tag>;
}

export function CardHeader({
  titulo,
  dica,
  direita,
}: {
  titulo: string;
  dica?: string;
  direita?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-5">
      <div>
        <h2 className="text-[17px] font-semibold leading-tight">{titulo}</h2>
        {dica ? <p className="mt-1 max-w-prose text-[13px] leading-snug text-ink-3">{dica}</p> : null}
      </div>
      {direita}
    </header>
  );
}

export function PageHeader({
  titulo,
  subtitulo,
  direita,
}: {
  titulo: string;
  subtitulo?: string;
  direita?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold leading-none sm:text-[34px]">{titulo}</h1>
        {subtitulo ? <p className="mt-2 max-w-2xl text-[15px] text-ink-2">{subtitulo}</p> : null}
      </div>
      {direita}
    </div>
  );
}

export function Empty({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="font-display text-lg font-semibold">{titulo}</p>
      {children ? <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-3">{children}</p> : null}
    </div>
  );
}

/** Variação vs. período anterior. Cor segue o significado (bom = teal, ruim = laranja), não a direção da seta. */
export function Delta({ v }: { v: { texto: string; tom: "bom" | "ruim" | "neutro"; seta: string } }) {
  const cor = v.tom === "bom" ? "text-ok-deep" : v.tom === "ruim" ? "text-gap-deep" : "text-ink-3";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cor}`}>
      <span aria-hidden>{v.seta}</span>
      {v.texto}
    </span>
  );
}

export function Kpi({
  rotulo,
  valor,
  detalhe,
  rodape,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <Card as="article" className="p-4 sm:p-5">
      <p className="text-[13px] font-medium text-ink-3">{rotulo}</p>
      <p className="mt-1.5 font-display text-[30px] font-semibold leading-none tracking-tight sm:text-[38px]">{valor}</p>
      {detalhe ? <p className="mt-2 text-[13px] text-ink-2">{detalhe}</p> : null}
      {rodape ? <div className="mt-2">{rodape}</div> : null}
    </Card>
  );
}

export const TH = "px-5 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-3";
export const TD = "px-5 py-3 align-middle";
