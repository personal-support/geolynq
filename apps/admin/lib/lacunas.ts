import type { Lacuna } from "@/lib/types";

export interface FiltroLacunas {
  uf: string;
  sku: string;
}

/** Lê ?uf= e ?produto= (SKU) sem confiar no que veio: só letras da UF e caracteres de SKU. */
export function lerFiltro(sp: Record<string, string | string[] | undefined>): FiltroLacunas {
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const uf = um(sp.uf).trim().toUpperCase();
  const sku = um(sp.produto).trim();
  return { uf: /^[A-Z]{2}$/.test(uf) ? uf : "", sku: /^[A-Za-z0-9._-]{1,40}$/.test(sku) ? sku : "" };
}

export function filtrarLacunas(itens: Lacuna[], f: FiltroLacunas): Lacuna[] {
  return itens.filter((l) => (!f.uf || l.uf === f.uf) && (!f.sku || l.sku === f.sku));
}
