export type TenantStatus = "active" | "trial" | "suspended" | "cancelled";
export type ResellerType =
  | "loja_fisica"
  | "farmacia"
  | "online"
  | "distribuidor"
  | "outro";
export type ResellerStatus = "active" | "inactive";
/** Situação cadastral do CNPJ do revendedor na Receita (B0.1). `null` = nunca consultado. */
export type ResellerVerificationStatus =
  | "nao_verificado"
  | "ativa"
  | "suspensa"
  | "inapta"
  | "baixada"
  | "nula";
export type CnpjSituacao = Exclude<ResellerVerificationStatus, "nao_verificado">;
export type ChannelType = "varejo" | "atacado" | "representante" | "online" | "outro";
export type TerritoryScope = "brasil" | "uf" | "municipio";
export type TenantProfileSource = "brasilapi" | "receita_dump" | "manual";
export type ImportBatchStatus = "processing" | "success" | "partial" | "failed";
/** `catalog_search`, `product_select`, `list_open` e `list_search` são os eventos de funil do widget v2 (migration 20261011000000). */
export type WidgetEventType = "search" | "reseller_click" | "catalog_search" | "product_select" | "list_open" | "list_search";
/** Como a localização do visitante foi obtida (telemetria v2). */
export type WidgetLocationSource = "cep" | "gps" | "none";
/** Ação escolhida pelo visitante num revendedor (telemetria v2). */
export type WidgetEventAction = "whatsapp" | "call" | "site" | "directions";
export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "converted"
  | "discarded";
export type TenantUserRole = "owner" | "admin" | "viewer";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: string;
  primary_color: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Perfil de mercado do cliente, vindo da Receita no cadastro (B0.1). Só pessoa jurídica; sem quadro societário. */
export interface TenantProfile {
  tenant_id: string;
  cnpj_raiz: string;
  cnpj_matriz: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao_cadastral: CnpjSituacao | null;
  data_abertura: string | null;
  porte: string | null;
  /** 7 dígitos; a API devolve número, normalizar com lpad(x::text, 7, '0'). */
  cnae_principal: string | null;
  cnae_principal_desc: string | null;
  cnaes_secundarios: string[];
  uf: string | null;
  municipio: string | null;
  /** Código IBGE (7 dígitos). */
  municipio_ibge: number | null;
  /** Código interno da Receita (o dump mensal usa este). */
  municipio_receita: number | null;
  cep: string | null;
  website: string | null;
  fonte: TenantProfileSource;
  consultado_em: string | null;
  created_at: string;
}

export interface CnaeCatalogItem {
  cnae: string;
  descricao: string;
}

export interface Segment {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface SegmentChannelCnae {
  segment_id: string;
  cnae: string;
  tipo_canal: ChannelType;
  peso: number;
}

export interface TenantSegment {
  tenant_id: string;
  segment_id: string;
}

export interface TenantTerritory {
  id: string;
  tenant_id: string;
  scope: TerritoryScope;
  uf: string | null;
  municipio_ibge: number | null;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: TenantUserRole;
  created_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  category: string | null;
  claims: string[] | null;
  allergens: string[] | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reseller {
  id: string;
  tenant_id: string;
  name: string;
  type: ResellerType;
  status: ResellerStatus;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  /** 14 dígitos, sem máscara, com dígito verificador válido (B0.1). Opcional. */
  cnpj: string | null;
  verification_status: ResellerVerificationStatus | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  tenant_id: string;
  reseller_id: string;
  cep: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  geocoded_at: string | null;
  created_at: string;
}

export interface ProductResellerCoverage {
  id: string;
  tenant_id: string;
  product_id: string;
  reseller_id: string;
  priority: number;
  created_at: string;
}

export interface ImportBatch {
  id: string;
  tenant_id: string;
  source: string;
  status: ImportBatchStatus;
  rows_processed: number;
  rows_failed: number;
  error_log: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

export interface WidgetEvent {
  id: string;
  tenant_id: string;
  /** uuid anonimo gerado no navegador (localStorage, 30 dias) — distingue sessao de pessoa. */
  session_id: string | null;
  event_type: WidgetEventType;
  query_text: string | null;
  product_id: string | null;
  city: string | null;
  state: string | null;
  /** v2: nº de revendedores FÍSICOS no raio (v1: total devolvido). */
  results_count: number | null;
  reseller_id: string | null;
  created_at: string;
  // ---- telemetria v2 (migration 20261002010000_widget_events_v2.sql); linhas antigas têm telemetry_v = 1 e nulos ----
  telemetry_v: number;
  neighborhood: string | null;
  /** coordenada arredondada a 2 casas (~1 km); nunca a exata */
  lat_approx: number | null;
  lng_approx: number | null;
  /** 5 primeiros dígitos do CEP; nunca o CEP inteiro */
  cep5: string | null;
  location_source: WidgetLocationSource | null;
  /** distância ao revendedor físico mais próximo entregue na busca (null se nenhum) */
  nearest_km: number | null;
  physical_count: number | null;
  online_count: number | null;
  /** só em reseller_click */
  action: WidgetEventAction | null;
  /** só em reseller_click: distância do revendedor clicado */
  distance_km: number | null;
}

export type OpportunityClassification =
  | "baixa"
  | "moderada"
  | "alta"
  | "muito_alta";

/**
 * Tabela agregada (Fase 10, pos-MVP) — recalculada 1x/dia via n8n a partir de
 * widget_events. Tipo definido desde a Fase 2 para nao reabrir o schema depois;
 * nao ha UI/consumo antes da Fase 10.
 */
export interface CommercialOpportunity {
  id: string;
  tenant_id: string;
  product_id: string;
  city: string;
  state: string;
  period_start: string;
  period_end: string;
  searches: number;
  unique_sessions: number;
  coverage_gap_searches: number;
  reseller_count: number;
  growth_rate: number | null;
  engagement_rate: number | null;
  demand_score: number | null;
  coverage_gap_score: number | null;
  growth_score: number | null;
  engagement_score: number | null;
  opportunity_score: number;
  classification: OpportunityClassification | null;
  updated_at: string;
}

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  message: string | null;
  source: string;
  status: LeadStatus;
  created_at: string;
}

/**
 * Placeholder minimo compativel com o client tipado do supabase-js.
 * Substituir pelo tipo gerado via `supabase gen types typescript`
 * assim que o projeto geolynq-prod estiver acessivel pela CLI.
 */
export interface Database {
  public: {
    Tables: {
      tenants: { Row: Tenant; Insert: Partial<Tenant>; Update: Partial<Tenant> };
      tenant_users: {
        Row: TenantUser;
        Insert: Partial<TenantUser>;
        Update: Partial<TenantUser>;
      };
      products: { Row: Product; Insert: Partial<Product>; Update: Partial<Product> };
      resellers: {
        Row: Reseller;
        Insert: Partial<Reseller>;
        Update: Partial<Reseller>;
      };
      addresses: { Row: Address; Insert: Partial<Address>; Update: Partial<Address> };
      product_reseller_coverage: {
        Row: ProductResellerCoverage;
        Insert: Partial<ProductResellerCoverage>;
        Update: Partial<ProductResellerCoverage>;
      };
      import_batches: {
        Row: ImportBatch;
        Insert: Partial<ImportBatch>;
        Update: Partial<ImportBatch>;
      };
      widget_events: {
        Row: WidgetEvent;
        Insert: Partial<WidgetEvent>;
        Update: Partial<WidgetEvent>;
      };
      leads: { Row: Lead; Insert: Partial<Lead>; Update: Partial<Lead> };
      commercial_opportunities: {
        Row: CommercialOpportunity;
        Insert: Partial<CommercialOpportunity>;
        Update: Partial<CommercialOpportunity>;
      };
    };
  };
}
