import { beforeEach, describe, expect, it } from "vitest";
import {
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
