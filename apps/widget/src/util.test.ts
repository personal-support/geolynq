import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_RADIUS_KM,
  countNearby,
  locationFields,
  roundCoord,
  summarizeResults,
  formatDistance,
  getSessionId,
  isValidColor,
  parseCep,
  readableTextColor,
  resolveColor,
  safeUrl,
  sanitizeSearchTerm,
  telLink,
  whatsappLink,
} from "./util";

describe("cor do tenant", () => {
  it("aceita só hex de 3 ou 6 dígitos", () => {
    expect(isValidColor("#E84E0E")).toBe(true);
    expect(isValidColor("#fff")).toBe(true);
    expect(isValidColor("red")).toBe(false);
    expect(isValidColor("#12345")).toBe(false);
    expect(isValidColor("#fff;background:url(x)")).toBe(false);
    expect(isValidColor(null)).toBe(false);
  });

  it("usa o primeiro candidato válido, senão o padrão", () => {
    expect(resolveColor("invalida", "#112233")).toBe("#112233");
    expect(resolveColor(null, undefined)).toBe("#0f766e");
  });

  it("escolhe texto com contraste", () => {
    expect(readableTextColor("#ffffff")).toBe("#111827");
    expect(readableTextColor("#000000")).toBe("#ffffff");
    expect(readableTextColor("#E84E0E")).toBe("#ffffff");
    expect(readableTextColor("#fff")).toBe("#111827");
  });
});

describe("sanitizeSearchTerm", () => {
  it("remove caracteres que quebram o filtro do PostgREST", () => {
    expect(sanitizeSearchTerm("whey),sku.eq.1")).toBe("whey sku.eq.1");
    expect(sanitizeSearchTerm("  100%  creatina_  ")).toBe("100 creatina");
    expect(sanitizeSearchTerm('a"b*c')).toBe("a b c");
  });
  it("limita o tamanho", () => {
    expect(sanitizeSearchTerm("x".repeat(500))).toHaveLength(80);
  });
});

describe("CEP", () => {
  it("exige 8 dígitos", () => {
    expect(parseCep("11010-000")).toBe("11010000");
    expect(parseCep("1101")).toBeNull();
    expect(parseCep("abc")).toBeNull();
  });
});

describe("links de contato", () => {
  it("monta wa.me com DDI 55", () => {
    expect(whatsappLink("(13) 99999-8888")).toBe("https://wa.me/5513999998888");
    expect(whatsappLink("+55 13 99999-8888")).toBe("https://wa.me/5513999998888");
    expect(whatsappLink("123")).toBeNull();
    expect(whatsappLink(null)).toBeNull();
  });

  it("monta tel:", () => {
    expect(telLink("(13) 3222-1111")).toBe("tel:1332221111");
    expect(telLink("12")).toBeNull();
  });

  it("só aceita http(s) em site", () => {
    expect(safeUrl("exemplo.com.br")).toBe("https://exemplo.com.br/");
    expect(safeUrl("http://exemplo.com")).toBe("http://exemplo.com/");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,x")).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });
});

describe("formatDistance", () => {
  it("usa metros abaixo de 1 km e vírgula decimal", () => {
    expect(formatDistance(0.2)).toBe("200 m");
    expect(formatDistance(0.02)).toBe("100 m");
    expect(formatDistance(3.456)).toBe("3,5 km");
    expect(formatDistance(42.4)).toBe("42 km");
    expect(formatDistance(null)).toBeNull();
  });
});

describe("getSessionId", () => {
  beforeEach(() => localStorage.clear());

  it("é estável dentro dos 30 dias e renova depois", () => {
    const t0 = 1_000_000;
    const first = getSessionId(t0);
    expect(getSessionId(t0 + 29 * 86_400_000)).toBe(first);
    expect(getSessionId(t0 + 31 * 86_400_000)).not.toBe(first);
  });
});

describe("raio máximo e lacuna de cobertura", () => {
  it("o raio padrão do widget é 100 km (mesmo valor do filtro no banco)", () => {
    expect(MAX_RADIUS_KM).toBe(100);
  });

  it("loja online não conta como cobertura próxima", () => {
    expect(countNearby([])).toBe(0);
    expect(countNearby([{ type: "online" }])).toBe(0);
    expect(countNearby([{ type: "online" }, { type: "loja_fisica" }, { type: "farmacia" }])).toBe(2);
    expect(countNearby([{ type: "distribuidor" }, { type: "outro" }])).toBe(2);
  });
});

describe("telemetria v2: localização", () => {
  const cep = { lat: -23.9608, lng: -46.3336, city: "Santos", state: "SP", neighborhood: "Gonzaga", cep5: "11060", source: "cep" as const };

  it("arredonda a coordenada a 2 casas (~1 km)", () => {
    expect(roundCoord(-23.9608)).toBe(-23.96);
    expect(roundCoord(-46.3336)).toBe(-46.33);
    expect(roundCoord(0.005)).toBe(0.01);
  });

  it("sem localização: source 'none' e tudo nulo", () => {
    expect(locationFields(null)).toEqual({
      location_source: "none", city: null, state: null, neighborhood: null, lat_approx: null, lng_approx: null, cep5: null,
    });
  });

  it("CEP: guarda cidade, bairro, cep5 e coordenada arredondada, nunca a exata", () => {
    const f = locationFields(cep);
    expect(f).toMatchObject({ location_source: "cep", city: "Santos", state: "SP", neighborhood: "Gonzaga", cep5: "11060", lat_approx: -23.96, lng_approx: -46.33 });
    expect(JSON.stringify(f)).not.toMatch(/23\.9608|46\.3336/);
  });

  it("GPS: source 'gps' e sem cep5", () => {
    const f = locationFields({ ...cep, source: "gps", cep5: null });
    expect(f.location_source).toBe("gps");
    expect(f.cep5).toBeNull();
  });

  it("respeita os limites do CHECK do banco (cep5 = 5 dígitos; textos truncados)", () => {
    expect(locationFields({ ...cep, cep5: "11060001" }).cep5).toBeNull();
    expect(locationFields({ ...cep, cep5: "abcde" }).cep5).toBeNull();
    const big = locationFields({ ...cep, city: "x".repeat(500), state: "y".repeat(500), neighborhood: "z".repeat(500) });
    expect(big.city?.length).toBe(120);
    expect(big.state?.length).toBe(60);
    expect(big.neighborhood?.length).toBe(120);
  });
});

describe("telemetria v2: resumo dos resultados", () => {
  it("separa físico de online e acha o físico mais próximo", () => {
    const rs = [
      { type: "farmacia", distance_km: 4.2 },
      { type: "loja_fisica", distance_km: 0.804 },
      { type: "online", distance_km: null },
    ];
    expect(summarizeResults(rs)).toEqual({ physical_count: 2, online_count: 1, nearest_km: 0.8 });
  });

  it("só online: nenhum físico e nearest_km nulo (lacuna local)", () => {
    expect(summarizeResults([{ type: "online", distance_km: null }])).toEqual({ physical_count: 0, online_count: 1, nearest_km: null });
  });

  it("sem resultados, ou físicos sem distância (sem localização): nearest_km nulo", () => {
    expect(summarizeResults([])).toEqual({ physical_count: 0, online_count: 0, nearest_km: null });
    expect(summarizeResults([{ type: "loja_fisica", distance_km: null }])).toEqual({ physical_count: 1, online_count: 0, nearest_km: null });
  });
});
