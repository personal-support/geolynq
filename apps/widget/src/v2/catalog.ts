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

/**
 * Texto digitado que NÃO deve ser gravado na telemetria: parece dado pessoal (telefone, CPF, e-mail, sequência longa de
 * números). Devolve o termo limpo, ou null para descartar. Decisão de privacidade: na dúvida, não grava.
 */
export function termForTelemetry(raw: string): string | null {
  const t = raw.replace(/\s+/g, " ").trim().slice(0, 60);
  if (t.length < 3) return null;
  if (/@/.test(t)) return null;
  if (/\d[\d .()/-]{5,}\d/.test(t)) return null; // 6+ dígitos seguidos (com separadores): telefone, CPF, CEP, cartão…
  return t.toLowerCase();
}
