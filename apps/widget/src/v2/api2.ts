import { GeoLynqApi, type EventPayload, type ResellerResult, type TenantPublic } from "../api";

export interface TenantV2 extends TenantPublic {
  theme: unknown;
}

export interface ProductCard {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  image_url: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface ListFilters {
  productId?: string | null;
  uf?: string;
  city?: string;
  type?: string;
  point?: { lat: number; lng: number } | null;
  limit?: number;
  offset?: number;
}

export interface Places {
  ufs: string[];
  cidades: { uf: string; cidade: string }[];
}

/**
 * Identificador da VISITA: vive só na memória da página (nada em localStorage/cookie). Fecha a aba, acabou: o dado é anônimo
 * por desenho. Consequência no painel: "pessoas" passam a ser "visitas".
 */
let visitId: string | null = null;
export function anonymousVisitId(): string {
  if (visitId) return visitId;
  visitId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        });
  return visitId;
}

type ProductRow = ProductCard & { total_count: number };
type ResellerRow = ResellerResult & { total_count: number };

/** Chamadas novas do widget v2 (migration 20261010000000_widget_v2_nucleo.sql). */
export class GeoLynqApiV2 extends GeoLynqApi {
  async getTenantV2(slug: string): Promise<TenantV2 | null> {
    const rows = await this.request<TenantV2[]>("rpc/widget_get_tenant_v2", {
      method: "POST",
      body: JSON.stringify({ p_slug: slug }),
    });
    return rows[0] ?? null;
  }

  async findProducts(tenantId: string, term: string, limit: number, offset: number): Promise<Page<ProductCard>> {
    const rows = await this.request<ProductRow[]>("rpc/widget_find_products", {
      method: "POST",
      body: JSON.stringify({ p_tenant_id: tenantId, p_term: term, p_limit: limit, p_offset: offset }),
    });
    return {
      items: rows.map(({ total_count: _t, ...p }) => p),
      total: rows[0] ? Number(rows[0].total_count) : 0,
    };
  }

  async listResellers(tenantId: string, f: ListFilters): Promise<Page<ResellerResult>> {
    const rows = await this.request<ResellerRow[]>("rpc/widget_list_resellers", {
      method: "POST",
      body: JSON.stringify({
        p_tenant_id: tenantId,
        p_product_id: f.productId ?? null,
        p_uf: f.uf || null,
        p_city: f.city || null,
        p_type: f.type || null,
        p_lat: f.point?.lat ?? null,
        p_lng: f.point?.lng ?? null,
        p_limit: f.limit ?? 10,
        p_offset: f.offset ?? 0,
      }),
    });
    return {
      items: rows.map(({ total_count: _t, ...r }) => r),
      total: rows[0] ? Number(rows[0].total_count) : 0,
    };
  }

  async listPlaces(tenantId: string): Promise<Places> {
    const p = await this.request<Places | null>("rpc/widget_list_places", {
      method: "POST",
      body: JSON.stringify({ p_tenant_id: tenantId }),
    });
    return { ufs: p?.ufs ?? [], cidades: p?.cidades ?? [] };
  }

  /** Telemetria fire-and-forget, sempre com o identificador de visita em memória (v2 não usa localStorage). */
  override logEvent(tenantId: string, event: EventPayload): void {
    void this.request<void>("widget_events", {
      method: "POST",
      keepalive: true,
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ tenant_id: tenantId, session_id: anonymousVisitId(), telemetry_v: 2, ...event }),
    }).catch(() => undefined);
  }
}
