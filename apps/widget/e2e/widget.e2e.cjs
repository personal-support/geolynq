const { createRequire } = require('module'); const { execSync } = require('child_process');
const req = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = req('playwright'); const fs = require('fs');
// E2E do widget em Chromium real, com Supabase/ViaCEP/Nominatim simulados via page.route
// (formato das respostas validado antes via SQL como role anon no geolynq-prod).
// Uso: npm run build -w @geolynq/widget && npm run e2e -w @geolynq/widget
const BUNDLE = require('path').join(__dirname, '..', 'dist', 'v1', 'embed.js');
const SB = 'https://vshlsisnuaugeceafipt.supabase.co';
const TENANT_ID = '3596b3c6-8389-42af-b575-4bbdd69f2f2d', PRODUCT_ID = 'p-1';
const events = [], supabaseCalls = [];
const results = [];
const check = (n, ok, x='') => { results.push(ok); console.log((ok?'PASS ':'FAIL ')+n+(x?'  -> '+x:'')); };
// ISO-8859-1 de propósito: simula site hospedeiro antigo, sem charset utf-8 no JS
const pageHtml = (t) => `<!doctype html><html><head><meta charset="iso-8859-1"><style>
 button,input,h2,label,p,span{color:red!important;font-family:"Comic Sans MS"!important;font-size:30px!important}</style></head>
 <body><h1>Host</h1><geolynq-widget tenant="${t}" color="#E84E0E"></geolynq-widget><script src="/v1/embed.js" defer></script></body></html>`;

async function setup(ctx) {
  const page = await ctx.newPage();
  await page.route('http://host.test/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/page') return r.fulfill({ headers: { 'content-type': 'text/html; charset=iso-8859-1' }, body: pageHtml(u.searchParams.get('t')) });
    if (u.pathname === '/v1/embed.js') return r.fulfill({ headers: { 'content-type': 'text/javascript' }, body: fs.readFileSync(BUNDLE) });
    return r.fulfill({ status: 404, body: '' });
  });
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await page.route(SB + '/rest/v1/**', (r) => {
    const rq = r.request(), u = new URL(rq.url());
    if (rq.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const body = rq.postData() ? JSON.parse(rq.postData()) : null;
    supabaseCalls.push({ path: u.pathname.replace('/rest/v1/',''), apikey: rq.headers()['apikey'], auth: rq.headers()['authorization'], q: u.search });
    const json = (j, status=200) => r.fulfill({ status, headers: cors, json: j });
    if (u.pathname.endsWith('/rpc/widget_get_tenant')) return json(body.p_slug === 'demo' ? [{ id: TENANT_ID, name: 'Demo', slug: 'demo', primary_color: null, logo_url: null }] : []);
    if (u.pathname.endsWith('/products')) return json(/whey/i.test(decodeURIComponent(u.search)) ? [{ id: PRODUCT_ID, sku: 'WPI-900', name: 'Whey Protein Isolado 900g', category: 'Proteínas' }] : []);
    if (u.pathname.endsWith('/rpc/widget_nearest_resellers')) return json([{ reseller_id: 'r-1', name: 'Farmácia Saúde Total', type: 'farmacia', phone: '(13) 3222-1111', whatsapp: '(13) 99999-8888', website: 'javascript:alert(1)', street: 'Av Ana Costa', number: '100', neighborhood: 'Gonzaga', city: 'Santos', state: 'SP', latitude: -23.96, longitude: -46.33, distance_km: body.p_lat ? 0.2 : null }]);
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
