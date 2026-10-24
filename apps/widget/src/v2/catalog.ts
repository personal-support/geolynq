/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
import type { ProductCard } from "./api2";

/** Sem acento e sem maiúscula, igual ao banco (norm_busca): "PROTEÍNA" casa com "proteina". */
export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Filtro local da grade (catálogo completo já carregado): nome, SKU ou categoria. */
export function filterProducts(list: ReadonlyArray<ProductCard>, term: string): ProductCard[] {
  const t = normalize(term);
  if (!t) return [...list];
  return list.filter((p) => normalize(`${p.name} ${p.sku} ${p.category ?? ""}`).includes(t));
}

/** Iniciais para o quadro de foto quando o produto não tem imagem (ou ela falhou): "Whey Protein Isolado" -> "WP". */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "?").concat(words[1]?.[0] ?? "").toUpperCase();
}

/** Regra de privacidade do texto digitado: vive em ../util (compartilhada com o widget v1). */
export { termForTelemetry } from "../util";
