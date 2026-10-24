/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
/**
 * Abaixo deste nº de buscas no período, percentuais e comparações oscilam demais para virar conclusão
 * (uma ou duas buscas a mais mudam o resultado). Valor de partida; ajustar quando houver volume real.
 */
export const LIMITE_BASE_PEQUENA = 30;

export type AvisoBase =
  | { tipo: "pequena"; buscas: number; dias: number }
  | { tipo: "comparacao"; anterior: number }
  | null;

/** Decide qual aviso de confiança mostrar. `buscas = 0` não gera aviso (a tela já explica que não há buscas). */
export function avisoDeBase(buscas: number, anterior: number, dias: number, comparar: boolean): AvisoBase {
  if (buscas > 0 && buscas < LIMITE_BASE_PEQUENA) return { tipo: "pequena", buscas, dias };
  if (comparar && buscas >= LIMITE_BASE_PEQUENA && anterior > 0 && anterior < LIMITE_BASE_PEQUENA) return { tipo: "comparacao", anterior };
  return null;
}
