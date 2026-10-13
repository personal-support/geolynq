/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
/**
 * CSV para o Excel em português: separador ";", UTF-8 com BOM, quebra de linha CRLF.
 * Células que começam com = + - @ (ou tab/CR) ganham um apóstrofo na frente: o Excel não as executa como fórmula
 * (nome de produto ou de cidade vem da planilha do cliente e não é de confiança).
 */
export function celulaCsv(valor: string | number | null | undefined): string {
  let t = valor == null ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function paraCsv(linhas: (string | number | null | undefined)[][]): string {
  return "﻿" + linhas.map((l) => l.map(celulaCsv).join(";")).join("\r\n") + "\r\n";
}
