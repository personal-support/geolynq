const SESSION_KEY = "geolynq_sid";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FALLBACK_COLOR = "#0f766e";

export function isValidColor(value: string | null | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

export function resolveColor(...candidates: Array<string | null | undefined>): string {
  return candidates.find(isValidColor) ?? FALLBACK_COLOR;
}

/** Preto ou branco, o que tiver mais contraste sobre a cor do tenant (WCAG luminância relativa). */
export function readableTextColor(hex: string): string {
  const full =
    hex.length === 4 ? "#" + [...hex.slice(1)].map((c) => c + c).join("") : hex;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? "#111827" : "#ffffff";
}

/**
 * Termo de busca seguro para o filtro `or=(name.ilike.*x*,sku.ilike.*x*)` do PostgREST:
 * remove os caracteres que quebram a sintaxe do filtro ou viram curinga do LIKE.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()*"\\%_]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function parseCep(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

export function whatsappLink(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  const withCountry = digits.length <= 11 ? "55" + digits : digits;
  return `https://wa.me/${withCountry}`;
}

export function telLink(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.length >= 8 ? `tel:${digits}` : null;
}

/** Aceita só http/https — nunca javascript:, data: etc. vindos de planilha de cliente. */
export function safeUrl(raw: string | null): string | null {
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function mapsLink(lat: number | null, lng: number | null, fallbackQuery: string): string {
  const q = lat !== null && lng !== null ? `${lat},${lng}` : fallbackQuery;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * Raio máximo (km) da busca de revendedores físicos. Fica aqui (e é enviado à RPC como
 * `p_max_km`) para a mensagem do widget e o filtro do banco nunca divergirem.
 */
export const MAX_RADIUS_KM = 100;

/**
 * Quantos resultados são "perto de verdade": loja online atende qualquer lugar, então não
 * conta. É o que vira `results_count` na telemetria — assim "produto existe, mas ninguém
 * vende perto" (results_count = 0) continua detectável mesmo quando só há loja online.
 */
export function countNearby(resellers: ReadonlyArray<{ type: string }>): number {
  return resellers.filter((r) => r.type !== "online").length;
}

/** Localização do visitante. `source` diz como veio; nunca guardamos o CEP inteiro nem a coordenada exata. */
export interface LocationInfo {
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  /** 5 primeiros dígitos do CEP (só quando a localização veio do CEP). */
  cep5: string | null;
  source: "cep" | "gps";
}

/** Arredonda a 2 casas (~1 km): suficiente para mapa de calor, impreciso para identificar uma pessoa. */
export function roundCoord(v: number): number {
  return Math.round(v * 100) / 100;
}

const clip = (s: string | null | undefined, max: number): string | null => (s ? s.slice(0, max) : null);

/**
 * Campos de localização do evento de telemetria. Os limites (120/60 caracteres, formato do CEP) espelham o CHECK
 * `widget_events_v2_check` do banco: evento fora do padrão seria recusado e a telemetria se perderia em silêncio.
 */
export function locationFields(p: LocationInfo | null) {
  if (!p) {
    return {
      location_source: "none" as const,
      city: null,
      state: null,
      neighborhood: null,
      lat_approx: null,
      lng_approx: null,
      cep5: null,
    };
  }
  return {
    location_source: p.source,
    city: clip(p.city, 120),
    state: clip(p.state, 60),
    neighborhood: clip(p.neighborhood, 120),
    lat_approx: roundCoord(p.lat),
    lng_approx: roundCoord(p.lng),
    cep5: p.cep5 && /^\d{5}$/.test(p.cep5) ? p.cep5 : null,
  };
}

/** Resume o que o visitante recebeu: físicos vs online e a distância ao físico mais próximo (null se não houver). */
export function summarizeResults(rs: ReadonlyArray<{ type: string; distance_km: number | null }>) {
  const physical = rs.filter((r) => r.type !== "online");
  const dists = physical.map((r) => r.distance_km).filter((d): d is number => d !== null && Number.isFinite(d));
  return {
    physical_count: physical.length,
    online_count: rs.length - physical.length,
    nearest_km: dists.length > 0 ? Math.round(Math.min(...dists) * 100) / 100 : null,
  };
}

export function formatDistance(km: number | null): string | null {
  if (km === null || Number.isNaN(km)) return null;
  if (km < 1) return `${Math.max(1, Math.round(km * 10)) * 100} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`.replace(".", ",");
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let memorySession: { id: string; exp: number } | null = null;

/**
 * UUID anônimo por navegador, válido por 30 dias (schema: widget_events.session_id).
 * Sem localStorage (modo privado, bloqueio de cookies de terceiros) cai pra memória:
 * a sessão vale enquanto a página estiver aberta, o widget nunca quebra por isso.
 */
export function getSessionId(now: number = Date.now()): string {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    if (stored && typeof stored.id === "string" && stored.exp > now) return stored.id;
    const fresh = { id: randomId(), exp: now + SESSION_TTL_MS };
    localStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
    return fresh.id;
  } catch {
    if (!memorySession || memorySession.exp <= now) {
      memorySession = { id: randomId(), exp: now + SESSION_TTL_MS };
    }
    return memorySession.id;
  }
}
