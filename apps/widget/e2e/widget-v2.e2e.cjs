const { createRequire } = require('module'); const { execSync } = require('child_process');
const req = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = req('playwright'); const fs = require('fs');
// E2E do widget v2 em Chromium real: grade de produtos, filtro sem acento, "Onde encontrar" com 3 opções, lista de revendedores,
// tema por cliente, fotos e privacidade da telemetria. Supabase/ViaCEP/Nominatim/imagens simulados via page.route.
// Uso: npm run build -w @geolynq/widget && npm run e2e:v2 -w @geolynq/widget
// O build PRECISA ter VITE_SUPABASE_URL=https://vshlsisnuaugeceafipt.supabase.co (a mesma de SB abaixo) e VITE_SUPABASE_ANON_KEY.
const BUNDLE = require('path').join(__dirname, '..', 'dist', 'v2', 'embed.js');
const SB = 'https://vshlsisnuaugeceafipt.supabase.co';
const T = { demo: 'tenant-demo', herda: 'tenant-herda', grande: 'tenant-grande' };
const events = [], calls = [];
const results = [];
const SHOTS = process.env.E2E_SHOTS || '';
const shot = async (p, n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: SHOTS + '/' + n + '.png', fullPage: true }); } };
const check = (n, ok, x = '') => { results.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  -> ' + x : '')); };
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// catálogo do "demo": 30 produtos (24 por página). p-2 tem foto quebrada; p-1 tem foto boa; o resto sem foto.
const CATALOG = Array.from({ length: 30 }, (_, i) => ({
  id: 'p-' + (i + 1), sku: 'SKU-' + String(i + 1).padStart(3, '0'),
  name: i === 0 ? 'Whey Protein Isolado 900g' : i === 1 ? 'Creatina Monohidratada 300g' : i === 2 ? 'Proteína Vegetal 500g' : i === 3 ? 'Ômega 3 120 cápsulas' : 'Produto Teste ' + (i + 1),
  category: i === 0 || i === 2 ? 'Proteínas' : i === 1 ? 'Energia' : 'Outros',
  image_url: i === 0 ? 'https://img.test/boa.png' : i === 1 ? 'https://img.test/quebrada.png' : null,
}));
const BIG = Array.from({ length: 800 }, (_, i) => ({ id: 'g-' + i, sku: 'G-' + i, name: (i % 40 === 0 ? 'Whey ' : 'Item ') + i, category: 'Cat', image_url: null }));
const SP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) => ({ reseller_id: 'r-sp-' + n, name: 'Loja SP ' + String(n).padStart(2, '0'), type: 'loja_fisica', phone: '(11) 3222-' + (1000 + n), whatsapp: '(11) 99999-' + (1000 + n), website: null, street: 'Rua ' + n, number: String(n), neighborhood: 'Centro', city: n <= 8 ? 'São Paulo' : 'Santos', state: 'SP', latitude: -23.5, longitude: -46.6, distance_km: null }));
const RJ = [{ reseller_id: 'r-rj-1', name: 'Loja RJ', type: 'farmacia', phone: null, whatsapp: '(21) 99999-0001', website: null, street: 'Av Rio', number: '1', neighborhood: 'Copacabana', city: 'Rio de Janeiro', state: 'RJ', latitude: -22.97, longitude: -43.19, distance_km: null }];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const pageHtml = (slug, extra = '', bodyStyle = '') => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
 <style>body{font-family:"Courier New",monospace;color:#333;margin:0;padding:12px;${bodyStyle}}</style></head>
 <body><header>Cabeçalho do cliente</header><geolynq-widget tenant="${slug}" ${extra}></geolynq-widget><footer>Rodapé do cliente</footer>
 <script src="/v2/embed.js" defer></script></body></html>`;

async function setup(ctx) {
  const page = await ctx.newPage();
  await page.route(/^https?:\/\/host\.test\//, (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/page') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: pageHtml(u.searchParams.get('t') || 'demo', u.searchParams.get('x') || '') });
    if (u.pathname === '/v2/embed.js') return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(BUNDLE) });
    return r.fulfill({ status: 404, body: '' });
  });
  await page.route('https://img.test/**', (r) => r.request().url().endsWith('boa.png') ? r.fulfill({ contentType: 'image/png', body: PNG }) : r.fulfill({ status: 404, body: '' }));
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await page.route(SB + '/rest/v1/**', (r) => {
    const rq = r.request(), u = new URL(rq.url());
    if (rq.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const body = rq.postData() ? JSON.parse(rq.postData()) : null;
    const path = u.pathname.replace('/rest/v1/', '');
    calls.push({ path, body });
    const json = (j, status = 200) => r.fulfill({ status, headers: cors, json: j });
    if (path === 'rpc/widget_get_tenant_v2') {
      if (body.p_slug === 'demo') return json([{ id: T.demo, name: 'Marca Demo', slug: 'demo', primary_color: null, logo_url: null, theme: { primary: '#0F766E', radius: 6, imageRatio: '4/3', font: "Georgia, 'Times New Roman', serif", card: '#ffffff' } }]);
      if (body.p_slug === 'herda') return json([{ id: T.herda, name: 'Marca Herda', slug: 'herda', primary_color: '#B91C1C', logo_url: null, theme: {} }]);
      if (body.p_slug === 'grande') return json([{ id: T.grande, name: 'Marca Grande', slug: 'grande', primary_color: null, logo_url: null, theme: { buttonStyle: 'outline' } }]);
      return json([]);
    }
    if (path === 'rpc/widget_find_products') {
      const src = body.p_tenant_id === T.grande ? BIG : CATALOG;
      const t = norm(body.p_term || '');
      const all = src.filter((p) => !t || norm(p.name + ' ' + p.sku + ' ' + (p.category || '')).includes(t));
      const page = all.slice(body.p_offset, body.p_offset + body.p_limit);
      return json(page.map((p) => ({ ...p, total_count: all.length })));
    }
    if (path === 'rpc/widget_list_places') return json({ ufs: ['RJ', 'SP'], cidades: [{ uf: 'RJ', cidade: 'Rio de Janeiro' }, { uf: 'SP', cidade: 'Santos' }, { uf: 'SP', cidade: 'São Paulo' }] });
    if (path === 'rpc/widget_list_resellers') {
      if (!body.p_product_id && !body.p_uf && !body.p_city && body.p_lat == null) return json([]);
      let all = [...SP, ...RJ];
      if (body.p_uf) all = all.filter((x) => x.state === body.p_uf);
      if (body.p_city) all = all.filter((x) => norm(x.city) === norm(body.p_city));
      if (body.p_type) all = all.filter((x) => x.type === body.p_type);
      if (body.p_product_id === 'p-1') all = all.slice(0, 3);
      const rows = all.slice(body.p_offset, body.p_offset + body.p_limit).map((x) => ({ ...x, distance_km: body.p_lat != null ? 1.5 : null, total_count: all.length }));
      return json(rows);
    }
    if (path === 'rpc/widget_resellers_in_radius') return json([{ ...RJ[0], reseller_id: 'r-1', name: 'Farmácia Saúde Total', city: 'Santos', state: 'SP', phone: '(13) 3222-1111', whatsapp: '(13) 99999-8888', distance_km: 0.2 }]);
    if (path.startsWith('products')) { // getProductBySku
      const sku = (u.search.match(/sku=eq\.([^&]+)/) || [])[1];
      const p = CATALOG.find((x) => x.sku === sku);
      return json(p ? [{ id: p.id, sku: p.sku, name: p.name, category: p.category }] : []);
    }
    if (path === 'widget_events') { events.push(body); return r.fulfill({ status: 201, headers: cors, body: '' }); }
    return json({ message: 'unexpected ' + path }, 400);
  });
  await page.route('https://viacep.com.br/**', (r) => r.fulfill({ headers: cors, json: { logradouro: 'Av Ana Costa', bairro: 'Gonzaga', localidade: 'Santos', uf: 'SP' } }));
  await page.route('https://nominatim.openstreetmap.org/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/reverse')) return r.fulfill({ headers: cors, json: { address: { suburb: 'Gonzaga', city: 'Santos', 'ISO3166-2-lvl4': 'BR-SP' } } });
    return r.fulfill({ headers: cors, json: [{ lat: '-23.9608', lon: '-46.3336' }] });
  });
  return page;
}

(async () => {
  const browser = await chromium.launch({});
  const ctx = await browser.newContext({ geolocation: { latitude: -23.96, longitude: -46.33 }, permissions: ['geolocation'], viewport: { width: 1100, height: 900 } });
  const page = await setup(ctx);
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|tenant 'inexistente' n/.test(m.text()) && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  const w = page.locator('geolynq-widget');
  const sel = (s, o) => w.locator(s, o);
  const call = (path) => calls.filter((c) => c.path === path);

  // ───────── 1. tela inicial: busca primeiro, grade, um só botão por produto, botão da lista
  await page.goto('https://host.test/page?t=demo');
  await sel('.prod').first().waitFor({ timeout: 10000 });
  const primeiro = await sel('input, button, select, a').first().getAttribute('id');
  check('o primeiro campo é a busca de produto', primeiro === 'gl-term', String(primeiro));
  check('grade mostra 24 de 30 produtos (primeira página)', (await sel('.prod').count()) === 24);
  check('contador: 30 produtos', /30 produtos/.test(await sel('.count').innerText()));
  const botoesPorCard = await sel('.prod').evaluateAll((cs) => cs.map((c) => c.querySelectorAll('button, a').length));
  check('cada produto tem UM só botão', botoesPorCard.every((n) => n === 1), JSON.stringify(botoesPorCard.slice(0, 5)));
  check('o botão do produto é "Onde encontrar"', (await sel('.prod .btn').first().innerText()) === 'Onde encontrar');
  check('botão "Lista de revendedores" no início', (await sel('.bar .btn').innerText()) === 'Lista de revendedores');
  await sel('text=Mostrar mais').click();
  check('"Mostrar mais" revela o restante da grade', (await sel('.prod').count()) === 30);
  await shot(page, 'v2-01-home');
  check('catálogo carregado uma única vez (sem busca por tecla)', call('rpc/widget_find_products').length === 1);

  // ───────── 2. filtro enquanto digita, sem acento, sem rede
  const antes = calls.length;
  await sel('#gl-term').fill('PROTEINA');
  await page.waitForTimeout(150);
  check('filtro sem acento ("PROTEINA" acha "Proteínas")', (await sel('.prod').count()) === 2 && /2 produtos para “PROTEINA”/.test(await sel('.count').innerText()), await sel('.count').innerText());
  check('filtrar não faz nenhuma chamada de rede', calls.length === antes);
  await sel('#gl-term').fill('omega');
  check('filtro "omega" acha "Ômega 3"', (await sel('.prod').count()) === 1);

  // ───────── 3. nada encontrado: mensagem + telemetria anônima do termo (só depois da pausa)
  events.length = 0;
  await sel('#gl-term').fill('xyzabc');
  check('sem resultado: mensagem e nenhuma grade', /Nenhum produto encontrado/.test(await sel('.msg').innerText()) && (await sel('.prod').count()) === 0);
  check('nada é gravado enquanto a pessoa ainda está digitando', events.length === 0);
  await page.waitForTimeout(1700);
  const sem = events.filter((e) => e.event_type === 'search');
  check('depois da pausa grava 1 busca "fora do catálogo"', sem.length === 1 && sem[0].product_id === null && sem[0].results_count === 0 && sem[0].query_text === 'xyzabc', JSON.stringify(sem[0]));
  check('o evento leva uma visita anônima e telemetry_v=2', /^[0-9a-f-]{36}$/.test(sem[0]?.session_id || '') && sem[0]?.telemetry_v === 2);
  await sel('#gl-term').fill('xyzabc'); await page.waitForTimeout(1500);
  check('o mesmo termo não é gravado duas vezes na visita', events.filter((e) => e.event_type === 'search').length === 1);
  events.length = 0;
  await sel('#gl-term').fill('joao@email.com'); await page.waitForTimeout(1700);
  check('texto que parece e-mail NÃO é gravado', events.length === 0);
  await sel('#gl-term').fill('(13) 99999-8888'); await page.waitForTimeout(1700);
  check('texto que parece telefone NÃO é gravado', events.length === 0);
  const armazenado = await page.evaluate(() => ({ ls: localStorage.length, ss: sessionStorage.length, ck: document.cookie }));
  check('nada é guardado no navegador (localStorage, sessionStorage, cookie)', armazenado.ls === 0 && armazenado.ss === 0 && armazenado.ck === '', JSON.stringify(armazenado));
  await sel('#gl-term').fill('');

  // ───────── 4. Onde encontrar -> 3 opções
  await sel('.prod', { hasText: 'Whey Protein Isolado' }).locator('.btn').click();
  await sel('h2').waitFor();
  check('"Onde encontrar" abre o produto com as 3 opções', /Whey Protein Isolado/.test(await sel('h2').innerText()) &&
    (await sel('button', { hasText: 'Usar minha localização' }).count()) === 1 && (await sel('#gl-cep').count()) === 1 && (await sel('button', { hasText: 'Ver lista de revendedores' }).count()) === 1);
  await shot(page, 'v2-02-onde-encontrar');
  check('antes de escolher, nenhuma busca de revendedor foi feita', call('rpc/widget_resellers_in_radius').length === 0 && call('rpc/widget_list_resellers').length === 0);

  // CEP
  events.length = 0;
  await sel('#gl-cep').fill('11060-001'); await sel('button', { hasText: 'Ver revendedores' }).click();
  await sel('article.card').first().waitFor({ timeout: 10000 });
  await shot(page, 'v2-03-resultado');
  check('CEP: lista o revendedor com distância', /Farmácia Saúde Total/.test(await sel('article.card').first().innerText()) && /200 m/.test(await sel('article.card').first().innerText()));
  const busca = events.find((e) => e.event_type === 'search' && e.product_id === 'p-1');
  check('CEP: grava a busca com produto, localização por CEP e contagem física', busca && busca.location_source === 'cep' && busca.physical_count === 1 && busca.cep5 === '11060' && String(busca.lat_approx).split('.')[1]?.length <= 2, JSON.stringify(busca));
  await sel('a', { hasText: 'WhatsApp' }).evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
  await sel('a', { hasText: 'WhatsApp' }).click();
  const clique = events.find((e) => e.event_type === 'reseller_click');
  check('clique no WhatsApp grava reseller_click com produto e revendedor', clique && clique.action === 'whatsapp' && clique.product_id === 'p-1' && clique.reseller_id === 'r-1', JSON.stringify(clique));

  // GPS
  await sel('button', { hasText: 'Alterar localização' }).click();
  events.length = 0;
  await sel('button', { hasText: 'Usar minha localização' }).click();
  await sel('article.card').first().waitFor({ timeout: 10000 });
  check('GPS: resultados aparecem e a origem gravada é "gps"', events.some((e) => e.event_type === 'search' && e.location_source === 'gps'));

  // ───────── 5. lista a partir do produto (3ª opção) já filtrada
  await sel('button', { hasText: 'Ver lista de revendedores' }).click();
  await sel('article.card').first().waitFor({ timeout: 10000 });
  check('3ª opção: abre a lista já filtrada pelo produto', (await sel('#gl-f-prod').inputValue()) === 'SKU-001' && (await sel('article.card').count()) === 3);
  check('a chamada da lista leva o produto e respeita o limite de 10 por página', call('rpc/widget_list_resellers').at(-1).body.p_product_id === 'p-1' && call('rpc/widget_list_resellers').at(-1).body.p_limit === 10);

  // ───────── 6. lista a partir do início: exige filtro, pagina de 10 em 10
  await sel('button', { hasText: '← Todos os produtos' }).click();
  await sel('.bar').waitFor();
  const listaAntes = call('rpc/widget_list_resellers').length;
  await sel('.bar .btn').click();
  await sel('#gl-f-uf').waitFor();
  check('lista sem filtro não lista a rede: pede um estado/cidade/produto', /Escolha um estado, uma cidade ou um produto/.test(await sel('.list-host').innerText()) && call('rpc/widget_list_resellers').length === listaAntes);
  check('cidade começa desabilitada até escolher o estado', await sel('#gl-f-city').isDisabled());
  await sel('#gl-f-uf').selectOption('SP');
  await sel('article.card').first().waitFor();
  await shot(page, 'v2-04-lista');
  check('estado SP: 10 revendedores e total 13', (await sel('article.card').count()) === 10 && /13 revendedores/.test(await sel('.list-host .count').innerText()));
  check('cidade habilita e só mostra as cidades do estado', !(await sel('#gl-f-city').isDisabled()) && (await sel('#gl-f-city option').allInnerTexts()).join('|') === 'Todas as cidades|Santos|São Paulo');
  await sel('.list-host button', { hasText: 'Mostrar mais' }).click();
  await page.waitForFunction(() => document.querySelector('geolynq-widget').shadowRoot.querySelectorAll('article.card').length === 13);
  check('"Mostrar mais" traz a segunda página (13 no total)', (await sel('article.card').count()) === 13 && (await sel('.list-host button', { hasText: 'Mostrar mais' }).count()) === 0);
  await sel('#gl-f-city').selectOption('Santos');
  await page.waitForFunction(() => document.querySelector('geolynq-widget').shadowRoot.querySelectorAll('article.card').length === 5);
  check('filtro por cidade (Santos)', (await sel('article.card').count()) === 5);
  await sel('#gl-f-uf').selectOption('RJ');
  await sel('article.card', { hasText: 'Loja RJ' }).waitFor();
  check('trocar de estado zera a cidade', (await sel('#gl-f-city').inputValue()) === '' && (await sel('article.card').count()) === 1);
  await sel('#gl-f-type').selectOption('online');
  await sel('.list-host .msg').waitFor();
  check('sem resultado: mensagem clara', /Nenhum revendedor encontrado/.test(await sel('.list-host .msg').innerText()));
  await sel('#gl-f-type').selectOption('');
  await sel('button', { hasText: 'Ordenar pelos mais próximos de mim' }).click();
  await sel('article.card .dist').first().waitFor();
  check('ordenar por proximidade usa a localização e mostra distância', call('rpc/widget_list_resellers').at(-1).body.p_lat === -23.96 && /1,5 km/.test(await sel('article.card .dist').first().innerText()));
  events.length = 0;
  await sel('a', { hasText: 'Ligar' }).first().evaluate((a) => a.addEventListener('click', (e) => e.preventDefault())).catch(() => {});
  await sel('a', { hasText: 'WhatsApp' }).first().evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
  await sel('a', { hasText: 'WhatsApp' }).first().click();
  check('clique na lista grava reseller_click sem produto (nenhum filtrado)', events.some((e) => e.event_type === 'reseller_click' && e.product_id === null && e.action === 'whatsapp'));

  // ───────── 7. tema do cliente + herança do site
  await sel('button', { hasText: '← Todos os produtos' }).click();
  await sel('.prod').first().waitFor();
  const estilo = await sel('.prod .btn').first().evaluate((b) => { const c = getComputedStyle(b); return { bg: c.backgroundColor, radius: c.borderTopLeftRadius }; });
  check('tema: cor principal do cliente no botão', estilo.bg === 'rgb(15, 118, 110)', estilo.bg);
  check('tema: arredondamento do cliente', estilo.radius === '6px', estilo.radius);
  check('tema: proporção da foto do cliente (4 / 3)', (await sel('.ph').first().evaluate((e) => getComputedStyle(e).aspectRatio)) === '4 / 3');
  check('tema: fonte do cliente (Georgia)', /Georgia/.test(await sel('.prod-name').first().evaluate((e) => getComputedStyle(e).fontFamily)));
  check('o widget não mexe no cabeçalho e no rodapé do cliente', (await page.locator('header').innerText()) === 'Cabeçalho do cliente' && (await page.locator('footer').innerText()) === 'Rodapé do cliente');
  const pagH = await browser.newPage();
  await pagH.close();
  // fotos
  check('foto boa carrega (lazy, sem referrer)', await sel('.ph img').first().evaluate((i) => i.loading === 'lazy' && i.getAttribute('referrerpolicy') === 'no-referrer'));
  await page.waitForTimeout(400);
  const fotos = await sel('.prod').evaluateAll((cs) => cs.slice(0, 3).map((c) => ({ img: !!c.querySelector('img'), fb: c.querySelector('.ph-fb')?.textContent || null })));
  check('foto quebrada vira iniciais; sem foto mostra iniciais; foto boa fica', fotos[0].img === true && fotos[1].img === false && fotos[1].fb === 'CM' && fotos[2].fb === 'PV', JSON.stringify(fotos));

  // ───────── 8. herança de fonte e cor do site quando o tema não define
  await page.goto('https://host.test/page?t=herda');
  await sel('.prod').first().waitFor();
  check('sem tema: herda a fonte do site (Courier New)', /Courier/.test(await sel('.prod-name').first().evaluate((e) => getComputedStyle(e).fontFamily)));
  check('sem tema: usa a cor principal cadastrada do cliente (#B91C1C)', (await sel('.prod .btn').first().evaluate((b) => getComputedStyle(b).backgroundColor)) === 'rgb(185, 28, 28)');
  await page.goto('https://host.test/page?t=herda&x=' + encodeURIComponent('color="#0000FF"'));
  await sel('.prod').first().waitFor();
  check('o atributo color do snippet vence o tema e a cor do cliente', (await sel('.prod .btn').first().evaluate((b) => getComputedStyle(b).backgroundColor)) === 'rgb(0, 0, 255)');

  // ───────── 9. página de produto (atributo product) e tenant inexistente
  await page.goto('https://host.test/page?t=demo&x=' + encodeURIComponent('product="SKU-001"'));
  await sel('h2').waitFor();
  check('product="SKU": abre direto no "Onde encontrar" do produto', /Whey Protein Isolado/.test(await sel('h2').innerText()) && (await sel('#gl-cep').count()) === 1);
  await page.goto('https://host.test/page?t=inexistente');
  await sel('.msg').waitFor();
  check('tenant inexistente/inativo: mensagem amigável, sem quebrar a página', /indisponível/.test(await sel('.msg').innerText()) && (await page.locator('footer').count()) === 1);

  // ───────── 10. catálogo grande: busca e paginação no servidor
  await page.goto('https://host.test/page?t=grande');
  await sel('.prod').first().waitFor();
  check('catálogo grande: total real no contador e botão contornado do tema', /800 produtos/.test(await sel('.count').innerText()) && (await sel('.prod .btn').first().evaluate((b) => getComputedStyle(b).backgroundColor)) === 'rgb(255, 255, 255)');
  const n0 = call('rpc/widget_find_products').length;
  await sel('#gl-term').fill('whey');
  await page.waitForFunction(() => /produtos para/.test(document.querySelector('geolynq-widget').shadowRoot.querySelector('.count')?.textContent || ''), null, { timeout: 5000 });
  const ultima = call('rpc/widget_find_products').at(-1).body;
  check('catálogo grande: busca vai ao servidor (com pausa) e traz o total filtrado', call('rpc/widget_find_products').length === n0 + 1 && ultima.p_term === 'whey' && /20 produtos para “whey”/.test(await sel('.count').innerText()), await sel('.count').innerText());

  // ───────── 11. celular: sem rolagem lateral
  const m = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const pm = await setup(m);
  await pm.goto('https://host.test/page?t=demo');
  await pm.locator('geolynq-widget').locator('.prod').first().waitFor();
  const over = await pm.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const colunas = await pm.locator('geolynq-widget').locator('.grid').first().evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
  await shot(pm, 'v2-05-celular');
  check('celular (390 px): sem rolagem lateral e 2 colunas', !over && colunas === 2, `overflow=${over} colunas=${colunas}`);
  await m.close();

  check('sem erros de JavaScript no console', errs.length === 0, errs.join(' | '));
  await browser.close();
  const falhas = results.filter((x) => !x).length;
  console.log(`\n${results.length - falhas}/${results.length} verificações passaram`);
  process.exit(falhas ? 1 : 0);
})();
