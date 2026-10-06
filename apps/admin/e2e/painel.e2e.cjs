/**
 * E2E do painel em Chromium real, contra o servidor Next de produção (next start) e o mini-Supabase de e2e/mock-supabase.cjs
 * (relatórios vindos das funções SQL reais num Postgres local, com RLS).
 *
 * Pré-requisitos (ver supabase/tests/README.md): Postgres local com schema + migrations + 02_fixture + 03_eventos_simulados,
 * e o papel `e2e`. Build com as mesmas variáveis usadas aqui:
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_test npm run build -w @geolynq/admin
 *   npm run e2e -w @geolynq/admin
 * Capturas de tela: E2E_OUT (padrão /tmp/geolynq-e2e).
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { chromium } = require("playwright");
const { start: startMock } = require("./mock-supabase.cjs");

const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.E2E_OUT || "/tmp/geolynq-e2e";
const SENHA = "senha-teste-123";
const CHROME =
  process.env.CHROME_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", chromium.executablePath()].find((p) => fs.existsSync(p));

fs.mkdirSync(OUT, { recursive: true });
const resultados = [];
const check = (nome, ok, extra = "") => {
  resultados.push(!!ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${nome}${extra ? "  -> " + extra : ""}`);
};

async function esperarServidor() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`${BASE}/login`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Next não subiu em 40 s");
}

async function esperado() {
  // números de referência direto do banco (mesma função, mesmo usuário), para a tela ser conferida contra a fonte
  const db = new Client({ connectionString: process.env.DATABASE_URL || "postgres://e2e:e2e@127.0.0.1:5432/geolynq_test" });
  await db.connect();
  await db.query("begin");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000aa', true)");
  const t = (await db.query("select id from public.tenants where slug='fabrica-teste'")).rows[0].id;
  const ov = (await db.query("select public.panel_overview($1::uuid, 30) j", [t])).rows[0].j;
  const ov7 = (await db.query("select public.panel_overview($1::uuid, 7) j", [t])).rows[0].j;
  const cat = (await db.query("select public.panel_catalog($1::uuid) j", [t])).rows[0].j;
  const totalEventos = (await db.query("select count(*)::int n from public.widget_events where tenant_id=$1::uuid", [t])).rows[0].n;
  const simulados = (await db.query("select count(*)::int n from public.widget_events where tenant_id=$1::uuid and session_id like 'seed-%'", [t])).rows[0].n;
  await db.query("rollback");
  await db.end();
  return { ov, ov7, cat, totalEventos, simulados };
}

(async () => {
  const mock = await startMock(54321);
  // E2E_STANDALONE=1: sobe o servidor da saída "standalone" (o que vai dentro da imagem Docker), montado como no Dockerfile.
  const raiz = path.join(__dirname, "..");
  let comando;
  if (process.env.E2E_STANDALONE) {
    const sa = path.join(raiz, ".next", "standalone", "apps", "admin");
    fs.cpSync(path.join(raiz, ".next", "static"), path.join(sa, ".next", "static"), { recursive: true });
    fs.cpSync(path.join(raiz, "public"), path.join(sa, "public"), { recursive: true });
    comando = [path.join(sa, "server.js")];
  } else {
    comando = [require.resolve("next/dist/bin/next"), "start", "-p", String(PORT), "-H", "127.0.0.1"];
  }
  const next = spawn(process.execPath, comando, {
    cwd: process.env.E2E_STANDALONE ? path.join(raiz, ".next", "standalone", "apps", "admin") : raiz,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", PORT: String(PORT), HOSTNAME: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let nextLog = "";
  next.stdout.on("data", (d) => (nextLog += d));
  next.stderr.on("data", (d) => (nextLog += d));

  let browser;
  try {
    await esperarServidor();
    const ref = await esperado();
    // Cenário "base pequena": 5 buscas (sessões e2e-…, NÃO 'seed-…') no tenant demo; removidas no final.
    const dbSeed = new Client({ connectionString: process.env.DATABASE_URL || "postgres://e2e:e2e@127.0.0.1:5432/geolynq_test" });
    await dbSeed.connect();
    await dbSeed.query("delete from public.widget_events where session_id like 'e2e-%'");
    await dbSeed.query(`insert into public.widget_events (tenant_id, session_id, event_type, query_text, results_count, telemetry_v, created_at)
      select (select id from public.tenants where slug='demo'), 'e2e-' || g, 'search', 'whey', 1, 2, now() - (g || ' hours')::interval from generate_series(1, 5) g`);
    browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });

    const novoContexto = async (viewport = { width: 1440, height: 1000 }) => {
      const ctx = await browser.newContext({ viewport, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
      // OpenStreetMap (e o bundle do widget) não existem neste ambiente: responder vazio, sem poluir o log de erros
      await ctx.route(/tile\.openstreetmap\.org|widget\.geolynq\.personalsupport\.tech/, (r) => r.fulfill({ status: 204, body: "" }));
      return ctx;
    };
    const comLog = (page) => {
      const erros = [];
      page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
      page.on("console", (m) => {
        if (m.type() === "error" && !/Failed to load resource|ERR_|204/.test(m.text())) erros.push("console: " + m.text());
      });
      return erros;
    };
    const entrar = async (page, email, senha = SENHA) => {
      await page.goto(`${BASE}/login`);
      await page.fill("#email", email);
      await page.fill("#password", senha);
      await Promise.all([page.waitForLoadState("networkidle").catch(() => {}), page.click("button[type=submit]")]);
    };
    const texto = (page) => page.locator("body").innerText();

    // ───────────────────────────── 1. porta de entrada
    {
      const ctx = await novoContexto();
      const page = await ctx.newPage();
      const erros = comLog(page);

      await page.goto(`${BASE}/dashboard/rede`);
      check("sem sessão: /dashboard/rede redireciona para /login com ?next", /\/login\?next=%2Fdashboard%2Frede/.test(page.url()), page.url());

      const resp = await page.goto(`${BASE}/login`);
      const h = resp.headers();
      check("cabeçalhos de segurança presentes", h["x-content-type-options"] === "nosniff" && h["x-frame-options"] === "DENY" && !h["x-powered-by"]);
      await page.screenshot({ path: `${OUT}/01-login-desktop.png` });

      await entrar(page, "a@example.invalid", "senha-errada");
      check("senha errada mostra mensagem clara e fica no login", /E-mail ou senha incorretos\./.test(await texto(page)) && /\/login/.test(page.url()));
      check("e-mail digitado é preservado após erro", (await page.inputValue("#email")) === "a@example.invalid");

      await page.goto(`${BASE}/login?next=//evil.example.com`);
      await entrar(page, "a@example.invalid");
      const u = new URL(page.url());
      check("?next externo é ignorado (sem open redirect)", u.host === `127.0.0.1:${PORT}` && u.pathname === "/dashboard", page.url());
      const cookies = (await ctx.cookies()).filter((c) => c.name.startsWith("sb-"));
      check("cookies de sessão são httpOnly e SameSite=Lax", cookies.length > 0 && cookies.every((c) => c.httpOnly && c.sameSite === "Lax"), cookies.map((c) => `${c.name}:${c.httpOnly}/${c.sameSite}`).join(" "));
      check("JavaScript da página não enxerga o token de sessão", !(await page.evaluate(() => document.cookie)).includes("sb-"));
      const csp = (await page.goto(`${BASE}/dashboard`)).headers()["content-security-policy"] || "";
      check("CSP presente: sem frames, sem plugins, origens restritas", /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp) && !/script-src[^;]*\*/.test(csp), csp.slice(0, 60) + "…");
      check("sem erros de JS no login e na entrada", erros.length === 0, erros.join(" | "));
      await ctx.close();
    }

    // ───────────────────────────── 2. usuário do cliente de teste (trial), desktop
    const ctxA = await novoContexto();
    const pageA = await ctxA.newPage();
    const errosA = comLog(pageA);
    await entrar(pageA, "a@example.invalid");
    await pageA.waitForSelector(".leaflet-container", { timeout: 15000 }).catch(() => {});
    await pageA.waitForTimeout(600);

    {
      const t = await texto(pageA);
      const k = ref.ov.kpis;
      check("visão geral: frase principal traz o nº de buscas sem revendedor do banco", new RegExp(`${k.sem_cobertura}\\s+buscas ficaram sem revendedor por perto`).test(t), `esperado ${k.sem_cobertura}`);
      check("visão geral: total de buscas confere com o banco", t.includes(String(k.buscas)), `esperado ${k.buscas}`);
      check("visão geral: maior lacuna citada", t.includes(ref.ov.lacunas[0].produto) && t.includes(ref.ov.lacunas[0].cidade));
      check("sidebar: nome do cliente e status 'Em teste'", /Fábrica Teste \(hipotético\)/.test(t) && /Em teste/.test(t));
      const marcadores = await pageA.locator(".leaflet-container path.leaflet-interactive").count();
      const esperadosMarc = ref.cat.rede.filter((r) => r.tipo !== "online" && r.lat != null).length + ref.ov.mapa_demanda.length;
      check("mapa: um marcador por revendedor físico localizado + um por local de demanda", marcadores === esperadosMarc, `${marcadores} de ${esperadosMarc}`);
      const discos = await pageA.locator(".leaflet-container path:not(.leaflet-interactive)").count();
      check("mapa: discos de 100 km desenhados", discos >= 8, `${discos}`);
      const faixa = pageA.locator('[role="note"]', { hasText: "Dados de demonstração" });
      check("faixa 'Dados de demonstração' aparece com dado simulado", (await faixa.count()) === 1);
      check("faixa informa a contagem real (simulados de total)", new RegExp(`Todos os ${ref.totalEventos} eventos|${ref.simulados} de ${ref.totalEventos} eventos`).test(await faixa.innerText()), await faixa.innerText().then((x) => x.replace(/\s+/g, " ").slice(0, 120)));
      check("sem aviso de base pequena quando há volume", (await pageA.locator('[role="note"]', { hasText: "Base pequena" }).count()) === 0);
      check("sem erros de JS na visão geral", errosA.length === 0, errosA.join(" | "));
      await pageA.screenshot({ path: `${OUT}/02-visao-geral-desktop.png`, fullPage: true });
    }

    // período
    await pageA.goto(`${BASE}/dashboard?dias=7`);
    {
      const t = await texto(pageA);
      check("período 7 dias: números mudam e batem com o banco", t.includes(String(ref.ov7.kpis.buscas)) && ref.ov7.kpis.buscas !== ref.ov.kpis.buscas, `7d=${ref.ov7.kpis.buscas} 30d=${ref.ov.kpis.buscas}`);
      check("período 7 dias: aba marcada", (await pageA.locator('nav[aria-label="Período"] a[aria-current="true"]').innerText()) === "7 dias");
    }
    await pageA.goto(`${BASE}/dashboard?dias=999`);
    check("período inválido cai em 30 dias", (await pageA.locator('nav[aria-label="Período"] a[aria-current="true"]').innerText()) === "30 dias");

    // páginas internas
    for (const rota of ["/dashboard/lacunas", "/dashboard/rede", "/dashboard/catalogo", "/dashboard/importacoes", "/dashboard/widget"]) {
      await pageA.goto(`${BASE}${rota}`);
      if ((await pageA.locator('[role="note"]', { hasText: "Dados de demonstração" }).count()) !== 1) check(`faixa de demonstração em ${rota}`, false);
    }
    check("faixa de demonstração presente em todas as telas", true);
    await pageA.goto(`${BASE}/dashboard/lacunas`);
    {
      const linhas = await pageA.locator("table tbody tr").count();
      check("lacunas: tabela com todas as combinações", linhas === ref.ov.lacunas.length, `${linhas} de ${ref.ov.lacunas.length}`);
      check("lacunas: orienta o próximo passo sem prometer o que não existe", /em breve/i.test(await texto(pageA)));
      await pageA.screenshot({ path: `${OUT}/03-lacunas-desktop.png`, fullPage: true });
    }

    await pageA.goto(`${BASE}/dashboard/rede`);
    {
      check("rede: lista todos os revendedores", (await pageA.locator("table tbody tr").count()) === ref.cat.rede.length);
      check("rede: revendedor físico sem coordenadas é sinalizado", /Fora da busca por distância/.test(await texto(pageA)));
      await pageA.goto(`${BASE}/dashboard/rede?uf=RJ`);
      check("rede: filtro por estado", (await pageA.locator("table tbody tr").count()) === ref.cat.rede.filter((r) => r.uf === "RJ").length);
      await pageA.goto(`${BASE}/dashboard/rede?q=copacabana`);
      check("rede: busca por texto", (await pageA.locator("table tbody tr").count()) === 1);
      await pageA.goto(`${BASE}/dashboard/rede?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E`);
      check("rede: busca com HTML não executa nem quebra", (await pageA.locator("table tbody tr").count()) === 0 && /Nenhum revendedor com esses filtros/.test(await texto(pageA)));
      await pageA.goto(`${BASE}/dashboard/rede`);
      await pageA.screenshot({ path: `${OUT}/04-rede-desktop.png`, fullPage: true });
    }

    await pageA.goto(`${BASE}/dashboard/catalogo`);
    {
      const t = await texto(pageA);
      check("catálogo: produto sem revendedor aparece sinalizado", /Sem revendedor/.test(t) && t.includes("TST-005"));
      check("catálogo: todos os produtos listados", (await pageA.locator("table").first().locator("tbody tr").count()) === ref.cat.produtos.length);
      await pageA.screenshot({ path: `${OUT}/05-catalogo-desktop.png`, fullPage: true });
    }

    await pageA.goto(`${BASE}/dashboard/importacoes`);
    {
      check("importações: lote com status e contagem", /Com pendências/.test(await texto(pageA)) && /48 linhas lidas/.test(await texto(pageA)));
      await pageA.locator("details summary").first().click();
      check("importações: detalhe mostra erro e aviso para corrigir", /CEP inválido/.test(await texto(pageA)) && /AVISO/.test(await texto(pageA)));
      await pageA.screenshot({ path: `${OUT}/06-importacoes-desktop.png`, fullPage: true });
    }

    await pageA.goto(`${BASE}/dashboard/widget`);
    {
      const t = await texto(pageA);
      check("widget: cliente em teste explica por que não atende o público", /Ainda não atende o público/.test(t) && /A pré-visualização aparece quando a sua marca estiver ativa/.test(t));
      check("widget: snippet usa o slug do cliente", /<geolynq-widget tenant="fabrica-teste">/.test(t));
      await pageA.screenshot({ path: `${OUT}/07-widget-desktop.png`, fullPage: true });
    }
    check("sem erros de JS ao navegar pelas telas (usuário A)", errosA.length === 0, errosA.join(" | "));

    // sair
    await pageA.goto(`${BASE}/dashboard`);
    await Promise.all([pageA.waitForURL(/\/login/), pageA.locator("aside button", { hasText: "Sair" }).click()]);
    await pageA.goto(`${BASE}/dashboard`);
    check("sair: encerra a sessão e /dashboard volta a pedir login", /\/login/.test(pageA.url()));
    await ctxA.close();

    // ───────────────────────────── 3. mobile (usuário A)
    {
      const ctx = await novoContexto({ width: 390, height: 844 });
      const page = await ctx.newPage();
      const erros = comLog(page);
      await entrar(page, "a@example.invalid");
      await page.waitForSelector(".leaflet-container", { timeout: 15000 }).catch(() => {});
      let ok = true;
      const estouros = [];
      for (const rota of ["/dashboard", "/dashboard/lacunas", "/dashboard/rede", "/dashboard/catalogo", "/dashboard/importacoes", "/dashboard/widget"]) {
        await page.goto(`${BASE}${rota}`);
        await page.waitForTimeout(250);
        const largura = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
        if (largura.sw > largura.iw + 1) {
          ok = false;
          estouros.push(`${rota} (${largura.sw}>${largura.iw})`);
        }
        if (rota === "/dashboard") await page.screenshot({ path: `${OUT}/08-visao-geral-mobile.png`, fullPage: true });
        if (rota === "/dashboard/rede") await page.screenshot({ path: `${OUT}/09-rede-mobile.png`, fullPage: true });
      }
      check("mobile (390 px): nenhuma tela com rolagem horizontal da página", ok, estouros.join(", "));
      check("mobile: menu de seções disponível", (await page.locator('header nav[aria-label="Seções do painel"] a').count()) === 6);
      check("sem erros de JS no mobile", erros.length === 0, erros.join(" | "));
      await page.goto(`${BASE}/login`);
      await ctx.close();
      const ctx2 = await novoContexto({ width: 390, height: 844 });
      const p2 = await ctx2.newPage();
      await p2.goto(`${BASE}/login`);
      await p2.screenshot({ path: `${OUT}/10-login-mobile.png`, fullPage: true });
      await ctx2.close();
    }

    // ───────────────────────────── 4. usuário de OUTRO cliente (demo, ativo): vê só o dele
    {
      const ctx = await novoContexto();
      const page = await ctx.newPage();
      const erros = comLog(page);
      await entrar(page, "b@example.invalid");
      const t = await texto(page);
      check("outro cliente: vê o próprio nome e 'Ativo'", /GeoLynq Demo/.test(t) && /Ativo/.test(t) && !/Fábrica Teste/.test(t));
      check("outro cliente (sem dado simulado): NÃO mostra a faixa de demonstração", (await page.locator('[role="note"]', { hasText: "Dados de demonstração" }).count()) === 0);
      const base = page.locator('[role="note"]', { hasText: "Base pequena" });
      check("aviso 'Base pequena' com 5 buscas", (await base.count()) === 1 && /5 buscas neste período/.test(await base.innerText()), await base.innerText().then((x) => x.replace(/\s+/g, " ").slice(0, 110)));
      check("manchete NÃO diz que está tudo coberto quando nenhuma busca bateu com produto", /Nenhuma das 5 buscas bateu com um produto do catálogo/.test(t) && !/Todas as buscas com produto encontraram/.test(t), await page.locator("h2").first().innerText().then((x) => x.replace(/\s+/g, " ")));
      check("aviso sugere 90 dias quando o período é menor", /90 dias/.test(await base.innerText()));
      await page.screenshot({ path: `${OUT}/13-demo-base-pequena.png`, fullPage: true });
      await page.goto(`${BASE}/dashboard?dias=90`);
      check("no período de 90 dias o aviso não repete a sugestão de 90 dias", !/90 dias dá/.test(await texto(page)) && (await page.locator('[role="note"]', { hasText: "Base pequena" }).count()) === 1);
      await page.goto(`${BASE}/dashboard/lacunas`);
      check("aviso de base pequena também na tela de lacunas", (await page.locator('[role="note"]', { hasText: "Base pequena" }).count()) === 1);
      await page.goto(`${BASE}/dashboard`);
      await page.goto(`${BASE}/dashboard/rede`);
      check("outro cliente: rede vazia (não vê os revendedores do cliente A)", !(await texto(page)).includes("Exemplo"));
      await page.goto(`${BASE}/dashboard/widget`);
      check("cliente ativo: pré-visualização do widget presente", (await page.locator("geolynq-widget").count()) === 1);
      await page.screenshot({ path: `${OUT}/11-demo-widget-desktop.png`, fullPage: true });
      check("sem erros de JS (usuário B)", erros.length === 0, erros.join(" | "));
      await ctx.close();
    }

    // ───────────────────────────── 5. usuário sem cliente vinculado
    {
      const ctx = await novoContexto();
      const page = await ctx.newPage();
      await entrar(page, "c@example.invalid");
      check("sem vínculo: mensagem clara em vez de tela quebrada", /ainda não está ligada a uma marca/.test(await texto(page)));
      await page.screenshot({ path: `${OUT}/12-sem-vinculo.png` });
      await ctx.close();
    }
  } catch (e) {
    check("execução do E2E sem exceção", false, e.stack || String(e));
    console.log("--- log do Next ---\n" + nextLog.slice(-2000));
  } finally {
    if (browser) await browser.close();
    try {
      const c = new Client({ connectionString: process.env.DATABASE_URL || "postgres://e2e:e2e@127.0.0.1:5432/geolynq_test" });
      await c.connect();
      await c.query("delete from public.widget_events where session_id like 'e2e-%'");
      await c.end();
    } catch {}
    next.kill();
    mock.server.close();
  }

  const falhas = resultados.filter((x) => !x).length;
  console.log(`\n${resultados.length - falhas}/${resultados.length} verificações passaram. Capturas em ${OUT}`);
  process.exit(falhas ? 1 : 0);
})();
