/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
/**
 * E2E do painel em Chromium real, contra o servidor Next de produção (next start) e o mini-Supabase de e2e/mock-supabase.cjs
 * (relatórios vindos das funções SQL reais num Postgres local, com RLS).
 *
 * Pré-requisitos (ver supabase/tests/README.md): Postgres local com schema + migrations + 02_fixture + 03_eventos_simulados
 * + 11_eventos_funil_simulados (psql -v slug=fabrica-teste -v prefix=seed-); a IA é simulada por um servidor local (startIA),
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
const http = require("http");
const { start: startMock } = require("./mock-supabase.cjs");

// Modelo simulado (API de mensagens): devolve uma leitura com números tirados dos próprios dados recebidos, ou uma com número inventado.
const ia = { modo: "boa", chamadas: [] };
function startIA() {
  const srv = http.createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      const corpo = JSON.parse(b);
      ia.chamadas.push({ chave: req.headers["x-api-key"], corpo });
      const dados = JSON.parse(corpo.messages[0].content.replace(/^DADOS DO PERÍODO \(JSON\):\n/, ""));
      const texto = JSON.stringify(
        ia.modo === "boa"
          ? {
              resumo: `Foram ${dados.buscas} buscas em ${dados.periodo_dias} dias e ${dados.buscas_sem_revendedor_a_100_km} ficaram sem revendedor por perto.`,
              destaques: [{ titulo: "Lacuna principal", texto: `${dados.maiores_lacunas[0].produto} em ${dados.maiores_lacunas[0].cidade} teve ${dados.maiores_lacunas[0].buscas} buscas sem loja por perto.` }],
              acoes: [{ acao: `Prospecte revendedor em ${dados.maiores_lacunas[0].cidade}.`, motivo: `Foram ${dados.maiores_lacunas[0].buscas} buscas sem loja por perto.` }],
            }
          : { resumo: "As buscas cresceram 7777% no período.", destaques: [], acoes: [{ acao: "Faça algo.", motivo: "Motivo." }] },
      );
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ content: [{ type: "text", text: texto }], usage: { input_tokens: 10, output_tokens: 5 } }));
    });
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv)));
}

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
  const gaps30 = (await db.query("select public.panel_gaps($1::uuid, 30) j", [t])).rows[0].j;
  const recentes = (await db.query("select public.panel_recent($1::uuid, 10) j", [t])).rows[0].j;
  const perf = (await db.query("select public.panel_resellers($1::uuid, 30) j", [t])).rows[0].j;
  const funil = (await db.query("select public.panel_funnel($1::uuid, 30) j", [t])).rows[0].j;
  const totalEventos = (await db.query("select count(*)::int n from public.widget_events where tenant_id=$1::uuid", [t])).rows[0].n;
  const simulados = (await db.query("select count(*)::int n from public.widget_events where tenant_id=$1::uuid and session_id like 'seed-%'", [t])).rows[0].n;
  await db.query("rollback");
  await db.end();
  return { ov, ov7, cat, recentes, perf, gaps30, funil, totalEventos, simulados };
}

(async () => {
  const mock = await startMock(54321);
  const iaSrv = await startIA();
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
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      ANTHROPIC_API_KEY: "chave-e2e-nao-secreta",
      ANTHROPIC_MODEL: "modelo-e2e",
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${iaSrv.address().port}`,
    },
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
    await dbSeed.query("delete from public.panel_ai_readings");
    await dbSeed.query("delete from public.reseller_candidates where nome_fantasia like 'E2E %'");
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
      const ultimas = pageA.locator("section", { has: pageA.locator("h2", { hasText: "Atividade ao vivo" }) });
      check("ao vivo: 'Atividade ao vivo' lista os 10 eventos mais recentes do banco", (await ultimas.locator("li").count()) === ref.recentes.length && ref.recentes.length === 10, `${await ultimas.locator("li").count()} de ${ref.recentes.length}`);
      const ordem = await pageA.evaluate(() => {
        const topo = (t) => { const el = [...document.querySelectorAll("p, h2")].find((x) => x.textContent.trim().startsWith(t)); return el ? el.getBoundingClientRect().top + scrollY : null; };
        return { radar: topo("O que o radar achou"), vivo: topo("Atividade ao vivo"), kpi: topo("Buscas no widget") };
      });
      check("ordem do painel: 'Atividade ao vivo' vem logo depois de 'O que o radar achou' e antes dos números", ordem.radar != null && ordem.radar < ordem.vivo && ordem.vivo < ordem.kpi, JSON.stringify(ordem));
      const primeiro = ref.recentes[0];
      const txtU = await ultimas.innerText();
      const esperadoPrimeiro = { list_open: "Abriu a lista de revendedores", list_search: "Filtrou a lista de revendedores" }[primeiro.tipo] ?? (primeiro.tipo === "reseller_click" ? primeiro.revendedor : null) ?? primeiro.produto ?? primeiro.termo ?? "~~";
      check("ao vivo: o evento mais recente aparece com o produto, o termo ou o passo certo", txtU.includes(esperadoPrimeiro), `${primeiro.tipo}: ${esperadoPrimeiro}`);
      // funil de uso (vem de panel_funnel; conferido contra o banco)
      const fu = ref.funil;
      const cartaoFunil = pageA.locator("section", { has: pageA.locator("h2", { hasText: "Como as pessoas usam o localizador" }) });
      check("funil: cartão aparece com os dois caminhos e os termos digitados", (await cartaoFunil.count()) === 1 && (await cartaoFunil.locator("[data-etapa]").count()) === 7 && (await cartaoFunil.locator("h3", { hasText: "O que as pessoas digitam" }).count()) === 1);
      const valorEtapa = async (rotulo, n = 0) => Number((await cartaoFunil.locator(`[data-etapa="${rotulo}"]`).nth(n).locator(".font-display").innerText()).replace(/\D/g, ""));
      check("funil: caminho pelo produto bate com o banco", (await valorEtapa("Escolheram um produto")) === fu.produto.escolheram && (await valorEtapa("Informaram onde estão")) === fu.produto.localizacao && (await valorEtapa("Havia revendedor por perto")) === fu.produto.com_revendedor && (await valorEtapa("Foram até um revendedor", 0)) === fu.produto.clicaram, JSON.stringify(fu.produto));
      check("funil: caminho pela lista bate com o banco", (await valorEtapa("Abriram a lista")) === fu.lista.abriram && (await valorEtapa("Filtraram")) === fu.lista.filtraram && (await valorEtapa("Foram até um revendedor", 1)) === fu.lista.clicaram, JSON.stringify(fu.lista));
      check("funil: o termo mais digitado aparece com o total do banco", (await cartaoFunil.innerText()).includes(fu.termos[0].termo) && (await cartaoFunil.innerText()).includes(String(fu.termos[0].buscas)), `${fu.termos[0].termo} = ${fu.termos[0].buscas}`);
      check("funil: o que não achou produto vem marcado 'fora do catálogo'", fu.termos.some((x) => !x.achou) ? (await cartaoFunil.innerText()).includes("fora do catálogo") : true);
      check("ao vivo: eventos de navegação aparecem com o rótulo 'Navegação'", ref.recentes.some((e) => ["catalog_search", "product_select", "list_open", "list_search"].includes(e.tipo)) ? (await ultimas.locator("li", { hasText: "Navegação" }).count()) > 0 : true);
      // ---- Leitura do período por IA (modelo simulado; números conferidos contra os dados)
      const cartaoIA = pageA.locator("section", { has: pageA.locator("h2", { hasText: "Leitura do período" }) });
      check("IA: cartão 'Leitura do período' aparece (chave configurada) e ainda sem leitura", (await cartaoIA.count()) === 1 && (await cartaoIA.locator("[data-leitura]").count()) === 0 && (await cartaoIA.locator("button", { hasText: "Gerar leitura" }).count()) === 1);
      await Promise.all([pageA.waitForLoadState("networkidle").catch(() => {}), cartaoIA.locator("button", { hasText: "Gerar leitura" }).click()]);
      await pageA.waitForSelector("[data-leitura]", { timeout: 15000 });
      const txIA = await cartaoIA.innerText();
      const dadosEnviados = JSON.parse(ia.chamadas[0].corpo.messages[0].content.replace(/^DADOS DO PERÍODO \(JSON\):\n/, ""));
      check("IA: mostra a leitura, com os números do banco (buscas e buscas sem revendedor)", txIA.includes(`Foram ${ref.ov.kpis.buscas} buscas`) && txIA.includes(`${ref.ov.kpis.sem_cobertura} ficaram sem revendedor`), txIA.replace(/\s+/g, " ").slice(0, 160));
      check("IA: os dados enviados ao modelo são os do banco; a chave vai só no cabeçalho do servidor", dadosEnviados.buscas === ref.ov.kpis.buscas && dadosEnviados.funil.escolheram_produto === ref.funil.produto.escolheram && ia.chamadas[0].chave === "chave-e2e-nao-secreta" && !(await pageA.content()).includes("chave-e2e-nao-secreta"));
      check("IA: a leitura foi guardada no banco (1 linha) e some o botão de 'primeira leitura'", Number((await dbSeed.query("select count(*) n from public.panel_ai_readings where tenant_id=(select id from public.tenants where slug='fabrica-teste')")).rows[0].n) === 1 && (await cartaoIA.locator("button", { hasText: "Gerar nova leitura" }).count()) === 1);
      await pageA.reload({ waitUntil: "networkidle" });
      check("IA: ao recarregar mostra a mesma leitura sem chamar o modelo de novo", (await cartaoIA.locator("[data-leitura]").count()) === 1 && ia.chamadas.length === 1);
      await Promise.all([pageA.waitForURL(/ia=limite/, { timeout: 15000 }), cartaoIA.locator("button", { hasText: "Gerar nova leitura" }).click()]);
      await cartaoIA.locator("[role=alert]").waitFor({ timeout: 15000 });
      check("IA: segunda leitura logo em seguida é barrada ANTES de gastar o modelo", /Já foi gerada uma leitura há pouco/.test(await cartaoIA.innerText()) && ia.chamadas.length === 1, `chamadas=${ia.chamadas.length} | ${(await cartaoIA.innerText()).replace(/\s+/g, " ").slice(0, 200)} | ${pageA.url()}`);
      await dbSeed.query("update public.panel_ai_readings set created_at = now() - interval '10 minutes'");
      ia.modo = "inventada";
      await Promise.all([pageA.waitForURL(/ia=nao_confiavel/, { timeout: 30000 }), cartaoIA.locator("button", { hasText: "Gerar nova leitura" }).click()]);
      await cartaoIA.locator("[role=alert]").waitFor({ timeout: 15000 });
      const txRuim = await cartaoIA.innerText();
      check("IA: número inventado pelo modelo é descartado (2 tentativas) e NÃO aparece na tela", /descartada por segurança/.test(txRuim) && !(await cartaoIA.locator("[data-leitura]").innerText()).includes("7777") && ia.chamadas.length === 3, `chamadas=${ia.chamadas.length}`);
      check("IA: a leitura boa anterior continua na tela e nada novo foi gravado", (await cartaoIA.locator("[data-leitura]").count()) === 1 && Number((await dbSeed.query("select count(*) n from public.panel_ai_readings")).rows[0].n) === 1);
      ia.modo = "boa";
      const quem = pageA.locator("section", { has: pageA.locator("h2", { hasText: "Quem gera contato" }) });
      const topPerf = ref.perf.filter((r) => r.contatos > 0)[0];
      const txtQ = await quem.innerText();
      check("desempenho: o revendedor que mais gera contato vem primeiro, com o nº do banco", txtQ.indexOf(topPerf.nome) >= 0 && txtQ.includes(String(topPerf.contatos)), `${topPerf.nome} = ${topPerf.contatos}`);
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


    // ---- períodos de calendário: hoje, semana, mês, ano e personalizado (a tela confere com a contagem direta no banco)
    {
      await dbSeed.query(`delete from public.widget_events where session_id like 'e2e-per-%'`);
      await dbSeed.query(`insert into public.widget_events (tenant_id, session_id, event_type, query_text, results_count, telemetry_v, created_at)
        select (select id from public.tenants where slug='fabrica-teste'), 'e2e-per-' || g, 'search', 'whey', 1, 2, now() - (g || ' minutes')::interval from generate_series(1, 3) g`);
      const BRT = "'America/Sao_Paulo'";
      const inicio = (u) => `(date_trunc('${u}', now() at time zone ${BRT}) at time zone ${BRT})`;
      const contar = async (de, ate) =>
        Number((await dbSeed.query(`select count(*)::int n from public.widget_events where tenant_id=(select id from public.tenants where slug='fabrica-teste') and event_type='search' and created_at >= ${de} and created_at < ${ate}`)).rows[0].n);
      const kpiBuscas = async () => {
        const t = await texto(pageA);
        const m = t.match(/Buscas no widget\s+([\d.]+)/);
        return m ? Number(m[1].replace(/\./g, "")) : /Ainda não há buscas/.test(t) ? 0 : null;
      };
      const ativoNoMenu = () => pageA.locator("details > summary").innerText().then((x) => x.replace(/\s+/g, " ").trim());
      const abrir = async (query) => {
        await pageA.goto(`${BASE}/dashboard?${query}`);
        return texto(pageA);
      };

      const casos = [
        ["hoje", "Hoje", inicio("day"), "now()"],
        ["semana", "Esta semana", inicio("week"), "now()"],
        ["semana-passada", "Semana passada", `(${inicio("week")} - interval '7 days')`, inicio("week")],
        ["mes", "Este mês", inicio("month"), "now()"],
        ["mes-passado", "Mês anterior", `(${inicio("month")} - interval '1 month')`, inicio("month")],
        ["ano", "Este ano", inicio("year"), "now()"],
      ];
      for (const [chave, rotulo, de, ate] of casos) {
        const t = await abrir(`p=${chave}`);
        const esperado = await contar(de, ate);
        const obtido = await kpiBuscas();
        check(`período ${rotulo}: buscas da tela = contagem direta no banco`, obtido === esperado, `tela=${obtido} banco=${esperado}`);
        check(`período ${rotulo}: subtítulo e menu mostram o período`, t.includes(rotulo) && (await ativoNoMenu()).startsWith(rotulo.replace(/ \(.*\)$/, "")), (await ativoNoMenu()));
        check(`período ${rotulo}: nenhuma aba de 7/30/90 marcada`, (await pageA.locator('nav[aria-label="Período"] a[aria-current="true"]').count()) === 0);
      }
      {
        const t = await abrir("p=hoje");
        check("hoje: o gráfico é por hora (e traz as buscas de hoje)", (await pageA.locator('svg[aria-label^="Buscas e cliques por hora"]').count()) === 1 && /Buscas por hora/.test(t) && (await kpiBuscas()) >= 3);
        check("hoje: a comparação é com ontem até a mesma hora", /comparado com ontem, até a mesma hora/.test(t));
        const t2 = await abrir("p=mes");
        check("este mês: o gráfico é por dia e a comparação usa os mesmos dias do mês anterior", (await pageA.locator('svg[aria-label^="Buscas e cliques por dia"]').count()) === 1 && /mesmos dias do mês anterior/.test(t2));
      }

      // personalizado: de 10 a 5 dias atrás (datas de calendário de Brasília)
      const d = (await dbSeed.query(`select to_char((now() at time zone ${BRT})::date - 10, 'YYYY-MM-DD') de, to_char((now() at time zone ${BRT})::date - 5, 'YYYY-MM-DD') ate`)).rows[0];
      await abrir(`p=personalizado&de=${d.de}&ate=${d.ate}`);
      const esperadoPers = await contar(`('${d.de}'::timestamp at time zone ${BRT})`, `(('${d.ate}'::date + 1)::timestamp at time zone ${BRT})`);
      check("período personalizado: buscas da tela = contagem direta (início e fim inclusivos)", (await kpiBuscas()) === esperadoPers && esperadoPers > 0, `tela=${await kpiBuscas()} banco=${esperadoPers}`);
      check("período personalizado: o menu mostra dd/mm a dd/mm e o formulário vem preenchido", /\d\d\/\d\d a \d\d\/\d\d/.test(await ativoNoMenu()) && (await pageA.locator('details input[name="de"]').inputValue()) === d.de && (await pageA.locator('details input[name="ate"]').inputValue()) === d.ate);

      // pedido inválido não derruba a página
      let t = await abrir("p=personalizado&de=2026-13-45&ate=abc");
      check("personalizado inválido: explica e cai em 30 dias", /Datas inválidas/.test(t) && (await pageA.locator('nav[aria-label="Período"] a[aria-current="true"]').innerText()) === "30 dias");
      t = await abrir(`p=personalizado&de=${d.ate}&ate=${d.de}`);
      check("personalizado com início depois do fim: explica e cai em 30 dias", /não pode ser depois/.test(t));
      t = await abrir("p=qualquer-coisa");
      check("período desconhecido cai em 30 dias, sem erro", (await pageA.locator('nav[aria-label="Período"] a[aria-current="true"]').innerText()) === "30 dias" && !/Datas inválidas/.test(t));

      // navegação pelo menu e pelo formulário (sem JavaScript do painel: link e GET)
      await pageA.goto(`${BASE}/dashboard`);
      await pageA.locator("details > summary").click();
      await pageA.screenshot({ path: `${OUT}/14-menu-periodos-desktop.png`, clip: { x: 0, y: 0, width: 1440, height: 520 } });
      await Promise.all([pageA.waitForURL(/p=semana-passada/, { timeout: 15000 }), pageA.locator('details a', { hasText: "Semana passada" }).click()]);
      await pageA.waitForFunction(() => /Semana passada, comparados com a semana anterior/.test(document.body.innerText), null, { timeout: 15000 });
      check("menu: clicar em 'Semana passada' leva ao período certo (subtítulo da página nova)", true);
      await pageA.locator("details > summary").click();
      await pageA.locator('details input[name="de"]').waitFor({ state: "visible", timeout: 15000 });
      await pageA.locator('details input[name="de"]').fill(d.de);
      await pageA.locator('details input[name="ate"]').fill(d.ate);
      await Promise.all([pageA.waitForURL(/p=personalizado/, { timeout: 15000 }), pageA.locator('details form button[type="submit"]').click()]);
      check("formulário de datas: aplica o período e mostra o mesmo número do banco", pageA.url().includes(`de=${d.de}`) && pageA.url().includes(`ate=${d.ate}`) && (await kpiBuscas()) === esperadoPers);

      // lacunas e CSV respeitam o período; o filtro de estado não perde o período
      await pageA.goto(`${BASE}/dashboard/lacunas?p=mes`);
      check("lacunas: o texto cita o período escolhido", /no período \(este mês\)/.test(await texto(pageA)) || /Nenhuma lacuna/.test(await texto(pageA)));
      const ufX = await pageA.locator('select[name="uf"] option').nth(1).getAttribute("value").catch(() => null);
      if (ufX) {
        await Promise.all([pageA.waitForURL(/uf=/, { timeout: 15000 }), pageA.locator("select[name=uf]").selectOption(ufX).then(() => pageA.click("main form[method=get]:has(select[name=uf]) button[type=submit]"))]);
        check("lacunas: filtrar por estado mantém o período (?p=mes)", pageA.url().includes("p=mes"), pageA.url());
      }
      const baixarCsv = (u) => pageA.evaluate(async (url) => { const x = await fetch(url); return { status: x.status, anexo: x.headers.get("content-disposition") }; }, u);
      const csv = await baixarCsv(`${BASE}/dashboard/lacunas/export?p=mes`);
      check("CSV de lacunas: nome do arquivo traz o período", csv.status === 200 && /lacunas-fabrica-teste-mes\.csv/.test(csv.anexo || ""), `${csv.status} ${csv.anexo}`);
      const csv7 = await baixarCsv(`${BASE}/dashboard/lacunas/export?dias=7`);
      check("CSV de lacunas: o link antigo (?dias=7) continua funcionando", csv7.status === 200 && /lacunas-fabrica-teste-7d\.csv/.test(csv7.anexo || ""), `${csv7.status} ${csv7.anexo}`);

      // leitura de IA: vale só para o período em que foi gerada e só por 24 h
      await abrir("p=mes");
      const cartao = pageA.locator("section", { has: pageA.locator("h2", { hasText: "Leitura do período" }) });
      check("IA: a leitura do período de 30 dias não aparece em 'Este mês'", (await cartao.locator("[data-leitura]").count()) === 0 && (await cartao.locator("button", { hasText: "Gerar leitura" }).count()) === 1);
      await dbSeed.query("update public.panel_ai_readings set created_at = now() - interval '25 hours'");
      await abrir("p=30d");
      check("IA: leitura com mais de 24 horas não é mais exibida (não comenta dado antigo)", (await cartao.locator("[data-leitura]").count()) === 0 && (await cartao.locator("button", { hasText: "Gerar leitura" }).count()) === 1);
      await dbSeed.query("update public.panel_ai_readings set created_at = now() - interval '10 minutes'");
      await abrir("p=30d");
      check("IA: leitura recente do mesmo período volta a aparecer", (await cartao.locator("[data-leitura]").count()) === 1 && /do período “Últimos 30 dias”/.test(await cartao.innerText()));

      await dbSeed.query(`delete from public.widget_events where session_id like 'e2e-per-%'`);
    }

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
      check("lacunas: sem candidatos carregados, diz que ainda não há (sem prometer o que não existe)", /Ainda não há candidatos para estas cidades/.test(await texto(pageA)));
      await pageA.screenshot({ path: `${OUT}/03-lacunas-desktop.png`, fullPage: true });

      // candidatos a revendedor: 4 na cidade com mais buscas sem revendedor (a Receita grava em MAIÚSCULAS e sem acento)
      const somaCidade = new Map();
      for (const l of ref.gaps30.itens) if (l.uf) somaCidade.set(`${l.uf}|${l.cidade}`, (somaCidade.get(`${l.uf}|${l.cidade}`) || 0) + l.buscas);
      const [topUf, topCidade] = [...somaCidade.entries()].sort((a, b) => b[1] - a[1])[0][0].split("|");
      const top = { uf: topUf, cidade: topCidade };   // a cidade com mais buscas sem revendedor é a primeira (e a única aberta) do cartão
      const semAcento = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      const T = (await dbSeed.query("select id from public.tenants where slug='fabrica-teste'")).rows[0].id;
      const cnpjsCand = [["19283746000188", "E2E Alfa Suplementos", 40], ["86420975000194", "E2E Beta Academia", 30], ["24681012000197", "E2E Gama Nutrição", 20], ["13579113000135", "E2E Delta Esportes", 10]];
      for (const [cnpj, nome, score] of cnpjsCand)
        await dbSeed.query("insert into public.reseller_candidates (tenant_id, cnpj, nome_fantasia, cnae, uf, municipio, bairro, cep, score) values ($1,$2,$3,'4763602',$4,$5,'Centro','11060001',$6)", [T, cnpj, nome, top.uf, semAcento(top.cidade), score]);
      // endereço e contato do primeiro candidato (os outros ficam sem telefone/e-mail para testar o "sem telefone cadastrado")
      await dbSeed.query("update public.reseller_candidates set logradouro='AVENIDA ANA COSTA', numero='100', complemento='SALA 2', telefone='13999990000', email='alfa@exemplo.com.br' where cnpj='19283746000188' and tenant_id=$1", [T]);
      await pageA.goto(`${BASE}/dashboard/lacunas`);
      const txtCand = await texto(pageA);
      check("candidatos: o cartão mostra a cidade da maior lacuna e 4 em aberto", /Candidatos a revendedor/.test(txtCand) && new RegExp(`${top.cidade}[\\s\\S]{0,60}4 candidatos em aberto`).test(txtCand), top.cidade);
      check("candidatos: lista os 4 pelo nome fantasia, maior aderência primeiro", (await pageA.locator("[data-candidato]").evaluateAll((els) => els.map((e) => e.querySelector("p").textContent))).join("|") === "E2E Alfa Suplementos|E2E Beta Academia|E2E Gama Nutrição|E2E Delta Esportes");
      check("candidatos: avisa que não sabemos se já vendem e que telefone/e-mail são os cadastrais (site não consta)", /não sabemos se já vendem/.test(txtCand) && /telefone e e-mail cadastrais/.test(txtCand) && /Site não consta na Receita/.test(txtCand));
      check("candidatos: CNPJ formatado e CEP com hífen", /19\.283\.746\/0001-88/.test(txtCand) && /11060-001/.test(txtCand));
      const alfa = pageA.locator('[data-candidato="19283746000188"]');
      check("candidatos: mostra endereço, telefone formatado (link tel:) e e-mail (link mailto:)",
        /AVENIDA ANA COSTA, 100, SALA 2/.test(await alfa.locator("[data-endereco]").innerText()) && (await alfa.locator('a[href="tel:+5513999990000"]').innerText()) === "(13) 99999-0000" && (await alfa.locator('a[href="mailto:alfa@exemplo.com.br"]').count()) === 1);
      check("candidatos: quem não tem telefone mostra 'Sem telefone cadastrado'", /Sem telefone cadastrado/.test(await pageA.locator('[data-candidato="86420975000194"] [data-contato]').innerText()));
      const hrefG = await alfa.locator("a", { hasText: "Pesquisar no Google" }).getAttribute("href");
      const hrefM = await alfa.locator("a", { hasText: "Ver no mapa" }).getAttribute("href");
      check("candidatos: links de pesquisa abrem em outra aba, sem referência, com nome e cidade", /^https:\/\/www\.google\.com\/search\?q=E2E%20Alfa%20Suplementos/.test(hrefG) && /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=AVENIDA%20ANA%20COSTA/.test(hrefM) && (await alfa.locator('a[target="_blank"][rel~="noopener"]').count()) === 2, hrefG);
      await pageA.screenshot({ path: `${OUT}/16-lacunas-candidatos-desktop.png`, fullPage: true });
      // o dono marca "Contatado" e depois "Sem interesse"
      const linhaAlfa = pageA.locator('[data-candidato="19283746000188"]');
      await linhaAlfa.locator("select").selectOption("contatado");
      await Promise.all([pageA.waitForURL(/#candidatos|\/dashboard\/lacunas/), linhaAlfa.locator("button", { hasText: "Salvar" }).click()]);
      for (let i = 0; i < 40; i++) {
        if ((await dbSeed.query("select status from public.reseller_candidates where cnpj='19283746000188'")).rows[0].status === "contatado") break;
        await pageA.waitForTimeout(150);
      }
      await pageA.waitForLoadState("networkidle").catch(() => {});
      const stAlfa = (await dbSeed.query("select status, status_por from public.reseller_candidates where cnpj='19283746000188'")).rows[0];
      check("candidatos: marcar 'Contatado' grava no banco com quem marcou", stAlfa.status === "contatado" && !!stAlfa.status_por, JSON.stringify(stAlfa));
      check("candidatos: a tela volta com o novo andamento selecionado e o período preservado", (await pageA.locator('[data-candidato="19283746000188"] select').inputValue()) === "contatado" && /\/dashboard\/lacunas\?/.test(pageA.url()), pageA.url());
      await pageA.locator('[data-candidato="86420975000194"] select').selectOption("sem_interesse");
      await pageA.locator('[data-candidato="86420975000194"] button', { hasText: "Salvar" }).click();
      for (let i = 0; i < 40; i++) {
        if ((await dbSeed.query("select status from public.reseller_candidates where cnpj='86420975000194'")).rows[0].status === "sem_interesse") break;
        await pageA.waitForTimeout(150);
      }
      await pageA.goto(`${BASE}/dashboard/lacunas`);
      check("candidatos: 'Sem interesse' tira da contagem de em aberto (4 → 3)", new RegExp(`${top.cidade}[\\s\\S]{0,60}3 candidatos em aberto`).test(await texto(pageA)));
      // volta tudo para 'novo' (a limpeza final apaga os candidatos E2E)
      await dbSeed.query("update public.reseller_candidates set status='novo' where nome_fantasia like 'E2E %'");
      await pageA.goto(`${BASE}/dashboard/lacunas`);
      await pageA.screenshot({ path: `${OUT}/16b-lacunas-candidatos-reset.png`, fullPage: false });

      // ---- página Candidatos: filtros, paginação, exportação e retorno com os filtros
      // 56 candidatos extras (cidade fictícia "E2E Cidade") para passar de uma página de 50
      const cnpjDv = (b12) => { const calc = (v) => { let w = 2, t = 0; for (let i = v.length - 1; i >= 0; i--) { t += v[i] * w; w = w < 9 ? w + 1 : 2; } const r = t % 11; return r < 2 ? 0 : 11 - r; }; const v = [...b12].map((ch) => ch.charCodeAt(0) - 48); const d1 = calc(v); const d2 = calc([...v, d1]); return b12 + d1 + d2; };
      for (let i = 0; i < 56; i++)
        await dbSeed.query("insert into public.reseller_candidates (tenant_id, cnpj, nome_fantasia, cnae, uf, municipio, bairro, cep, score) values ($1,$2,$3,'9313100','MG','E2E CIDADE','Centro','30000000',$4)", [T, cnpjDv("9990" + String(i).padStart(4, "0") + "0001"), `E2E Extra ${String(i).padStart(2, "0")}`, 5]);
      check("menu lateral: tem o item 'Candidatos'", (await pageA.locator('nav a[href="/dashboard/candidatos"]').count()) >= 1);
      await pageA.goto(`${BASE}/dashboard/candidatos`);
      const tCand = await texto(pageA);
      check("candidatos (página): título com o total e aviso de que não sabemos se vendem", /60 candidatos/.test(tCand) && /não sabemos se a empresa já vende/i.test(tCand), (tCand.match(/\d+ candidatos?[^\n]*/) || [""])[0]);
      check("candidatos (página): 50 por página, com 'Página 1 de 2' e botão Próximos", (await pageA.locator("[data-lista-candidatos] > li").count()) === 50 && /Página 1 de 2/.test(tCand) && (await pageA.locator('a', { hasText: "Próximos" }).count()) === 1);
      await pageA.screenshot({ path: `${OUT}/18-candidatos-pagina-desktop.png`, fullPage: false });
      await pageA.locator('a', { hasText: "Próximos" }).click();
      await pageA.waitForURL(/pagina=2/);
      check("candidatos (página): a segunda página tem os 10 restantes", (await pageA.locator("[data-lista-candidatos] > li").count()) === 10 && /Página 2 de 2/.test(await texto(pageA)));
      // filtros
      const contar = async (qsx) => { await pageA.goto(`${BASE}/dashboard/candidatos?${qsx}`); return pageA.locator("[data-lista-candidatos] > li").count(); };
      check("candidatos (filtro): por estado", (await contar("uf=MG")) === 50 && /56 candidatos com esses filtros/.test(await texto(pageA)));
      check("candidatos (filtro): por cidade sem acento e sem caixa", (await contar(`uf=${top.uf}&cidade=${encodeURIComponent(top.cidade)}`)) === 4);
      check("candidatos (filtro): por atividade", (await contar("cnae=4763602")) === 4 && (await contar("cnae=9313100")) === 50);
      check("candidatos (filtro): por nome", (await contar("q=delta")) === 1 && (await contar("q=zzzz")) === 0);
      check("candidatos (filtro): por CNPJ com máscara", (await contar("q=19.283.746")) === 1);
      check("candidatos (filtro): por andamento 'em aberto'", (await contar("status=abertos&cnae=4763602")) === 4);
      check("candidatos (filtro): valor estranho na URL é ignorado, sem erro", (await contar("uf=%3Cscript%3E&cnae=abc&status=hack&pagina=-3")) === 50 && !/Erro|indispon/i.test((await texto(pageA)).slice(0, 400)));
      check("candidatos (filtro): 'Limpar' aparece só com filtro e os campos voltam preenchidos", (await pageA.goto(`${BASE}/dashboard/candidatos?q=delta`), (await pageA.locator('a', { hasText: "Limpar" }).count()) === 1 && (await pageA.locator('input[name="q"]').inputValue()) === "delta"));
      // marcar andamento na página e voltar com os filtros
      await pageA.goto(`${BASE}/dashboard/candidatos?q=delta&cnae=4763602`);
      await pageA.locator('[data-candidato="13579113000135"] select').selectOption("vende");
      await pageA.locator('[data-candidato="13579113000135"] button', { hasText: "Salvar" }).click();
      for (let i = 0; i < 40; i++) {
        if ((await dbSeed.query("select status from public.reseller_candidates where cnpj='13579113000135'")).rows[0].status === "vende") break;
        await pageA.waitForTimeout(150);
      }
      await pageA.waitForLoadState("networkidle").catch(() => {});
      check("candidatos (página): marcar 'Vende' grava e volta para a página com os filtros", /\/dashboard\/candidatos\?/.test(pageA.url()) && /q=delta/.test(pageA.url()) && /cnae=4763602/.test(pageA.url()), pageA.url());
      // exportação
      const baixarCorpo = (u) => pageA.evaluate(async (url) => { const x = await fetch(url); const buf = new Uint8Array(await x.clone().arrayBuffer()); return { status: x.status, anexo: x.headers.get("content-disposition"), bom: [...buf.slice(0, 3)].join(","), corpo: await x.text() }; }, u);
      const exp = await baixarCorpo(`${BASE}/dashboard/candidatos/export?cnae=4763602`);
      const linhasCsv = exp.corpo.replace(/^\uFEFF/, "").trim().split(/\r\n/);
      check("candidatos (CSV): arquivo com nome, BOM e cabeçalho esperado", exp.status === 200 && /candidatos-fabrica-teste-\d{4}-\d{2}-\d{2}\.csv/.test(exp.anexo || "") && exp.bom === "239,187,191" && linhasCsv[0] === "Nome fantasia;CNPJ;Atividade (CNAE);Descrição da atividade;Logradouro;Número;Complemento;Bairro;Cidade;UF;CEP;Telefone;E-mail;Andamento;Aderência", `${exp.status} ${exp.anexo} bom=${exp.bom} cab=${linhasCsv[0]}`);
      check("candidatos (CSV): traz só os filtrados (4 + cabeçalho) com endereço, telefone formatado e e-mail", linhasCsv.length === 5 && linhasCsv.some((l) => l.startsWith("E2E Alfa Suplementos;19.283.746/0001-88;4763602;") && /AVENIDA ANA COSTA;100;SALA 2;/.test(l) && /;\(13\) 99999-0000;alfa@exemplo\.com\.br;/.test(l)), `${linhasCsv.length} linhas`);
      check("candidatos (CSV): sem filtro exporta os 60", (await baixarCorpo(`${BASE}/dashboard/candidatos/export`)).corpo.replace(/^\uFEFF/, "").trim().split(/\r\n/).length === 61);
      await dbSeed.query("delete from public.reseller_candidates where nome_fantasia like 'E2E Extra %'");
      await dbSeed.query("update public.reseller_candidates set status='novo' where nome_fantasia like 'E2E %'");
      await pageA.goto(`${BASE}/dashboard/lacunas`);
      const g = ref.gaps30;
      check("lacunas: título e total vêm de panel_gaps (exato), não da soma truncada", new RegExp(`${g.combinacoes} combinações de produto e cidade`).test(await texto(pageA)) && (await texto(pageA)).includes(String(g.total_buscas)), `${g.combinacoes} combinações / ${g.total_buscas} buscas`);
      // filtro por estado
      const ufX = g.itens[0].uf;
      const esperadasUf = g.itens.filter((l) => l.uf === ufX);
      await pageA.selectOption("select[name=uf]", ufX);
      await Promise.all([pageA.waitForLoadState("networkidle").catch(() => {}), pageA.click("main form[method=get]:has(select[name=uf]) button[type=submit]")]);
      check("lacunas: filtro por estado mostra só as combinações do estado", (await pageA.locator("table tbody tr").count()) === esperadasUf.length && /\?.*uf=/.test(pageA.url()), `${ufX}: ${esperadasUf.length}`);
      check("lacunas: com filtro, o total mostra 'X de Y'", new RegExp(`${esperadasUf.reduce((a, l) => a + l.buscas, 0)} de ${g.total_buscas} buscas`).test(await texto(pageA)));
      // filtro por produto (sku) via URL
      const skuX = g.itens[0].sku;
      await pageA.goto(`${BASE}/dashboard/lacunas?produto=${encodeURIComponent(skuX)}`);
      check("lacunas: filtro por produto", (await pageA.locator("table tbody tr").count()) === g.itens.filter((l) => l.sku === skuX).length);
      await pageA.goto(`${BASE}/dashboard/lacunas?uf=%3Cb%3E&produto=%27%3B--`);
      check("lacunas: filtro com lixo na URL é ignorado (mostra tudo, sem quebrar)", (await pageA.locator("table tbody tr").count()) === g.itens.length);
      // exportação CSV: mesmos filtros da tela
      // o fetch roda DENTRO do navegador (usa os cookies httpOnly/Secure reais da sessão)
      const baixar = (url) =>
        pageA.evaluate(async (u) => {
          const x = await fetch(u);
          const bytes = new Uint8Array(await x.clone().arrayBuffer());
          return { status: x.status, tipo: x.headers.get("content-type"), anexo: x.headers.get("content-disposition"), texto: await x.text(), bom: bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf };
        }, url);
      const csvTodos = await baixar(`${BASE}/dashboard/lacunas/export?dias=30`);
      const linhasTodos = csvTodos.texto.split("\r\n").filter(Boolean);
      check("CSV: 200, tipo csv, anexo com nome do cliente", csvTodos.status === 200 && /text\/csv/.test(csvTodos.tipo) && /attachment; filename="lacunas-fabrica-teste-30d\.csv"/.test(csvTodos.anexo), `${csvTodos.status} ${csvTodos.tipo} ${csvTodos.anexo}`);
      check("CSV: BOM, cabeçalho e uma linha por combinação", csvTodos.bom && csvTodos.texto.startsWith("Produto;SKU;Cidade;UF;") && linhasTodos.length === g.combinacoes + 1, `${linhasTodos.length - 1} de ${g.combinacoes}`);
      const csvUf = await baixar(`${BASE}/dashboard/lacunas/export?dias=30&uf=${ufX}`);
      check("CSV: respeita o filtro de estado", csvUf.texto.split("\r\n").filter(Boolean).length === esperadasUf.length + 1);
      const { request: pwRequest } = require("playwright");
      const anon = await pwRequest.newContext();
      const semLogin = await anon.get(`${BASE}/dashboard/lacunas/export?dias=30`, { maxRedirects: 0 });
      check("CSV: sem login não entrega o arquivo", semLogin.status() !== 200 && !/text\/csv/.test(semLogin.headers()["content-type"] ?? ""), `status ${semLogin.status()}`);
      await anon.dispose();
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
      const somaContatos = await pageA.locator("table tbody tr td:last-child").evaluateAll((tds) => tds.reduce((a, td) => a + (parseInt(td.textContent.replace(/\D/g, ""), 10) || 0), 0));
      const esperadoContatos = ref.perf.reduce((a, r) => a + r.contatos, 0);
      check("rede: coluna 'Contatos (30 d)' soma o mesmo que o banco", /Contatos \(30 d\)/i.test(await texto(pageA)) && somaContatos === esperadoContatos && esperadoContatos > 0, `${somaContatos} de ${esperadoContatos}`);
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

    // seletor de cliente: com 1 vínculo não aparece; com 2 aparece e troca; slug de cliente alheio no cookie é ignorado
    await pageA.goto(`${BASE}/dashboard`);
    check("seletor de cliente: não aparece para quem tem 1 cliente", (await pageA.locator("aside select[name=cliente]").count()) === 0);
    await dbSeed.query("insert into public.tenant_users (tenant_id, user_id, role) select id, '00000000-0000-4000-8000-0000000000aa', 'viewer' from public.tenants where slug='demo' on conflict do nothing");
    await pageA.goto(`${BASE}/dashboard`);
    const sel = pageA.locator("aside select[name=cliente]");
    check("seletor de cliente: aparece para quem tem 2 clientes, com os 2", (await sel.count()) === 1 && (await sel.locator("option").count()) === 2);
    const nomeAtual = () => pageA.locator("aside p[title]").first().innerText();
    check("seletor de cliente: começa no primeiro vínculo (Fábrica Teste)", /Fábrica Teste/.test(await nomeAtual()));
    await Promise.all([pageA.waitForLoadState("networkidle").catch(() => {}), sel.selectOption("demo")]);
    await pageA.waitForTimeout(800);
    const tDemo = await nomeAtual();
    check("seletor de cliente: ao escolher, o painel passa a mostrar o outro cliente", /GeoLynq Demo/.test(tDemo) && !/Fábrica Teste/.test(tDemo), tDemo);
    await pageA.context().addCookies([{ name: "gl_cliente", value: "cliente-que-nao-existe", url: BASE }]);
    await pageA.goto(`${BASE}/dashboard`);
    check("seletor de cliente: slug que o usuário não possui no cookie é ignorado (volta ao primeiro vínculo)", /Fábrica Teste/.test(await nomeAtual()));
    await dbSeed.query("delete from public.tenant_users where user_id='00000000-0000-4000-8000-0000000000aa' and tenant_id=(select id from public.tenants where slug='demo')");

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
        if (rota === "/dashboard/lacunas") await page.screenshot({ path: `${OUT}/17-lacunas-mobile.png`, fullPage: true });
      }
      check("mobile (390 px): nenhuma tela com rolagem horizontal da página", ok, estouros.join(", "));
      // celular pequeno (320 px): o funil e as demais telas também não podem gerar rolagem lateral
      await page.setViewportSize({ width: 320, height: 640 });
      const estouros320 = [];
      for (const rota of ["/dashboard", "/dashboard?p=mes", "/dashboard/lacunas", "/dashboard/rede", "/dashboard/catalogo", "/dashboard/importacoes", "/dashboard/widget"]) {
        await page.goto(`${BASE}${rota}`);
        await page.waitForTimeout(250);
        const l320 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
        if (l320.sw > l320.iw + 1) estouros320.push(`${rota} (${l320.sw}>${l320.iw})`);
      }
      check("mobile pequeno (320 px): nenhuma tela com rolagem horizontal da página", estouros320.length === 0, estouros320.join(", "));
      await page.goto(`${BASE}/dashboard`);
      const visiveis320 = await page.locator("section", { has: page.locator("h2", { hasText: "Atividade ao vivo" }) }).locator("li:visible").count();
      check("mobile: 'Atividade ao vivo' mostra só os 5 eventos mais recentes", visiveis320 === 5, `${visiveis320} visíveis`);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${BASE}/dashboard?p=mes`);
      await page.locator("details > summary").click();
      await page.waitForTimeout(200);
      const lm = await page.evaluate(() => {
        const menu = document.querySelector("details > div");
        const r = menu ? menu.getBoundingClientRect() : null;
        return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, esq: r ? Math.round(r.left) : null, dir: r ? Math.round(r.right) : null };
      });
      check("mobile: menu de períodos aberto cabe na tela (sem rolagem lateral e sem sair pela borda)", lm.sw <= lm.iw + 1 && lm.esq >= 0 && lm.dir <= lm.iw, JSON.stringify(lm));
      await page.screenshot({ path: `${OUT}/15-menu-periodos-mobile.png`, clip: { x: 0, y: 0, width: 390, height: 760 } });
      check("mobile: menu de seções disponível", (await page.locator('header nav[aria-label="Seções do painel"] a').count()) === 7);
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
      check("IA: o outro cliente NÃO vê a leitura do cliente de teste", (await page.locator("[data-leitura]").count()) === 0);
      {
        const rls = new Client({ connectionString: process.env.DATABASE_URL || "postgres://e2e:e2e@127.0.0.1:5432/geolynq_test" });
        await rls.connect();
        await rls.query("begin");
        await rls.query("set local role authenticated");
        await rls.query("select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000bb', true)");
        const vistas = Number((await rls.query("select count(*) n from public.panel_ai_readings where tenant_id=(select id from public.tenants where slug='fabrica-teste')")).rows[0].n);
        await rls.query("rollback");
        await rls.end();
        check("IA (banco): usuário de outro cliente não lê leituras do cliente de teste (RLS)", vistas === 0);
      }
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
      await c.query("delete from public.reseller_candidates where nome_fantasia like 'E2E %'");
      await c.query("delete from public.tenant_users where user_id='00000000-0000-4000-8000-0000000000aa' and tenant_id=(select id from public.tenants where slug='demo')");
      await c.end();
    } catch {}
    next.kill();
    iaSrv.close();
    mock.server.close();
  }

  const falhas = resultados.filter((x) => !x).length;
  console.log(`\n${resultados.length - falhas}/${resultados.length} verificações passaram. Capturas em ${OUT}`);
  process.exit(falhas ? 1 : 0);
})();
