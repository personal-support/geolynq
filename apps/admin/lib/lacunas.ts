/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
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
