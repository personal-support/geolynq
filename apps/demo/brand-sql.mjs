/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
// Imprime o UPDATE do tema do widget do cliente `demo` a partir do brand.json (para colar no SQL Editor / conector).
//   node apps/demo/brand-sql.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const b = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "brand.json"), "utf8"));
const tema = {
  primary: b.colors.primary.toUpperCase(),
  radius: b.widget.radius,
  cardText: b.colors.ink.toUpperCase(),
  border: b.colors.line.toUpperCase(),
  imageRatio: b.widget.imageRatio,
  // campos extras do tema (só entram se estiverem no brand.json)
  ...Object.fromEntries(
    ["buttonRadius", "inputRadius", "buttonUppercase", "hoverShadow", "showCredit"].filter((k) => k in b.widget).map((k) => [k, b.widget[k]]),
  ),
  ...("inputBorder" in b.widget ? { inputBorder: b.widget.inputBorder.toUpperCase() } : {}),
};
console.log(`update public.tenants set widget_theme = '${JSON.stringify(tema)}'::jsonb where slug = 'demo';`);
