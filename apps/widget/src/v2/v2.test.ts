import { afterEach, describe, expect, it, vi } from "vitest";
import { GeoLynqApiV2, anonymousVisitId, type ProductCard } from "./api2";
import { filterProducts, initials, normalize, termForTelemetry } from "./catalog";
import { contrastRatio, ensureContrast, resolveTheme, safeFontUrl, themeVars } from "./theme";

const P = (name: string, sku = "X-1", category: string | null = null): ProductCard => ({ id: sku, sku, name, category, image_url: null });

describe("tema (nunca aplica texto livre do banco como CSS)", () => {
  it("usa os padrões quando o tema é vazio ou inválido", () => {
    for (const raw of [undefined, null, {}, [], "x", 42]) {
      const t = resolveTheme(raw, null, null);
      expect(t.primary).toBe("#1f3fff");
      expect(t.font).toBe("inherit");
      expect(t.radius).toBe(12);
      expect(t.buttonStyle).toBe("solid");
    }
  });

  it("prioridade da cor: atributo do snippet > tema > cor do cliente > padrão", () => {
    expect(resolveTheme({ primary: "#111111" }, "#222222", "#333333").primary).toBe("#222222");
    expect(resolveTheme({ primary: "#111111" }, null, "#333333").primary).toBe("#111111");
    expect(resolveTheme({}, null, "#333333").primary).toBe("#333333");
    expect(resolveTheme({ primary: "red" }, "javascript:1", "url(x)").primary).toBe("#1f3fff");
  });

  it("rejeita injeção de CSS em cor, fonte e arredondamento", () => {
    const t = resolveTheme(
      { primary: "#fff;background:url(//evil)", text: "red", font: "Arial;}body{display:none", radius: "9px;x", imageRatio: "9/1", buttonStyle: "evil" },
      null,
      null,
    );
    expect(t.primary).toBe("#1f3fff");
    expect(t.text).toBeNull();
    expect(t.font).toBe("inherit");
    expect(t.radius).toBe(12);
    expect(t.imageRatio).toBe("1 / 1");
    expect(t.buttonStyle).toBe("solid");
    const css = themeVars(t);
    expect(css).not.toMatch(/url\(|;}|evil|display/);
  });

  it("aceita fonte, raio e proporção válidos (e limita o raio)", () => {
    const t = resolveTheme({ font: "'Open Sans', Arial, sans-serif", radius: 999, imageRatio: "4/3", buttonStyle: "outline", card: "#fafafa" }, null, null);
    expect(t.font).toBe("'Open Sans', Arial, sans-serif");
    expect(t.radius).toBe(24);
    expect(t.imageRatio).toBe("4 / 3");
    expect(t.buttonStyle).toBe("outline");
    expect(themeVars(t)).toContain("--gl-font:'Open Sans', Arial, sans-serif");
    expect(themeVars(t)).toContain("--gl-card:#fafafa");
  });

  it("herda fonte e cor do texto do site quando o tema não define (nenhuma variável emitida)", () => {
    const css = themeVars(resolveTheme({}, null, null));
    expect(css).not.toContain("--gl-font");
    expect(css).not.toContain("--gl-text:");
    expect(css).toContain("--gl-bg:transparent");
  });

  it("botões/campos: raio próprio (pílula), caixa alta e sombra só se válidos; selo ligado por padrão", () => {
    const padrao = resolveTheme({ radius: 14 }, null, null);
    expect(padrao.buttonRadius).toBe(14);
    expect(padrao.inputRadius).toBe(14);
    expect(padrao.showCredit).toBe(true);
    expect(padrao.buttonUppercase).toBe(false);
    const t = resolveTheme({ radius: 14, buttonRadius: 999, inputRadius: 25, inputBorder: "#D1D1D1", buttonUppercase: true, hoverShadow: true, showCredit: false }, null, null);
    expect(t.buttonRadius).toBe(30);
    expect(t.inputRadius).toBe(25);
    expect(t.inputBorder).toBe("#d1d1d1");
    expect(t.showCredit).toBe(false);
    const css = themeVars(t);
    expect(css).toContain("--gl-btn-radius:30px");
    expect(css).toContain("--gl-btn-case:uppercase");
    expect(css).toContain("--gl-hover-shadow:0 4px 12px");
    // valores malformados caem no padrão e nunca viram CSS
    const ruim = resolveTheme({ buttonRadius: "url(x)", inputBorder: "red;}", buttonUppercase: "yes", showCredit: "nao" }, null, null);
    expect(ruim.buttonRadius).toBe(12);
    expect(ruim.inputBorder).toBe("#e5e7eb");
    expect(ruim.buttonUppercase).toBe(false);
    expect(ruim.showCredit).toBe(true);
  });

  it("só aceita CSS do Google Fonts", () => {
    expect(safeFontUrl("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap")).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2/);
    for (const bad of ["http://fonts.googleapis.com/css2?family=Inter", "https://evil.com/css2", "https://fonts.googleapis.com.evil.com/css2", "javascript:alert(1)", "https://fonts.googleapis.com/other", 5, null]) {
      expect(safeFontUrl(bad)).toBeNull();
    }
  });
});

describe("contraste (WCAG)", () => {
  it("preto sobre branco = 21; mesma cor = 1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("amarelo claro sobre branco não passa e é escurecido até 4,5:1; cor boa fica como está", () => {
    expect(contrastRatio("#ffd43b", "#ffffff")).toBeLessThan(2);
    const fixed = ensureContrast("#ffd43b", "#ffffff", 4.5);
    expect(contrastRatio(fixed, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(ensureContrast("#1f3fff", "#ffffff", 4.5)).toBe("#1f3fff");
  });

  it("sobre fundo escuro, clareia em vez de escurecer", () => {
    const fixed = ensureContrast("#222222", "#000000", 4.5);
    expect(contrastRatio(fixed, "#000000")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("grade: filtro local sem acento", () => {
  const lista = [P("Whey Protein Isolado", "WPI-900", "Proteínas"), P("Creatina Monohidratada", "CRE-300", "Energia"), P("Ômega 3", "OM3-120", "Saúde")];

  it("normaliza acento e caixa", () => {
    expect(normalize("  PROTEÍNA ")).toBe("proteina");
  });

  it("filtra por nome, SKU e categoria", () => {
    expect(filterProducts(lista, "proteina").map((p) => p.sku)).toEqual(["WPI-900"]);
    expect(filterProducts(lista, "OMEGA").map((p) => p.sku)).toEqual(["OM3-120"]);
    expect(filterProducts(lista, "cre-300").map((p) => p.sku)).toEqual(["CRE-300"]);
    expect(filterProducts(lista, "energia").map((p) => p.sku)).toEqual(["CRE-300"]);
    expect(filterProducts(lista, "zzz")).toEqual([]);
  });

  it("termo vazio devolve tudo (cópia)", () => {
    const todos = filterProducts(lista, "  ");
    expect(todos).toHaveLength(3);
    expect(todos).not.toBe(lista);
  });

  it("iniciais para a foto que falta", () => {
    expect(initials("Whey Protein Isolado")).toBe("WP");
    expect(initials("Ômega 3")).toBe("Ô3");
    expect(initials("")).toBe("?");
  });
});

describe("telemetria: texto digitado que parece dado pessoal não é gravado", () => {
  it("descarta e-mail, telefone, CPF, CEP e sequências longas de números", () => {
    for (const bad of ["joao@email.com", "(13) 99999-8888", "13999998888", "123.456.789-09", "11060-001 santos", "cartão 4111 1111 1111 1111"]) {
      expect(termForTelemetry(bad)).toBeNull();
    }
  });

  it("descarta termo curto demais e normaliza o resto", () => {
    expect(termForTelemetry("ab")).toBeNull();
    expect(termForTelemetry("  Pasta   de Amendoim ")).toBe("pasta de amendoim");
    expect(termForTelemetry("whey 900")).toBe("whey 900");
    expect(termForTelemetry("x".repeat(100))?.length).toBe(60);
  });
});

describe("visita anônima (nada no navegador)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mantém o mesmo id na página sem tocar em localStorage/cookie", () => {
    const get = vi.fn();
    const set = vi.fn();
    vi.stubGlobal("localStorage", { getItem: get, setItem: set });
    const a = anonymousVisitId();
    expect(anonymousVisitId()).toBe(a);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("logEvent envia o id de visita e telemetry_v=2, sem localStorage", async () => {
    const calls: { path: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ path: url.replace("https://x.supabase.co/rest/v1/", ""), body: JSON.parse(String(init.body)) });
        return { ok: true, status: 204, json: async () => undefined };
      }),
    );
    const set = vi.fn();
    vi.stubGlobal("localStorage", { getItem: vi.fn(), setItem: set });
    const api = new GeoLynqApiV2("https://x.supabase.co", "sb_publishable_test");
    api.logEvent("T1", { event_type: "search", query_text: "whey", product_id: null, results_count: 0 });
    await new Promise((r) => setTimeout(r, 0));
    expect(calls[0].path).toBe("widget_events");
    expect(calls[0].body.session_id).toBe(anonymousVisitId());
    expect(calls[0].body.telemetry_v).toBe(2);
    expect(set).not.toHaveBeenCalled();
  });
});

describe("api v2: paginação e totais", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("findProducts devolve itens sem total_count e o total da primeira linha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [{ ...P("A"), total_count: 57 }, { ...P("B", "B-1"), total_count: 57 }] })),
    );
    const page = await new GeoLynqApiV2("https://x.supabase.co", "k").findProducts("T", "", 2, 0);
    expect(page.total).toBe(57);
    expect(page.items).toHaveLength(2);
    expect("total_count" in page.items[0]).toBe(false);
  });

  it("listResellers manda os filtros e trata lista vazia", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return { ok: true, status: 200, json: async () => [] };
      }),
    );
    const page = await new GeoLynqApiV2("https://x.supabase.co", "k").listResellers("T", { uf: "SP", city: "Santos", productId: "P1", offset: 10 });
    expect(page).toEqual({ items: [], total: 0 });
    expect(bodies[0]).toMatchObject({ p_tenant_id: "T", p_product_id: "P1", p_uf: "SP", p_city: "Santos", p_type: null, p_lat: null, p_limit: 10, p_offset: 10 });
  });
});

describe("aviso de medição: recusar desliga toda a gravação", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("sem escolha a medição segue ligada; 'no' desliga; 'ok' mantém", async () => {
    const c = await import("./consent");
    window.localStorage.clear();
    expect(c.readConsent()).toBeNull();
    expect(c.mayTrack()).toBe(true);
    c.saveConsent("ok");
    expect(c.mayTrack()).toBe(true);
    c.saveConsent("no");
    expect(c.readConsent()).toBe("no");
    expect(c.mayTrack()).toBe(false);
  });

  it("recusou: logEvent não faz nenhuma chamada de rede; antes de recusar, faz", async () => {
    vi.resetModules(); // a recusa "na memória" de outros testes não pode vazar para este
    const c = await import("./consent");
    const { GeoLynqApiV2: Api } = await import("./api2");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = new Api("https://x.supabase.co", "k");
    window.localStorage.clear();
    api.logEvent("t1", { event_type: "search", query_text: "whey" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    c.saveConsent("no");
    api.logEvent("t1", { event_type: "search", query_text: "whey" });
    api.logEvent("t1", { event_type: "reseller_click", action: "whatsapp" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("armazenamento bloqueado: a recusa vale na memória da página (nunca grava por engano)", async () => {
    const c = await import("./consent");
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    c.saveConsent("no");
    expect(c.mayTrack()).toBe(false);
    setItem.mockRestore();
    getItem.mockRestore();
  });
});
