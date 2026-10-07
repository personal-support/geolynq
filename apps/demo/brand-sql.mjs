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
};
console.log(`update public.tenants set widget_theme = '${JSON.stringify(tema)}'::jsonb where slug = 'demo';`);
