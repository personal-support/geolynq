// Gera o site de amostra (Fase 4.1) como HTML estático em apps/demo/dist. Sem dependências.
//   node apps/demo/build.mjs
// Marca "Pódio", produtos e revendedores FICTÍCIOS. O widget é o de verdade (tenant "demo").
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "dist");
const { categories, products } = JSON.parse(readFileSync(join(here, "products.json"), "utf8"));

const WIDGET_SRC = process.env.WIDGET_SRC ?? "https://widget.geolynq.personalsupport.tech/v1/embed.js";
const TENANT = "demo";
const COLOR = "#1F3FFF"; // cobalto da marca; o widget escolhe sozinho a cor legível do texto

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const slug = (p) => p.sku.toLowerCase();
const href = (p) => `/produto/${slug(p)}.html`;
const catOf = (p) => categories[p.category];
const allergenText = (list) => (list.length ? `Alérgicos: contém ${list.join(", ")}.` : "Alérgicos: não contém os principais alérgenos declarados.");

// ---------- pote em SVG (cor por categoria, rótulo com o nome do produto) ----------
function jar(p) {
  const c = catOf(p);
  const labelBg = c.ink;
  const labelInk = c.ink === "#FFFFFF" ? "#101820" : "#FFFFFF";
  const fit = (line) => {
    const size = Math.min(26, Math.floor(150 / (line.length * 0.7)));
    return { size, len: Math.min(150, Math.round(line.length * size * 0.7)) };
  };
  const lines = p.short
    .map((line, i) => {
      const f = fit(line);
      return `<text x="120" y="${176 + i * 30}" text-anchor="middle" font-family="Archivo,system-ui,sans-serif" font-weight="800" font-size="${f.size}" fill="${labelInk}" textLength="${f.len}" lengthAdjust="spacingAndGlyphs">${esc(line)}</text>`;
    })
    .join("");
  return `<svg class="jar" viewBox="0 0 240 290" role="img" aria-label="Pote de ${esc(p.name)}">
  <rect x="64" y="12" width="112" height="36" rx="5" fill="#101820"/>
  <rect x="72" y="48" width="96" height="10" fill="#101820"/>
  <rect x="30" y="58" width="180" height="218" rx="16" fill="${c.jar}" stroke="#101820" stroke-width="3"/>
  <rect x="30" y="118" width="180" height="108" fill="${labelBg}" stroke="#101820" stroke-width="3"/>
  <rect x="30" y="118" width="180" height="8" fill="#FFD43B" stroke="#101820" stroke-width="3"/>
  <text x="120" y="150" text-anchor="middle" font-family="'IBM Plex Mono',ui-monospace,monospace" font-weight="500" font-size="11" letter-spacing="3" fill="${labelInk}">PÓDIO</text>
  ${lines}
</svg>`;
}

// ---------- layout comum ----------
function layout({ title, description, body }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Hanken+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/styles.css">
<script src="${esc(WIDGET_SRC)}" defer></script>
</head>
<body>
<a class="skip" href="#conteudo">Ir para o conteúdo</a>
<div class="ribbon" role="note"><strong>Site de demonstração</strong> da GeoLynq. Marca, produtos e lojas são fictícios.</div>
<header class="top">
  <a class="brand" href="/" aria-label="Pódio, página inicial">PÓDIO</a>
  <nav aria-label="Principal">
    <a href="/#catalogo">Catálogo</a>
    <a href="/#onde-encontrar">Onde encontrar</a>
    <a href="/#roteiro">Roteiro da demo</a>
  </nav>
</header>
<main id="conteudo">
${body}
</main>
<footer class="foot">
  <p>Site de demonstração da GeoLynq. Marca, produtos e revendedores são fictícios e não há venda nem entrega.</p>
  <p>Suplemento alimentar não substitui uma alimentação equilibrada. Consulte um profissional de saúde.</p>
</footer>
</body>
</html>
`;
}

const widget = (extra = "") => `<geolynq-widget tenant="${TENANT}" color="${COLOR}"${extra}></geolynq-widget>`;

const card = (p) => `<li><a class="card" href="${href(p)}">
  <span class="card__jar" style="--tint:${catOf(p).jar === "#FFFFFF" ? "#E3E8E0" : "#EDF0EA"}">${jar(p)}</span>
  <span class="card__name">${esc(p.name)}</span>
  <span class="card__meta"><span class="mono">${esc(p.sku)}</span><span class="card__go">Onde encontrar →</span></span>
</a></li>`;

// ---------- home ----------
function home() {
  const sections = Object.entries(categories)
    .map(([key, cat]) => {
      const items = products.filter((p) => p.category === key);
      if (!items.length) return "";
      return `<section class="cat" aria-labelledby="cat-${key}">
  <div class="cat__head"><h3 id="cat-${key}">${esc(cat.label)}</h3><span class="mono">${items.length} ${items.length === 1 ? "produto" : "produtos"}</span></div>
  <ul class="grid">${items.map(card).join("\n")}</ul>
</section>`;
    })
    .join("\n");

  const snippet = `&lt;script src="${esc(WIDGET_SRC)}" defer&gt;&lt;/script&gt;
&lt;geolynq-widget tenant="${TENANT}" color="${COLOR}"&gt;&lt;/geolynq-widget&gt;`;

  const body = `<section class="hero" id="onde-encontrar">
  <div class="hero__copy">
    <h1>Ache onde comprar, <mark>perto</mark> de você.</h1>
    <p class="lead">Digite o produto e o seu CEP. Mostramos as lojas e farmácias que vendem, da mais próxima à mais distante.</p>
    <p class="hint mono">Experimente: whey, creatina, glutamina ou hipercalórico.<br>CEPs de teste: 11060-001 (Santos) e 01310-100 (São Paulo).</p>
  </div>
  <div class="frame">
    <div class="frame__bar mono"><span>Widget GeoLynq</span><span>Busca ao vivo</span></div>
    <div class="frame__body">${widget()}</div>
    <p class="frame__note mono">Este é o widget GeoLynq funcionando de verdade, com o catálogo de demonstração.</p>
  </div>
</section>

<section class="catalog" id="catalogo" aria-labelledby="catalogo-titulo">
  <div class="section-head">
    <h2 id="catalogo-titulo">Catálogo</h2>
    <p>${products.length} produtos. Em cada página, o widget já vem com o produto escolhido: falta só o CEP.</p>
  </div>
${sections}
</section>

<section class="script" id="roteiro" aria-labelledby="roteiro-titulo">
  <div class="script__inner">
    <div>
      <h2 id="roteiro-titulo">Roteiro da demonstração</h2>
      <p class="script__lead">Para quem apresenta: cinco passos, cerca de dois minutos.</p>
      <ol class="steps">
        <li>Busque <b>whey</b> e informe o CEP <b class="mono">11060-001</b> (Santos). O widget lista as lojas da região, da mais próxima à mais distante.</li>
        <li>Volte, troque o CEP para <b class="mono">01310-100</b> (Av. Paulista). A lista passa a mostrar lojas de São Paulo.</li>
        <li>Busque <b>glutamina</b> com o CEP de Santos. Só há lojas em São Paulo, a cerca de 55 km: está dentro do raio de 100 km.</li>
        <li>Busque <b>hipercalórico</b>. Nenhuma loja vende esse produto: o widget avisa o visitante e registra a busca como lacuna de cobertura.</li>
        <li>Cada busca e cada clique em revendedor ficam registrados, e são a base dos relatórios para o fabricante. Essas buscas de teste também entram.</li>
      </ol>
    </div>
    <div class="install">
      <h3>Como o webmaster instala</h3>
      <pre class="code mono"><code>${snippet}</code></pre>
      <p>Duas linhas, em qualquer site ou CMS. Numa página de produto, acrescente <code class="mono">product="WPC-900"</code> para o widget abrir já no item.</p>
    </div>
  </div>
</section>`;

  return layout({
    title: "Pódio: ache onde comprar perto de você (demonstração)",
    description: "Site de demonstração do widget GeoLynq Onde encontrar. Marca e produtos fictícios.",
    body,
  });
}

// ---------- página de produto ----------
function productPage(p) {
  const cat = catOf(p);
  const related = [...products.filter((q) => q.sku !== p.sku && q.category === p.category), ...products.filter((q) => q.category !== p.category)].slice(0, 4);
  const claims = p.claims.length ? `<ul class="chips">${p.claims.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : "";

  const body = `<nav class="crumbs mono" aria-label="Você está em">
  <a href="/">Início</a> / <a href="/#cat-${p.category}">${esc(cat.label)}</a> / <span aria-current="page">${esc(p.sku)}</span>
</nav>

<article class="product">
  <div class="product__visual" style="--tint:${cat.jar === "#FFFFFF" ? "#E3E8E0" : "#EDF0EA"}">${jar(p)}</div>
  <div class="product__info">
    <p class="mono product__sku">${esc(p.sku)}</p>
    <h1>${esc(p.name)}</h1>
    ${claims}
    <p class="lead">${esc(p.blurb)}</p>
    <p class="allergens mono">${esc(allergenText(p.allergens))}</p>
  </div>
  <div class="frame product__where" id="onde-encontrar">
    <div class="frame__bar mono"><span>Widget GeoLynq</span><span>${esc(p.sku)}</span></div>
    <div class="frame__body">${widget(` product="${esc(p.sku)}"`)}</div>
    <p class="frame__note mono">O produto já vem escolhido. Informe o CEP para ver as lojas mais próximas.</p>
  </div>
</article>

<section class="catalog catalog--more" aria-labelledby="mais">
  <div class="section-head"><h2 id="mais">Veja também</h2></div>
  <ul class="grid">${related.map(card).join("\n")}</ul>
</section>`;

  return layout({ title: `${p.name}: Pódio (demonstração)`, description: p.blurb, body });
}

const notFound = layout({
  title: "Página não encontrada: Pódio (demonstração)",
  description: "Página não encontrada.",
  body: `<section class="hero hero--solo"><div class="hero__copy"><h1>Página não encontrada.</h1><p class="lead">O endereço não existe nesta demonstração. <a href="/">Volte ao catálogo</a>.</p></div></section>`,
});

// ---------- escrita ----------
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "produto"), { recursive: true });
writeFileSync(join(out, "index.html"), home());
for (const p of products) writeFileSync(join(out, "produto", `${slug(p)}.html`), productPage(p));
writeFileSync(join(out, "404.html"), notFound);
writeFileSync(join(out, "robots.txt"), "User-agent: *\nDisallow: /\n");
cpSync(join(here, "styles.css"), join(out, "styles.css"));
writeFileSync(
  join(out, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#1F3FFF"/><rect y="22" width="32" height="5" fill="#FFD43B"/><text x="16" y="19" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="17" fill="#fff">P</text></svg>\n`,
);
console.log(`demo: ${products.length + 2} páginas em ${out}`);
