import Link from "next/link";
import { PERIODOS } from "@/lib/data";

/** Seletor de período (7 / 30 / 90 dias) via ?dias= — sem JavaScript no navegador. */
export function PeriodTabs({ dias, base }: { dias: number; base: string }) {
  return (
    <nav aria-label="Período" className="inline-flex rounded-xl border border-line bg-card p-1 shadow-card">
      {PERIODOS.map((p) => (
        <Link
          key={p}
          href={`${base}?dias=${p}`}
          aria-current={p === dias ? "true" : undefined}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            p === dias ? "bg-ink text-white" : "text-ink-2 hover:bg-paper"
          }`}
        >
          {p} dias
        </Link>
      ))}
    </nav>
  );
}
