import type { Product, Tenant, WidgetEventAction, WidgetEventType, WidgetLocationSource } from "@geolynq/shared";
import { getSessionId, MAX_RADIUS_KM, parseCep, roundCoord, sanitizeSearchTerm, type LocationInfo } from "./util";

export type TenantPublic = Pick<Tenant, "id" | "name" | "slug" | "primary_color" | "logo_url">;
export type ProductPublic = Pick<Product, "id" | "sku" | "name" | "category">;

export interface ResellerResult {
  reseller_id: string;
  name: string;
  type: string;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
}

export type GeoPoint = LocationInfo;

export interface EventPayload {
  event_type: WidgetEventType;
  query_text?: string | null;
  product_id?: string | null;
  reseller_id?: string | null;
  city?: string | null;
  state?: string | null;
  results_count?: number | null;
  // ---- telemetria v2 (ver supabase/migrations/20261002010000_widget_events_v2.sql) ----
  neighborhood?: string | null;
  lat_approx?: number | null;
  lng_approx?: number | null;
  cep5?: string | null;
  location_source?: WidgetLocationSource | null;
  nearest_km?: number | null;
  physical_count?: number | null;
  online_count?: number | null;
  action?: WidgetEventAction | null;
  /** Em `reseller_click`: distância do revendedor clicado. */
  distance_km?: number | null;
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Cliente mínimo do PostgREST do Supabase (anon key + RLS), sem supabase-js:
 * o bundle embutido em site de terceiro precisa ser o menor possível.
 */
export class GeoLynqApi {
  constructor(
    private readonly baseUrl: string,
    private readonly anonKey: string,
  ) {}

  protected async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.baseUrl}/rest/v1/${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          apikey: this.anonKey,
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (res.status === 204 ? undefined : await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async getTenant(slug: string): Promise<TenantPublic | null> {
    const rows = await this.request<TenantPublic[]>("rpc/widget_get_tenant", {
      method: "POST",
      body: JSON.stringify({ p_slug: slug }),
    });
    return rows[0] ?? null;
  }

  /** Produto exato por SKU (atributo `product` do widget). SKU fora do padrão é ignorado. */
  async getProductBySku(tenantId: string, sku: string): Promise<ProductPublic | null> {
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(sku)) return null;
    const params = new URLSearchParams({
      select: "id,sku,name,category",
      tenant_id: `eq.${tenantId}`,
      sku: `eq.${sku}`,
      limit: "1",
    });
    const rows = await this.request<ProductPublic[]>(`products?${params}`);
    return rows[0] ?? null;
  }

  /**
   * Busca por nome/SKU sem diferença de acento nem de maiúscula (RPC `widget_search_products`).
   * Se a RPC não existir/falhar (ex.: banco ainda sem a migration 20261007), cai na consulta antiga (`ilike`), que é
   * sensível a acento mas mantém o widget funcionando.
   */
  async searchProducts(tenantId: string, term: string): Promise<ProductPublic[]> {
    const clean = sanitizeSearchTerm(term);
    if (!clean) return [];
    try {
      return await this.request<ProductPublic[]>("rpc/widget_search_products", {
        method: "POST",
        body: JSON.stringify({ p_tenant_id: tenantId, p_term: clean, p_limit: 8 }),
      });
    } catch {
      return this.searchProductsLegacy(tenantId, clean);
    }
  }

  private async searchProductsLegacy(tenantId: string, clean: string): Promise<ProductPublic[]> {
    const params = new URLSearchParams({
      select: "id,sku,name,category",
      tenant_id: `eq.${tenantId}`,
      or: `(name.ilike.*${clean}*,sku.ilike.*${clean}*)`,
      order: "name.asc",
      limit: "8",
    });
    return this.request<ProductPublic[]>(`products?${params}`);
  }

  async nearestResellers(
    tenantId: string,
    productId: string,
    point: GeoPoint | null,
  ): Promise<ResellerResult[]> {
    return this.request<ResellerResult[]>("rpc/widget_resellers_in_radius", {
      method: "POST",
      body: JSON.stringify({
        p_tenant_id: tenantId,
        p_product_id: productId,
        p_lat: point?.lat ?? null,
        p_lng: point?.lng ?? null,
        p_limit: 10,
        p_max_km: MAX_RADIUS_KM,
      }),
    });
  }

  /**
   * Telemetria é fire-and-forget: falha de rede aqui nunca pode atrapalhar o usuário final.
   * `keepalive` deixa o evento de clique sair mesmo se a navegação descarregar a página.
   */
  logEvent(tenantId: string, event: EventPayload): void {
    void this.request<void>("widget_events", {
      method: "POST",
      keepalive: true,
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ tenant_id: tenantId, session_id: getSessionId(), telemetry_v: 2, ...event }),
    }).catch(() => undefined);
  }
}

interface ViaCepResponse {
  erro?: boolean | string;
  localidade?: string;
  uf?: string;
  logradouro?: string;
  bairro?: string;
}

/** CEP -> coordenadas via ViaCEP + Nominatim (mesmos serviços gratuitos do pipeline de importação). */
export async function geocodeCep(rawCep: string): Promise<GeoPoint | null> {
  const cep = parseCep(rawCep);
  if (!cep) return null;
  const via: ViaCepResponse = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
  if (via.erro || !via.localidade || !via.uf) return null;

  const query = [via.logradouro, via.bairro, via.localidade, via.uf, "Brasil"].filter(Boolean).join(", ");
  const nominatim = async (q: string) => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`,
    );
    return (await res.json()) as Array<{ lat: string; lon: string }>;
  };
  // CEP genérico de cidade pequena não tem logradouro; tenta de novo só com cidade/UF.
  const hit =
    (await nominatim(query))[0] ?? (await nominatim(`${via.localidade}, ${via.uf}, Brasil`))[0];
  if (!hit) return null;
  return {
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
    city: via.localidade,
    state: via.uf,
    neighborhood: via.bairro || null,
    cep5: cep.slice(0, 5),
    source: "cep",
  };
}

export function browserLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          city: null,
          state: null,
          neighborhood: null,
          cep5: null,
          source: "gps",
        }),
      reject,
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

interface NominatimReverse {
  address?: Record<string, string>;
}

/**
 * Cidade/UF/bairro a partir do GPS (o GPS devolve só coordenadas). Falha silenciosa e com prazo curto: nunca atrasa nem
 * quebra a busca do visitante. A coordenada é arredondada (~1 km) ANTES de sair para o serviço de terceiros.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<Pick<GeoPoint, "city" | "state" | "neighborhood"> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const url =
      "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=1&accept-language=pt-BR" +
      `&lat=${roundCoord(lat)}&lon=${roundCoord(lng)}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const a = ((await res.json()) as NominatimReverse).address;
    if (!a) return null;
    const iso = a["ISO3166-2-lvl4"]; // ex.: "BR-SP"
    return {
      city: a.city ?? a.town ?? a.village ?? a.municipality ?? null,
      state: iso?.startsWith("BR-") ? iso.slice(3) : (a.state ?? null),
      neighborhood: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
