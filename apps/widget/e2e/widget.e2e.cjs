const { createRequire } = require('module'); const { execSync } = require('child_process');
const req = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = req('playwright'); const fs = require('fs');
// E2E do widget em Chromium real, com Supabase/ViaCEP/Nominatim simulados via page.route
// (formato das respostas validado antes via SQL como role anon no geolynq-prod).
// Uso: npm run build -w @geolynq/widget && npm run e2e -w @geolynq/widget
// O build PRECISA ter VITE_SUPABASE_URL (a mesma de SB abaixo) e VITE_SUPABASE_ANON_KEY
// (em apps/widget/.env.local ou no ambiente); sem elas o widget nem chega na tela de busca
// e o E2E falha com timeout esperando input#gl-term.
const BUNDLE = require('path').join(__dirname, '..', 'dist', 'v1', 'embed.js');
const SB = 'https://vshlsisnuaugeceafipt.supabase.co';
const TENANT_ID = '3596b3c6-8389-42af-b575-4bbdd69f2f2d', PRODUCT_ID = 'p-1';
const events = [], supabaseCalls = [];
const results = [];
const check = (n, ok, x='') => { results.push(ok); console.log((ok?'PASS ':'FAIL ')+n+(x?'  -> '+x:'')); };
// ISO-8859-1 de propósito: simula site hospedeiro antigo, sem charset utf-8 no JS
const pageHtml = (t, p) => `<!doctype html><html><head><meta charset="iso-8859-1"><style>
 button,input,h2,label,p,span{color:red!important;font-family:"Comic Sans MS"!important;font-size:30px!important}</style></head>
 <body><h1>Host</h1><geolynq-widget tenant="${t}" color="#E84E0E"${p ? ` product="${p}"` : ''}></geolynq-widget><script src="/v1/embed.js" defer></script></body></html>`;

async function setup(ctx) {
  const page = await ctx.newPage();
  await page.route('http://host.test/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/page') return r.fulfill({ headers: { 'content-type': 'text/html; charset=iso-8859-1' }, body: pageHtml(u.searchParams.get('t'), u.searchParams.get('p')) });
    if (u.pathname === '/v1/embed.js') return r.fulfill({ headers: { 'content-type': 'text/javascript' }, body: fs.readFileSync(BUNDLE) });
    return r.fulfill({ status: 404, body: '' });
  });
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await page.route(SB + '/rest/v1/**', (r) => {
    const rq = r.request(), u = new URL(rq.url());
    if (rq.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const body = rq.postData() ? JSON.parse(rq.postData()) : null;
    supabaseCalls.push({ path: u.pathname.replace('/rest/v1/',''), apikey: rq.headers()['apikey'], auth: rq.headers()['authorization'], q: u.search, body });
    const json = (j, status=200) => r.fulfill({ status, headers: cors, json: j });
    if (u.pathname.endsWith('/rpc/widget_get_tenant')) return json(body.p_slug === 'demo' ? [{ id: TENANT_ID, name: 'Demo', slug: 'demo', primary_color: null, logo_url: null }] : []);
    if (u.pathname.endsWith('/products')) {
      const q = decodeURIComponent(u.search);
      if (/sku=eq\.WPI-900/.test(q)) return json([{ id: PRODUCT_ID, sku: 'WPI-900', name: 'Whey Protein Isolado 900g', category: 'Proteínas' }]);
      if (/sku=eq\./.test(q)) return json([]);
      if (/whey/i.test(q)) return json([{ id: PRODUCT_ID, sku: 'WPI-900', name: 'Whey Protein Isolado 900g', category: 'Proteínas' }]);
      if (/barra/i.test(q)) return json([{ id: 'p-far', sku: 'BAR-012', name: 'Barra de Proteína', category: 'proteina' }]);
      if (/hiper/i.test(q)) return json([{ id: 'p-none', sku: 'HIP-3000', name: 'Hipercalórico 3kg', category: 'proteina' }]);
      return json([]);
    }
    if (u.pathname.endsWith('/rpc/widget_resellers_in_radius') && body.p_product_id === 'p-none') return json([]);
    if (u.pathname.endsWith('/rpc/widget_resellers_in_radius') && body.p_product_id === 'p-far') return json([{ reseller_id: 'r-2', name: 'Loja Online Demo', type: 'online', phone: null, whatsapp: null, website: 'https://example.com/loja', street: 'Av Faria Lima', number: '3000', neighborhood: 'Itaim', city: 'São Paulo', state: 'SP', latitude: -23.58, longitude: -46.67, distance_km: null }]);
    if (u.pathname.endsWith('/rpc/widget_resellers_in_radius')) return json([{ reseller_id: 'r-1', name: 'Farmácia Saúde Total', type: 'farmacia', phone: '(13) 3222-1111', whatsapp: '(13) 99999-8888', website: 'javascript:alert(1)', street: 'Av Ana Costa', number: '100', neighborhood: 'Gonzaga', city: 'Santos', state: 'SP', latitude: -23.96, longitude: -46.33, distance_km: body.p_lat ? 0.2 : null }]);
    if (u.pathname.endsWith('/widget_events')) { events.push(body); return r.fulfill({ status: 201, headers: cors, body: '' }); }
    return json({ message: 'unexpected' }, 400);
  });
  await page.route('https://viacep.com.br/**', r => r.fulfill({ headers: cors, json: { logradouro: 'Av Ana Costa', bairro: 'Gonzaga', localidade: 'Santos', uf: 'SP' } }));
  await page.route('https://nominatim.openstreetmap.org/**', r => r.fulfill({ headers: cors, json: [{ lat: '-23.9608', lon: '-46.3336' }] }));
  return page;
}

(async () => {
  const browser = await chromium.launch({});
  const ctx = await browser.newContext();
  const page = await setup(ctx);
  const errs = []; page.on('console', m => m.type()==='error' && errs.push(m.text()));
  page.on('pageerror', e => errs.push('PAGEERROR '+e.message));
  const sel = (s) => page.locator('geolynq-widget').locator(s);
  const sel2 = (p, s) => p.locator('geolynq-widget').locator(s);

  await page.goto('http://host.test/page?t=demo');
  await sel('input#gl-term').waitFor({ timeout: 10000 });
  check('widget carrega tenant e mostra a busca', true);
  check('não rouba o foco da página no carregamento', await page.evaluate(() => document.activeElement === document.body));
  check('texto com acento íntegro em página ISO-8859-1', /Qual produto você procura\?/.test(await sel('label').innerText()), await sel('label').innerText());

  const st = await sel('input#gl-term').evaluate(e => { const s = getComputedStyle(e); return { ff: s.fontFamily, fs: s.fontSize, c: s.color }; });
  check('Shadow DOM isola do CSS hostil do site', !/comic/i.test(st.ff) && st.fs === '16px' && st.c !== 'rgb(255, 0, 0)', JSON.stringify(st));
  const bg = await sel('button[type=submit]').evaluate(e => getComputedStyle(e).backgroundColor);
  check('cor do atributo aplicada (#E84E0E)', bg === 'rgb(232, 78, 14)', bg);

  await sel('input#gl-term').fill('zzzzproduto'); await sel('button[type=submit]').click();
  await sel('text=Não encontramos esse produto').waitFor({ timeout: 10000 });
  check('termo sem produto mostra mensagem', true);

  await sel('input#gl-term').fill('whey),sku.neq.x'); await sel('button[type=submit]').click(); await page.waitForTimeout(500);
  const injQ = supabaseCalls.filter(c => c.path === 'products').pop().q;
  check('termo com sintaxe de filtro é neutralizado antes de ir à API', !/\),sku\.neq/.test(decodeURIComponent(injQ)), decodeURIComponent(injQ).slice(0,140));

  await sel('input#gl-term').fill('whey'); await sel('button[type=submit]').click();
  await sel('button.pick').first().waitFor({ timeout: 10000 });
  check('busca "whey" lista o produto', /Whey Protein Isolado/.test(await sel('button.pick').first().innerText()));

  await sel('button.pick').first().click();
  await sel('input#gl-cep').fill('abc'); await sel('form button[type=submit]').click();
  await sel('.msg.error').waitFor();
  check('CEP inválido é bloqueado', /CEP válido/.test(await sel('.msg.error').innerText()));
  await sel('input#gl-cep').fill('11060-001'); await sel('form button[type=submit]').click();
  await sel('article.card').first().waitFor({ timeout: 10000 });
  const card = await sel('article.card').first().innerText();
  check('resultado: revendedor, tipo, distância e endereço', /Farmácia Saúde Total/.test(card) && /Farmácia\b/.test(card) && /a 200 m/.test(card) && /Av Ana Costa, 100/.test(card), card.replace(/\n/g,' | '));
  const hrefs = await sel('article.card a').evaluateAll(as => as.map(a => a.textContent + '=' + a.getAttribute('href') + '|' + a.rel));
  check('WhatsApp usa wa.me com DDI 55', hrefs.some(h => /^WhatsApp=https:\/\/wa\.me\/5513999998888/.test(h)), hrefs.join(' ; '));
  check('site com javascript: é descartado (sem botão Site)', !hrefs.some(h => /^Site=/.test(h)));
  check('todo link externo tem noopener noreferrer', hrefs.every(h => /noopener noreferrer/.test(h)));

  const a = sel('article.card a').first();
  await a.evaluate(el => el.addEventListener('click', e => e.preventDefault())); await a.click();
  await page.waitForTimeout(500);

  const ev = events;
  const e0 = ev.find(e => e.event_type === 'search' && e.product_id === null);
  const e1 = ev.find(e => e.event_type === 'search' && e.product_id === PRODUCT_ID);
  const e2 = ev.find(e => e.event_type === 'reseller_click');
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  check('evento search sem produto: product_id null + results_count 0', !!e0 && e0.results_count === 0 && e0.query_text === 'zzzzproduto', JSON.stringify(e0));
  check('evento search com produto: results_count 1 + cidade/UF', !!e1 && e1.results_count === 1 && e1.city === 'Santos' && e1.state === 'SP', JSON.stringify(e1));
  check('evento reseller_click com reseller_id e product_id', !!e2 && e2.reseller_id === 'r-1' && e2.product_id === PRODUCT_ID, JSON.stringify(e2));
  check('todos os eventos levam tenant_id e session_id (uuid v4)', ev.length >= 3 && ev.every(e => e.tenant_id === TENANT_ID && uuidRe.test(e.session_id)));
  check('session_id é o mesmo em todos os eventos', new Set(ev.map(e => e.session_id)).size === 1);
  const sid = await page.evaluate(() => JSON.parse(localStorage.getItem('geolynq_sid')));
  check('session_id persistido ~30 dias no localStorage', sid.id === ev[0].session_id && sid.exp - Date.now() > 29 * 864e5);
  check('requisições usam só apikey, sem Authorization/service_role', supabaseCalls.every(c => !!c.apikey && !c.auth), supabaseCalls[0].apikey.slice(0,20)+'…');

  // raio máximo: a RPC nova recebe p_max_km=100 (e a antiga, sem raio, nunca mais é chamada)
  const radiusCall = supabaseCalls.find(c => c.path === 'rpc/widget_resellers_in_radius');
  check('busca de revendedores usa a RPC com raio e envia p_max_km = 100', !!radiusCall && radiusCall.body.p_max_km === 100, JSON.stringify(radiusCall && radiusCall.body));
  check('RPC antiga (sem raio) não é mais chamada', !supabaseCalls.some(c => c.path === 'rpc/widget_nearest_resellers'));

  // produto vendido só online, com localização: mostra a loja online com aviso e registra lacuna local
  const goSearch = async (term) => { await sel('button:has-text("Nova busca")').click(); await sel('input#gl-term').fill(term); await sel('button[type=submit]').click(); await sel('button.pick').first().waitFor({ timeout: 10000 }); await sel('button.pick').first().click(); await sel('input#gl-cep').fill('11060-001'); await sel('form button[type=submit]').click(); };
  await goSearch('barra');
  await sel('article.card').first().waitFor({ timeout: 10000 });
  const subOnline = await sel('p[aria-live=polite]').innerText();
  check('só online: avisa que não há físico dentro do raio', /Nenhum revendedor físico em até 100 km de Santos/.test(subOnline), subOnline);
  const cardOnline = await sel('article.card').first().innerText();
  check('loja online: sem distância e sem endereço', /Loja Online Demo/.test(cardOnline) && !/\ba \d/.test(cardOnline) && !/Faria Lima/.test(cardOnline), cardOnline.replace(/\n/g,' | '));
  const hrefsOnline = await sel('article.card a').evaluateAll(as => as.map(a => a.textContent));
  check('loja online: sem botão "Como chegar"', !hrefsOnline.includes('Como chegar'), hrefsOnline.join(','));
  await page.waitForTimeout(300);
  const eFar = events.find(e => e.event_type === 'search' && e.product_id === 'p-far');
  check('lacuna local registrada mesmo com loja online (results_count = 0)', !!eFar && eFar.results_count === 0, JSON.stringify(eFar));

  // produto sem nenhum revendedor, com localização: mensagem com o raio
  await goSearch('hiper');
  await sel('.msg').waitFor({ timeout: 10000 });
  const msgNone = await sel('.msg').innerText();
  check('sem revendedor no raio: mensagem cita 100 km e a cidade', /Nenhum revendedor encontrado em até 100 km de Santos/.test(msgNone), msgNone);
  await page.waitForTimeout(300);
  const eNone = events.find(e => e.event_type === 'search' && e.product_id === 'p-none');
  check('lacuna registrada: product_id + results_count = 0', !!eNone && eNone.results_count === 0, JSON.stringify(eNone));

  // página de produto: product="SKU" abre direto na localização, sem pedir o produto de novo
  const p4 = await setup(ctx);
  await p4.goto('http://host.test/page?t=demo&p=WPI-900');
  await sel2(p4, 'input#gl-cep').waitFor({ timeout: 10000 });
  check('product="SKU": abre já na etapa de CEP, com o produto escolhido', /Whey Protein Isolado 900g/.test(await sel2(p4, '.chip').innerText()), await sel2(p4, '.chip').innerText());
  check('product="SKU": não mostra a busca de produto', (await sel2(p4, 'input#gl-term').count()) === 0);
  check('product="SKU": não rouba o foco no carregamento', await p4.evaluate(() => document.activeElement === document.body));
  await sel2(p4, 'input#gl-cep').fill('11060-001'); await sel2(p4, 'form button[type=submit]').click();
  await sel2(p4, 'article.card').first().waitFor({ timeout: 10000 });
  check('product="SKU": CEP leva aos revendedores desse produto', /Farmácia Saúde Total/.test(await sel2(p4, 'article.card').first().innerText()));

  // SKU inexistente: cai na busca normal (nunca deixa o widget quebrado)
  const p5 = await setup(ctx);
  await p5.goto('http://host.test/page?t=demo&p=NAO-EXISTE');
  await sel2(p5, 'input#gl-term').waitFor({ timeout: 10000 });
  check('product="SKU" inexistente: cai na busca normal', true);

  // tenant inexistente
  const p2 = await setup(ctx);
  await p2.goto('http://host.test/page?t=nao-existe');
  await sel2(p2, 'text=indisponível').waitFor({ timeout: 10000 });
  check('tenant inexistente degrada sem quebrar a página', true);

  // rede fora do ar
  const p3 = await ctx.newPage();
  await p3.route('http://host.test/**', (r) => { const u = new URL(r.request().url()); return u.pathname === '/page' ? r.fulfill({ contentType: 'text/html; charset=utf-8', body: pageHtml('demo') }) : r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(BUNDLE) }); });
  await p3.route(SB + '/**', r => r.abort());
  await p3.goto('http://host.test/page?t=demo');
  await sel2(p3, 'text=indisponível').waitFor({ timeout: 10000 });
  check('API fora do ar: mensagem amigável, sem exceção na página', true);

  const bad = errs.filter(e => !/Failed to load resource|nao-existe|\[geolynq\]/.test(e));
  check('sem exceções JS inesperadas', bad.length === 0, bad.join(' || ').slice(0, 300));
  await browser.close();
  console.log(results.every(Boolean) ? `ALL PASS (${results.length})` : 'SOME FAILED');
})().catch(e => { console.error('E2E ERROR', e.message.split('\n').slice(0,3).join(' / ')); process.exit(1); });
