import type { Product, Tenant, WidgetEventType } from "@geolynq/shared";
import { getSessionId, MAX_RADIUS_KM, parseCep, sanitizeSearchTerm } from "./util";

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

export interface GeoPoint {
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
}

export interface EventPayload {
  event_type: WidgetEventType;
  query_text?: string | null;
  product_id?: string | null;
  reseller_id?: string | null;
  city?: string | null;
  state?: string | null;
  results_count?: number | null;
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

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
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

  async searchProducts(tenantId: string, term: string): Promise<ProductPublic[]> {
    const clean = sanitizeSearchTerm(term);
    if (!clean) return [];
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
      body: JSON.stringify({ tenant_id: tenantId, session_id: getSessionId(), ...event }),
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
  return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), city: via.localidade, state: via.uf };
}

export function browserLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, city: null, state: null }),
      reject,
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  });
}
