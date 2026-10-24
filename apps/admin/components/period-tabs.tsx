/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
import Link from "next/link";
import { BOTOES, MENU, type Periodo } from "@/lib/periodo";

/** Hoje em Brasília (AAAA-MM-DD), limite máximo dos campos de data. O Brasil está em UTC−3 o ano todo. */
const hojeBrasilia = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

/** `dd/mm` de um AAAA-MM-DD. */
const curto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/**
 * Seletor de período, sem JavaScript no navegador (tudo é link ou formulário GET):
 * os três botões de sempre (7, 30 e 90 dias) e o menu "Outros períodos" (hoje, semana, mês, ano e datas personalizadas).
 * O período vai na URL (?p=mes, ?p=personalizado&de=…&ate=…), então o endereço pode ser salvo ou compartilhado.
 */
export function PeriodTabs({ periodo, base }: { periodo: Periodo; base: string }) {
  const noMenu = periodo.chave === "personalizado" || MENU.some((x) => x.chave === periodo.chave);
  const [, deIso, ateIso] = periodo.chave === "personalizado" ? periodo.id.split(":") : [null, "", ""];
  const rotuloMenu = periodo.chave === "personalizado" ? (deIso === ateIso ? curto(deIso) : `${curto(deIso)} a ${curto(ateIso)}`) : periodo.rotulo.replace(/ \(.*\)$/, "");
  const classeBotao = (ativo: boolean) =>
    `rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${ativo ? "bg-ink text-white" : "text-ink-2 hover:bg-paper"}`;

  return (
    <div className="relative flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <nav aria-label="Período" className="inline-flex rounded-xl border border-line bg-card p-1 shadow-card">
        {BOTOES.map((b) => (
          <Link key={b.chave} href={`${base}?p=${b.chave}`} aria-current={b.chave === periodo.chave ? "true" : undefined} className={classeBotao(b.chave === periodo.chave)}>
            {b.rotulo}
          </Link>
        ))}
      </nav>

      {/* key = período: ao escolher um período o Next navega sem recarregar e preservaria o menu aberto; com a key ele é recriado, fechado */}
      <details key={periodo.id}>
        <summary
          className={`cursor-pointer list-none rounded-xl border px-3.5 py-2 text-sm font-semibold shadow-card transition-colors [&::-webkit-details-marker]:hidden ${
            noMenu ? "border-ink bg-ink text-white" : "border-line bg-card text-ink-2 hover:bg-paper"
          }`}
        >
          {noMenu ? rotuloMenu : "Outros períodos"}
          <span aria-hidden className="ml-1.5 text-xs">▾</span>
        </summary>
        <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-line bg-card p-3 shadow-card sm:left-auto sm:right-0 sm:w-72">
          <ul>
            {MENU.map((x) => (
              <li key={x.chave}>
                <Link
                  href={`${base}?p=${x.chave}`}
                  aria-current={x.chave === periodo.chave ? "true" : undefined}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium ${x.chave === periodo.chave ? "bg-ink text-white" : "text-ink-2 hover:bg-paper"}`}
                >
                  {x.rotulo}
                </Link>
              </li>
            ))}
          </ul>
          <form method="get" action={base} className="mt-2 border-t border-line pt-3">
            <input type="hidden" name="p" value="personalizado" />
            <p className="mb-2 px-1 text-[13px] font-semibold text-ink">Datas personalizadas</p>
            <div className="flex gap-2">
              <label className="min-w-0 flex-1 text-xs font-medium text-ink-2">
                De
                <input type="date" name="de" required min="2020-01-01" max={hojeBrasilia()} defaultValue={deIso || undefined} className="mt-1 block w-full rounded-lg border border-line-2 bg-white px-2 py-1.5 text-sm font-normal text-ink" />
              </label>
              <label className="min-w-0 flex-1 text-xs font-medium text-ink-2">
                Até
                <input type="date" name="ate" required min="2020-01-01" max={hojeBrasilia()} defaultValue={ateIso || undefined} className="mt-1 block w-full rounded-lg border border-line-2 bg-white px-2 py-1.5 text-sm font-normal text-ink" />
              </label>
            </div>
            <button type="submit" className="mt-3 w-full rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
              Aplicar
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
