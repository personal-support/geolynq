// Gera o site de amostra "Pódio" como HTML estático em apps/demo/dist. Sem dependências.
//   node apps/demo/build.mjs
// Marca "Pódio", produtos e revendedores FICTÍCIOS. O widget é o de verdade (tenant "demo").
// Para o visitante é um site de marca comum; o roteiro de apresentação fica em /apresentacao.html (sem link no site).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "dist");
const { categories, products } = JSON.parse(readFileSync(join(here, "products.json"), "utf8"));

const WIDGET_SRC = process.env.WIDGET_SRC ?? "https://widget.geolynq.personalsupport.tech/v2/embed.js";
const TENANT = "demo";
const COLOR = "#1F3FFF"; // cobalto da marca; o widget escolhe sozinho a cor legível do texto
const NAVY = "#0F1B2D";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const slug = (p) => p.sku.toLowerCase();
const href = (p) => `/produto/${slug(p)}.html`;
const catOf = (p) => categories[p.category];
const allergenText = (list) => (list.length ? `Contém ${list.join(", ")}.` : "Não contém os principais alérgenos declarados.");

// ---------- embalagens em SVG (estilo "render de produto": gradiente, brilho e sombra) ----------
// Cada forma recebe o produto e devolve um <svg>. Ids de gradiente levam o SKU para não colidir na mesma página.
function fitText(text, maxW, maxSize) {
  const size = Math.min(maxSize, Math.floor(maxW / (text.length * 0.66)));
  return { size, len: Math.min(maxW, Math.round(text.length * size * 0.66)) };
}
const line = (text, x, y, maxW, maxSize, fill, weight = 800, extra = "") => {
  const f = fitText(text, maxW, maxSize);
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Archivo,system-ui,sans-serif" font-weight="${weight}" font-size="${f.size}" fill="${fill}" textLength="${f.len}" lengthAdjust="spacingAndGlyphs" ${extra}>${esc(text)}</text>`;
};

function pack(p, size = "") {
  const c = catOf(p);
  const id = `g${slug(p).replace(/[^a-z0-9]/g, "")}${size}`;
  const label = `Embalagem de ${p.name}`;
  const brand = (x, y, fill) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-family="Archivo,system-ui,sans-serif" font-weight="800" font-size="13" letter-spacing="4" fill="${fill}">PÓDIO</text>`;

  const defs = `<defs>
    <linearGradient id="${id}b" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".22" stop-color="#fff" stop-opacity=".10"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient>
    <linearGradient id="${id}l" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".16"/><stop offset=".25" stop-color="#fff" stop-opacity=".0"/><stop offset=".8" stop-color="#000" stop-opacity=".0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
    <radialGradient id="${id}sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0F1B2D" stop-opacity=".28"/><stop offset="1" stop-color="#0F1B2D" stop-opacity="0"/></radialGradient>
  </defs>`;

  if (p.form === "bottle") {
    // frasco de cápsulas: tampa branca, rótulo branco
    return `<svg class="pack" viewBox="0 0 300 360" role="img" aria-label="${esc(label)}">${defs}
  <ellipse cx="150" cy="338" rx="92" ry="12" fill="url(#${id}sh)"/>
  <rect x="100" y="38" width="100" height="44" rx="9" fill="#F4F6FA"/>
  <rect x="100" y="38" width="100" height="44" rx="9" fill="url(#${id}b)"/>
  <rect x="106" y="82" width="88" height="10" fill="#D9DEE8"/>
  <rect x="80" y="90" width="140" height="240" rx="26" fill="${c.body}"/>
  <rect x="80" y="150" width="140" height="132" fill="#fff"/>
  <rect x="80" y="150" width="140" height="7" fill="${c.body}" opacity=".85"/>
  <rect x="80" y="90" width="140" height="240" rx="26" fill="url(#${id}b)"/>
  ${brand(150, 178, NAVY)}
  ${p.short.map((t, i) => line(t, 150, 212 + i * 26, 110, 22, NAVY)).join("")}
  <text x="150" y="268" text-anchor="middle" font-family="'Hanken Grotesk',system-ui,sans-serif" font-weight="600" font-size="12" fill="#5B6675">${esc(p.net)}</text>
</svg>`;
  }

  if (p.form === "box") {
    // caixa de barras: frente + faixa superior
    return `<svg class="pack" viewBox="0 0 300 360" role="img" aria-label="${esc(label)}">${defs}
  <ellipse cx="150" cy="330" rx="118" ry="12" fill="url(#${id}sh)"/>
  <path d="M46 112 L74 70 H226 L254 112 Z" fill="${c.body}"/>
  <path d="M46 112 L74 70 H226 L254 112 Z" fill="#fff" opacity=".22"/>
  <rect x="46" y="112" width="208" height="206" rx="6" fill="${c.body}"/>
  <rect x="46" y="150" width="208" height="130" fill="#fff"/>
  <rect x="46" y="112" width="208" height="206" rx="6" fill="url(#${id}l)"/>
  ${brand(150, 176, NAVY)}
  ${p.short.map((t, i) => line(t, 150, 214 + i * 30, 168, 26, NAVY)).join("")}
  <text x="150" y="268" text-anchor="middle" font-family="'Hanken Grotesk',system-ui,sans-serif" font-weight="600" font-size="12" fill="#5B6675">${esc(p.flavor)} · ${esc(p.net)}</text>
  <rect x="46" y="296" width="208" height="22" fill="${NAVY}" opacity=".9"/>
</svg>`;
  }

  if (p.form === "pouch") {
    // pacote (stand-up pouch)
    return `<svg class="pack" viewBox="0 0 300 360" role="img" aria-label="${esc(label)}">${defs}
  <ellipse cx="150" cy="338" rx="104" ry="12" fill="url(#${id}sh)"/>
  <path d="M62 44 H238 L252 80 Q262 200 246 318 Q150 336 54 318 Q38 200 48 80 Z" fill="${c.body}"/>
  <rect x="58" y="44" width="184" height="16" fill="#fff" opacity=".28"/>
  <path d="M52 122 Q150 108 248 122 L252 262 Q150 276 48 262 Z" fill="#fff"/>
  <path d="M62 44 H238 L252 80 Q262 200 246 318 Q150 336 54 318 Q38 200 48 80 Z" fill="url(#${id}b)"/>
  ${brand(150, 156, NAVY)}
  ${p.short.map((t, i) => line(t, 150, 194 + i * 30, 150, 28, NAVY)).join("")}
  <text x="150" y="246" text-anchor="middle" font-family="'Hanken Grotesk',system-ui,sans-serif" font-weight="600" font-size="12" fill="#5B6675">${esc(p.flavor)} · ${esc(p.net)}</text>
</svg>`;
  }

  // pote com tampa (pós)
  return `<svg class="pack" viewBox="0 0 300 360" role="img" aria-label="${esc(label)}">${defs}
  <ellipse cx="150" cy="340" rx="108" ry="12" fill="url(#${id}sh)"/>
  <rect x="70" y="22" width="160" height="50" rx="10" fill="${NAVY}"/>
  <rect x="70" y="22" width="160" height="50" rx="10" fill="url(#${id}b)"/>
  ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => `<rect x="${82 + i * 13.4}" y="30" width="2.2" height="34" rx="1" fill="#fff" opacity=".12"/>`).join("")}
  <rect x="78" y="72" width="144" height="10" fill="#1B2A40"/>
  <rect x="52" y="80" width="196" height="252" rx="24" fill="${c.body}"/>
  <rect x="52" y="124" width="196" height="156" fill="#fff"/>
  <rect x="52" y="124" width="196" height="8" fill="${NAVY}" opacity=".9"/>
  <rect x="52" y="80" width="196" height="252" rx="24" fill="url(#${id}b)"/>
  ${brand(150, 160, NAVY)}
  ${p.short.map((t, i) => line(t, 150, 200 + i * 31, 150, 29, NAVY)).join("")}
  <text x="150" y="262" text-anchor="middle" font-family="'Hanken Grotesk',system-ui,sans-serif" font-weight="600" font-size="12.5" fill="#5B6675">${esc(p.flavor)} · ${esc(p.net)}</text>
</svg>`;
}

// ---------- layout comum ----------
const nav = [
  ["/#produtos", "Produtos"],
  ["/sobre.html", "Sobre a Pódio"],
];

function layout({ title, description, body, noindexOnly = false }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="${NAVY}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Hanken+Grotesk:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/styles.css">
${noindexOnly ? "" : `<script src="${esc(WIDGET_SRC)}" defer></script>`}
</head>
<body>
<a class="skip" href="#conteudo">Ir para o conteúdo</a>
<header class="top">
  <div class="top__in">
    <a class="brand" href="/" aria-label="Pódio, página inicial">PÓDIO</a>
    <nav aria-label="Principal">
${nav.map(([h, t]) => `      <a href="${h}">${t}</a>`).join("\n")}
    </nav>
    <a class="btn btn--sm" href="/onde-encontrar.html">Onde encontrar</a>
  </div>
</header>
<main id="conteudo">
${body}
</main>
<footer class="foot">
  <div class="foot__in">
    <div>
      <p class="brand brand--foot">PÓDIO</p>
      <p class="foot__txt">Suplementos para quem treina de verdade. Fórmulas simples, rótulo claro.</p>
    </div>
    <nav aria-label="Rodapé">
      <a href="/#produtos">Produtos</a>
      <a href="/onde-encontrar.html">Onde encontrar</a>
      <a href="/sobre.html">Sobre a Pódio</a>
    </nav>
  </div>
  <div class="foot__fine">
    <p>© 2026 Pódio Nutrição Esportiva. Pódio é uma marca fictícia criada para a demonstração da GeoLynq; produtos, lojas e endereços não existem.</p>
    <p>Suplemento alimentar não substitui uma alimentação equilibrada. Consulte um profissional de saúde.</p>
  </div>
</footer>
</body>
</html>
`;
}

// Tema (cor, arredondamento, proporção da foto) vem do banco (tenants.widget_theme); a fonte é herdada do site. `scroll-offset` = altura do cabeçalho fixo.
const widget = (extra = "") => `<geolynq-widget tenant="${TENANT}" scroll-offset="76"${extra}></geolynq-widget>`;

const card = (p) => `<li><a class="card" href="${href(p)}">
  <span class="card__img" style="--tint:${catOf(p).tint}">${pack(p, "c")}</span>
  <span class="card__body">
    <span class="card__cat">${esc(catOf(p).label)}</span>
    <span class="card__name">${esc(p.name)}</span>
    <span class="card__go">Ver produto <span aria-hidden="true">→</span></span>
  </span>
</a></li>`;

// Faixa da home que leva à página "Onde encontrar" (o widget mora lá, não aqui).
const teaser = `<section class="where" aria-labelledby="onde-t">
  <div class="where__in where__in--solo">
    <div class="where__copy">
      <p class="eyebrow">Onde encontrar</p>
      <h2 id="onde-t">Encontre a Pódio perto de você.</h2>
      <p class="lead">Escolha o produto, informe o CEP e veja as lojas e farmácias mais próximas que vendem, com telefone, WhatsApp e rota.</p>
    </div>
    <div class="where__cta"><a class="btn" href="/onde-encontrar.html">Ver onde encontrar</a></div>
  </div>
</section>`;

// ---------- home ----------
function home() {
  const ordered = Object.keys(categories).flatMap((key) => products.filter((p) => p.category === key));
  const chips = Object.entries(categories)
    .map(([key, cat]) => `<a href="#cat-${key}">${esc(cat.label)}</a>`)
    .join("");
  const firstOf = new Set(Object.keys(categories).map((key) => products.find((p) => p.category === key)?.sku));
  const grid = ordered
    .map((p) => card(p).replace("<li>", firstOf.has(p.sku) ? `<li id="cat-${p.category}">` : "<li>"))
    .join("\n");

  const heroPacks = ["WPI-900", "CRE-300", "OM3-120"].map((sku) => products.find((p) => p.sku === sku)).filter(Boolean);

  const body = `<section class="hero">
  <div class="hero__in">
    <div class="hero__copy">
      <p class="eyebrow">Nutrição esportiva</p>
      <h1>Constância no treino começa no que está no pote.</h1>
      <p class="lead">Whey, creatina, aminoácidos e vitaminas com fórmulas simples e rótulo claro, para você treinar sem complicação.</p>
      <div class="hero__cta">
        <a class="btn" href="#produtos">Ver produtos</a>
        <a class="btn btn--ghost" href="/onde-encontrar.html">Onde encontrar</a>
      </div>
      <ul class="trust">
        <li>Fabricação nacional</li>
        <li>Lotes com laudo</li>
        <li>Mais de ${products.length} produtos</li>
      </ul>
    </div>
    <div class="hero__art" aria-hidden="true">
      ${heroPacks.map((p, i) => `<span class="hero__pack hero__pack--${i + 1}">${pack(p, "h")}</span>`).join("")}
    </div>
  </div>
</section>

<section class="catalog" id="produtos" aria-labelledby="produtos-t">
  <div class="section-head">
    <h2 id="produtos-t">Nossos produtos</h2>
    <p>Em cada produto, você vê as lojas mais próximas que vendem.</p>
  </div>
  <nav class="filters" aria-label="Ir para a categoria">${chips}</nav>
  <ul class="grid">${grid}</ul>
</section>

${teaser}`;

  return layout({
    title: "Pódio: suplementos para quem treina de verdade",
    description: "Pódio: whey, creatina, aminoácidos e vitaminas. Encontre a loja mais próxima que vende.",
    body,
  });
}

// ---------- página de produto ----------
function productPage(p) {
  const cat = catOf(p);
  const related = [...products.filter((q) => q.sku !== p.sku && q.category === p.category), ...products.filter((q) => q.category !== p.category)].slice(0, 4);
  const claims = p.claims.length ? `<ul class="chips">${p.claims.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : "";

  const body = `<nav class="crumbs" aria-label="Você está em">
  <a href="/">Início</a><span aria-hidden="true">/</span><a href="/#cat-${p.category}">${esc(cat.label)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(p.name)}</span>
</nav>

<article class="product">
  <div class="product__visual" style="--tint:${cat.tint}">${pack(p, "p")}</div>
  <div class="product__info">
    <p class="eyebrow">${esc(cat.label)}</p>
    <h1>${esc(p.name)}</h1>
    ${claims}
    <p class="lead">${esc(p.blurb)}</p>
    <dl class="facts">
      <div><dt>Conteúdo</dt><dd>${esc(p.net)}</dd></div>
      <div><dt>Sabor</dt><dd>${esc(p.flavor)}</dd></div>
      <div><dt>Código</dt><dd>${esc(p.sku)}</dd></div>
      <div><dt>Alérgicos</dt><dd>${esc(allergenText(p.allergens))}</dd></div>
    </dl>
    <div class="buybox" id="onde-encontrar">
      <h2>Encontre nas lojas</h2>
      <p>Informe o CEP e veja as lojas mais próximas que vendem este produto.</p>
      <div class="buybox__w">${widget(` product="${esc(p.sku)}"`)}</div>
    </div>
  </div>
</article>

<section class="catalog catalog--more" aria-labelledby="mais">
  <div class="section-head"><h2 id="mais">Veja também</h2></div>
  <ul class="grid grid--four">${related.map(card).join("\n")}</ul>
</section>`;

  return layout({ title: `${p.name}: Pódio`, description: p.blurb, body });
}

// ---------- página "Onde encontrar": cabeçalho e rodapé do cliente + o widget no corpo ----------
const ondeEncontrar = layout({
  title: "Onde encontrar: Pódio",
  description: "Encontre a loja ou farmácia mais próxima que vende os produtos Pódio.",
  body: `<section class="wpage">
  <div class="wpage__in">
    <p class="eyebrow">Onde encontrar</p>
    <h1>Encontre a Pódio perto de você.</h1>
    <p class="lead">Escolha o produto e veja as lojas e farmácias mais próximas que vendem.</p>
    ${widget()}
  </div>
</section>`,
});

// ---------- sobre ----------
const about = layout({
  title: "Sobre a Pódio",
  description: "Conheça a Pódio: suplementos com fórmulas simples e rótulo claro.",
  body: `<section class="page">
  <p class="eyebrow">Sobre a Pódio</p>
  <h1>Suplementos sem enrolação.</h1>
  <p class="lead">A Pódio nasceu para tirar o mistério do pote: fórmulas simples, quantidades claras no rótulo e o que o treino realmente pede.</p>
  <div class="values">
    <div><h3>Fórmulas simples</h3><p>Poucos ingredientes, nomes que você reconhece e informação nutricional completa em cada embalagem.</p></div>
    <div><h3>Controle de qualidade</h3><p>Cada lote é analisado antes de sair da fábrica, com laudo disponível para quem quiser conferir.</p></div>
    <div><h3>Perto de você</h3><p>Vendemos pelas melhores lojas e farmácias do país. Use o <a href="/onde-encontrar.html">Onde encontrar</a> e ache a mais próxima.</p></div>
  </div>
</section>`,
});

const notFound = layout({
  title: "Página não encontrada: Pódio",
  description: "Página não encontrada.",
  body: `<section class="page"><h1>Página não encontrada.</h1><p class="lead">O endereço não existe. <a href="/">Volte para o início</a>.</p></section>`,
});

// ---------- página de apresentação (não linkada no site; só para quem apresenta) ----------
const snippet = `&lt;script src="${esc(WIDGET_SRC)}" defer&gt;&lt;/script&gt;
&lt;geolynq-widget tenant="${TENANT}" color="${COLOR}"&gt;&lt;/geolynq-widget&gt;`;
const presenter = layout({
  title: "Roteiro de apresentação (uso interno)",
  description: "Roteiro interno da demonstração GeoLynq.",
  noindexOnly: true,
  body: `<section class="page page--wide">
  <p class="eyebrow">Uso interno · não divulgue este endereço</p>
  <h1>Roteiro da apresentação</h1>
  <p class="lead">Duas partes. Na primeira, o cliente do fabricante usa o site. Na segunda, a equipe comercial vê os dados na plataforma.</p>

  <h2>Parte 1 — o site (o consumidor)</h2>
  <p>Abra o site como se fosse o do cliente: <a href="/">página inicial</a> e, no botão <b>Onde encontrar</b>, a <a href="/onde-encontrar.html">página Onde encontrar</a> (cabeçalho e rodapé são do cliente; no meio, o widget). Nada aqui diz "demonstração" além do rodapé.</p>
  <ol class="steps">
    <li>Na página <b>Onde encontrar</b>, digite <b>whey</b> no campo de busca: a grade filtra na hora. Clique em <b>Onde encontrar</b> no produto, informe o CEP <code>11060-001</code> (Santos) e veja as lojas da mais próxima à mais distante.</li>
    <li>Volte e troque o CEP para <code>01310-100</code> (Av. Paulista): a lista passa a mostrar lojas de São Paulo. Também há <b>Usar minha localização</b> e <b>Ver lista de revendedores</b>.</li>
    <li>Busque <b>glutamina</b> com o CEP de Santos: só há lojas em São Paulo, a cerca de 55 km, dentro do raio de 100 km.</li>
    <li>Escolha <b>hipercalórico</b> com o CEP de Santos: nenhuma loja vende por perto. O widget avisa o visitante e a busca fica registrada como lacuna de cobertura.</li>
    <li>No botão <b>Lista de revendedores</b> (início da página), escolha o estado <b>SP</b>, depois a cidade; use <b>Ordenar pelos mais próximos de mim</b>.</li>
    <li>Abra um produto (ex.: Whey Isolado): o widget já vem com o produto escolhido, falta só o CEP.</li>
    <li>Teste também sem acento: <b>proteina</b>, <b>creatina</b>. Digitar algo que não existe (ex.: <b>ashwagandha</b>) vira "Procuraram e você não tem" no painel.</li>
  </ol>
  <p>Cada busca e cada clique em revendedor ficam registrados. É isso que a Parte 2 mostra.</p>

  <h2>Parte 2 — a plataforma (a equipe comercial)</h2>
  <p>Abra o painel em <b>painel.geolynq.personalsupport.tech</b> com o seu acesso (não está nesta página) e, no seletor de cliente da barra lateral, escolha <b>GeoLynq Demo</b>: é a mesma marca Pódio do site.</p>
  <ol class="steps">
    <li><b>Ao vivo:</b> faça uma busca no site (parte 1) e, no painel, role até <b>Últimas buscas e contatos</b> e clique em <b>Atualizar</b>: a sua busca aparece com produto, cidade e quantas lojas há por perto.</li>
    <li><b>Visão geral:</b> a frase do período ("N buscas ficaram sem revendedor por perto"), o mapa de cobertura e as maiores lacunas.</li>
    <li><b>Quem gera contato:</b> quais revendedores recebem clique (WhatsApp, ligação, rota, site) e quais lojas físicas estão paradas.</li>
    <li><b>Lacunas:</b> produto × cidade sem revendedor a 100 km. É a lista de onde o fabricante perde venda.</li>
    <li><b>Rede:</b> revendedores, o que cada um vende, os contatos de cada um e quem está fora da busca por distância.</li>
    <li><b>Catálogo e Importações:</b> como o cliente atualiza os dados (planilha) e o que corrigir quando algo falha.</li>
  </ol>

  <h2>Como o webmaster instala</h2>
  <pre class="code"><code>${snippet}</code></pre>
  <p>Duas linhas, em qualquer site ou CMS, na página "Onde encontrar" do cliente. As cores e o estilo vêm do cadastro do cliente (só a GeoLynq altera); a fonte é a do próprio site. Numa página de produto, acrescente <code>product="WPC-900"</code> para o widget abrir já no item.</p>
</section>`,
});

// ---------- escrita ----------
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "produto"), { recursive: true });
writeFileSync(join(out, "index.html"), home());
for (const p of products) writeFileSync(join(out, "produto", `${slug(p)}.html`), productPage(p));
writeFileSync(join(out, "sobre.html"), about);
writeFileSync(join(out, "onde-encontrar.html"), ondeEncontrar);
// Fotos dos produtos (usadas pelo widget: products.image_url aponta para estes arquivos).
mkdirSync(join(out, "img"), { recursive: true });
for (const p of products) writeFileSync(join(out, "img", `${slug(p)}.svg`), pack(p, "i").replace("<svg class=\"pack\"", "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"pack\""));
writeFileSync(join(out, "apresentacao.html"), presenter);
writeFileSync(join(out, "404.html"), notFound);
writeFileSync(join(out, "robots.txt"), "User-agent: *\nDisallow: /\n");
cpSync(join(here, "styles.css"), join(out, "styles.css"));
writeFileSync(
  join(out, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0F1B2D"/><path d="M9 24V8h8a5 5 0 0 1 0 10h-3" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="9" r="2.4" fill="#F2551C"/></svg>\n`,
);
console.log(`demo: ${products.length + 5} páginas e ${products.length} imagens em ${out}`);
