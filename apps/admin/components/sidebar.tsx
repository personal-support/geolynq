"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { RadarMark } from "@/components/radar-mark";
import { SeletorCliente, type OpcaoCliente } from "@/components/seletor-cliente";
import { Pill } from "@/components/ui";
import { STATUS_CLIENTE } from "@/lib/format";

const ICONES: Record<string, string> = {
  visao: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  lacunas: "M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 100 8 4 4 0 000-8z",
  rede: "M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  catalogo: "M4 7l8-4 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4",
  importacoes: "M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3",
  widget: "M4 5h16v11H4zM8 20h8M12 16v4",
};

const ITENS = [
  { href: "/dashboard", rotulo: "Visão geral", icone: "visao", exato: true },
  { href: "/dashboard/lacunas", rotulo: "Lacunas", icone: "lacunas" },
  { href: "/dashboard/rede", rotulo: "Rede de revendedores", icone: "rede" },
  { href: "/dashboard/catalogo", rotulo: "Catálogo", icone: "catalogo" },
  { href: "/dashboard/importacoes", rotulo: "Importações", icone: "importacoes" },
  { href: "/dashboard/widget", rotulo: "Widget no site", icone: "widget" },
] as const;

function Icone({ nome }: { nome: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONES[nome]} />
    </svg>
  );
}

export function Sidebar({
  cliente,
  slug,
  status,
  email,
  clientes,
}: {
  cliente: string;
  slug: string;
  status: string;
  email: string | null;
  clientes: OpcaoCliente[];
}) {
  const pathname = usePathname();
  const ativo = (href: string, exato?: boolean) => (exato ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  const st = STATUS_CLIENTE[status] ?? { rotulo: status, tom: "aviso" as const };

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col bg-ink px-4 py-6 text-white lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <RadarMark size={30} className="text-white" />
          <div className="leading-none">
            <p className="font-display text-xl font-semibold tracking-tight">GeoLynq</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/55">Radar de cobertura</p>
          </div>
        </div>

        <div className="mt-8 rounded-xl bg-white/[0.07] p-3.5">
          <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">Cliente</p>
          <p className="mt-1 line-clamp-2 break-words font-display text-[17px] font-semibold leading-tight" title={cliente}>
            {cliente}
          </p>
          <div className="mt-2">
            <Pill tom={st.tom}>{st.rotulo}</Pill>
          </div>
          {clientes.length > 1 ? (
            <div className="mt-3">
              <SeletorCliente clientes={clientes} atual={slug} />
            </div>
          ) : null}
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-0.5" aria-label="Seções do painel">
          {ITENS.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              aria-current={ativo(i.href, "exato" in i ? i.exato : false) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14.5px] font-medium transition-colors ${
                ativo(i.href, "exato" in i ? i.exato : false)
                  ? "bg-white text-ink"
                  : "text-white/75 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              <Icone nome={i.icone} />
              {i.rotulo}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 pt-4">
          <p className="truncate px-2 text-xs text-white/55" title={email ?? ""}>
            {email}
          </p>
          <form action={signOut}>
            <button type="submit" className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-white/75 hover:bg-white/[0.08] hover:text-white">
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Celular e tablet */}
      <header className="sticky top-0 z-30 bg-ink text-white lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <RadarMark size={26} className="shrink-0 text-white" />
            <div className="min-w-0 leading-tight">
              <p className="font-display text-base font-semibold">GeoLynq</p>
              <p className="truncate text-xs text-white/60">{cliente}</p>
            </div>
          </div>
          <form action={signOut}>
            <button type="submit" className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10">
              Sair
            </button>
          </form>
        </div>
        {clientes.length > 1 ? (
          <div className="px-4 pb-2.5">
            <SeletorCliente clientes={clientes} atual={slug} escuro={false} />
          </div>
        ) : null}
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2.5" aria-label="Seções do painel">
          {ITENS.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              aria-current={ativo(i.href, "exato" in i ? i.exato : false) ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
                ativo(i.href, "exato" in i ? i.exato : false) ? "bg-white text-ink" : "bg-white/10 text-white/80"
              }`}
            >
              {i.rotulo}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
