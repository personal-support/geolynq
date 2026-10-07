import { afterEach, describe, expect, it, vi } from "vitest";
import { GeoLynqApi } from "./api";

const TENANT = "00000000-0000-4000-8000-000000000001";
const produto = { id: "p1", sku: "PRT-001", name: "Proteína", category: "Proteínas" };

function mockFetch(handler: (path: string, init: RequestInit) => { status?: number; json?: unknown }) {
  const calls: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const path = url.replace("https://x.supabase.co/rest/v1/", "");
      calls.push({ path, body: init.body ? JSON.parse(String(init.body)) : null });
      const r = handler(path, init);
      return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.json ?? [] };
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("searchProducts (busca sem acento)", () => {
  const api = new GeoLynqApi("https://x.supabase.co", "sb_publishable_test");

  it("usa a RPC widget_search_products e manda o termo já sanitizado", async () => {
    const calls = mockFetch(() => ({ json: [produto] }));
    const r = await api.searchProducts(TENANT, "  proteina),(x  ");
    expect(r).toEqual([produto]);
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("rpc/widget_search_products");
    expect(calls[0].body).toEqual({ p_tenant_id: TENANT, p_term: "proteina x", p_limit: 8 });
  });

  it("se a RPC falhar (banco sem a migration), cai na consulta antiga e devolve o resultado", async () => {
    const calls = mockFetch((path) => (path.startsWith("rpc/") ? { status: 404 } : { json: [produto] }));
    const r = await api.searchProducts(TENANT, "proteína");
    expect(r).toEqual([produto]);
    expect(calls.map((c) => c.path.split("?")[0])).toEqual(["rpc/widget_search_products", "products"]);
  });

  it("termo vazio não chama a API", async () => {
    const calls = mockFetch(() => ({ json: [produto] }));
    expect(await api.searchProducts(TENANT, " ,() ")).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
