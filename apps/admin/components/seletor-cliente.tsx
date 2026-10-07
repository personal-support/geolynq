"use client";

import { trocarCliente } from "@/app/dashboard/actions";

export interface OpcaoCliente {
  slug: string;
  nome: string;
}

/** Só aparece para quem tem mais de um cliente. Troca ao escolher; o botão cobre o caso sem JavaScript. */
export function SeletorCliente({ clientes, atual, escuro = true }: { clientes: OpcaoCliente[]; atual: string; escuro?: boolean }) {
  if (clientes.length < 2) return null;
  return (
    <form action={trocarCliente} className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`cliente-${escuro ? "d" : "m"}`}>
        Cliente em exibição
      </label>
      <select
        id={`cliente-${escuro ? "d" : "m"}`}
        name="cliente"
        defaultValue={atual}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`w-full min-w-0 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium ${
          escuro ? "border-white/20 bg-white/10 text-white" : "border-line-2 bg-white text-ink"
        }`}
      >
        {clientes.map((c) => (
          <option key={c.slug} value={c.slug} className="text-ink">
            {c.nome}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="rounded-lg bg-white px-2.5 py-1.5 text-[13px] font-semibold text-ink">
          Ver
        </button>
      </noscript>
    </form>
  );
}
