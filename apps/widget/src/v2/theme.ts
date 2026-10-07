import { isValidColor, readableTextColor } from "../util";

/**
 * Tema do widget por cliente. Só a GeoLynq edita (coluna tenants.widget_theme); o navegador NUNCA aplica texto livre do banco
 * como CSS: cada chave é validada aqui e vira uma variável CSS com valor conhecido. O que não passar na validação é ignorado.
 */
export interface WidgetTheme {
  primary: string;
  /** Texto e fundo da área do widget. `null` = herdar do site (transparente / cor do texto do site). */
  text: string | null;
  background: string | null;
  card: string;
  cardText: string;
  border: string;
  radius: number;
  /** "inherit" = fonte do site. Senão, uma lista de famílias já validada. */
  font: string;
  /** Link de fonte do Google Fonts a carregar no <head> da página (opcional). */
  fontUrl: string | null;
  buttonStyle: "solid" | "outline";
  imageRatio: "1 / 1" | "4 / 3" | "3 / 4";
}

export const DEFAULT_PRIMARY = "#1f3fff";

const DEFAULTS: Omit<WidgetTheme, "primary"> = {
  text: null,
  background: null,
  card: "#ffffff",
  cardText: "#111827",
  border: "#e5e7eb",
  radius: 12,
  font: "inherit",
  fontUrl: null,
  buttonStyle: "solid",
  imageRatio: "1 / 1",
};

const RATIOS: Record<string, WidgetTheme["imageRatio"]> = { "1/1": "1 / 1", "4/3": "4 / 3", "3/4": "3 / 4" };
const FONT_RE = /^[\p{L}\p{N} ,'"-]{1,120}$/u;

function hex(v: unknown): string | null {
  return typeof v === "string" && isValidColor(v.trim()) ? v.trim().toLowerCase() : null;
}

/** Só aceita CSS do Google Fonts (host e caminho fixos) — nada de URL arbitrária no <head> do site do cliente. */
export function safeFontUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v.trim());
    const ok = u.protocol === "https:" && u.hostname === "fonts.googleapis.com" && (u.pathname === "/css2" || u.pathname === "/css");
    return ok && u.href.length <= 400 ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * Junta, em ordem de prioridade: atributo `color` do snippet > tema do banco > cor principal do cliente > padrão.
 * Qualquer valor inválido cai no padrão: um tema quebrado nunca pode quebrar o widget.
 */
export function resolveTheme(raw: unknown, attrColor?: string | null, tenantColor?: string | null): WidgetTheme {
  const t = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const radius = typeof t.radius === "number" && Number.isFinite(t.radius) ? Math.min(24, Math.max(0, Math.round(t.radius))) : DEFAULTS.radius;
  const font =
    t.font === "inherit" || t.font === undefined ? "inherit" : typeof t.font === "string" && FONT_RE.test(t.font.trim()) ? t.font.trim() : "inherit";
  return {
    primary: hex(attrColor) ?? hex(t.primary) ?? hex(tenantColor) ?? DEFAULT_PRIMARY,
    text: hex(t.text) ?? DEFAULTS.text,
    background: hex(t.background) ?? DEFAULTS.background,
    card: hex(t.card) ?? DEFAULTS.card,
    cardText: hex(t.cardText) ?? DEFAULTS.cardText,
    border: hex(t.border) ?? DEFAULTS.border,
    radius,
    font,
    fontUrl: safeFontUrl(t.fontUrl),
    buttonStyle: t.buttonStyle === "outline" ? "outline" : "solid",
    imageRatio: (typeof t.imageRatio === "string" && RATIOS[t.imageRatio]) || DEFAULTS.imageRatio,
  };
}

// ---------- contraste (WCAG) ----------
function rgb(h: string): [number, number, number] {
  const full = h.length === 4 ? "#" + [...h.slice(1)].map((c) => c + c).join("") : h;
  return [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}
function luminance([r, g, b]: [number, number, number]): number {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(rgb(a)), luminance(rgb(b))];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
const toHex = (c: [number, number, number]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** Escurece/clareia a cor (em direção a preto ou branco) até atingir o contraste mínimo sobre o fundo; devolve a própria cor se já passa. */
export function ensureContrast(fg: string, bg: string, min = 4.5): string {
  if (contrastRatio(fg, bg) >= min) return fg;
  const target: [number, number, number] = luminance(rgb(bg)) > 0.4 ? [0, 0, 0] : [255, 255, 255];
  const base = rgb(fg);
  for (let step = 1; step <= 20; step++) {
    const k = step / 20;
    const mixed = base.map((v, i) => v + (target[i] - v) * k) as [number, number, number];
    const h = toHex(mixed);
    if (contrastRatio(h, bg) >= min) return h;
  }
  return toHex(target);
}

/** Variáveis CSS prontas para o `style` do contêiner do widget. Todos os valores já foram validados. */
export function themeVars(t: WidgetTheme): string {
  const accent = ensureContrast(t.primary, t.card, 4.5); // cor da marca usada como TEXTO sobre o cartão (links, distância, botão contornado)
  return [
    `--gl-primary:${t.primary}`,
    `--gl-on-primary:${readableTextColor(t.primary)}`,
    `--gl-accent:${accent}`,
    t.text ? `--gl-text:${t.text}` : "",
    `--gl-bg:${t.background ?? "transparent"}`,
    `--gl-card:${t.card}`,
    `--gl-card-text:${t.cardText}`,
    `--gl-muted:${ensureContrast("#6b7280", t.card, 4.5)}`,
    `--gl-border:${t.border}`,
    `--gl-radius:${t.radius}px`,
    t.font !== "inherit" ? `--gl-font:${t.font}` : "",
    `--gl-ratio:${t.imageRatio}`,
  ]
    .filter(Boolean)
    .join(";");
}
