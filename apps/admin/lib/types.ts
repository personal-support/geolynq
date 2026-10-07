/** Formato das respostas das funções do banco (supabase/migrations/20261006000000_painel_relatorios.sql). */

export type TenantStatus = "active" | "trial" | "suspended" | "cancelled";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  primary_color: string | null;
}

export interface Kpis {
  buscas: number;
  sessoes: number;
  cliques: number;
  conversao_pct: number | null;
  buscas_com_produto: number;
  sem_cobertura: number;
  cobertura_pct: number | null;
  fora_do_catalogo: number;
  distancia_media_km: number | null;
}

export interface Lacuna {
  product_id: string;
  sku: string;
  produto: string;
  cidade: string;
  uf: string | null;
  buscas: number;
  sessoes: number;
}

export interface PontoDemanda {
  cidade: string;
  uf: string | null;
  lat: number;
  lng: number;
  buscas: number;
  sem_cobertura: number;
}

export interface Overview {
  periodo: { dias: number; de: string; ate: string; anterior_de: string };
  kpis: Kpis;
  anterior: { buscas: number; sessoes: number; cliques: number; sem_cobertura: number };
  serie: { dia: string; buscas: number; cliques: number }[];
  top_produtos: { id: string; sku: string; name: string; buscas: number; cliques: number; sem_cobertura: number }[];
  lacunas: Lacuna[];
  fora_do_catalogo: { termo: string; buscas: number; sessoes: number }[];
  regioes: { cidade: string; uf: string | null; buscas: number; sem_cobertura: number }[];
  mapa_demanda: PontoDemanda[];
  acoes: { acao: "whatsapp" | "call" | "site" | "directions"; cliques: number }[];
  tem_telemetria_v2: boolean;
}

export interface ResellerRow {
  id: string;
  nome: string;
  tipo: "loja_fisica" | "farmacia" | "online" | "distribuidor" | "outro";
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  lat: number | null;
  lng: number | null;
  cnpj: string | null;
  tem_whatsapp: boolean;
  tem_telefone: boolean;
  tem_site: boolean;
  produtos: number;
}

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  revendedores: number;
  fisicos: number;
  ufs: string[];
}

export interface ImportSummary {
  status: "success" | "partial" | "failed";
  rows_processed: number | null;
  rows_failed: number | null;
  completed_at: string | null;
  created_at: string;
  erros: number;
  avisos: number;
}

export interface Catalog {
  produtos_ativos: number;
  revendedores_ativos: number;
  produtos: ProductRow[];
  produtos_sem_revendedor: { id: string; sku: string; name: string }[];
  produtos_sem_revendedor_fisico: { id: string; sku: string; name: string; online: number }[];
  revendedores_sem_produto: { id: string; name: string; type: string; city: string | null; state: string | null }[];
  por_uf: { uf: string; revendedores: number; fisicos: number; online: number }[];
  por_cidade: { cidade: string; uf: string | null; revendedores: number }[];
  por_tipo: { tipo: string; revendedores: number }[];
  completude: {
    total: number;
    com_whatsapp: number;
    com_telefone: number;
    com_cnpj: number;
    com_site: number;
    fisicos: number;
    fisicos_com_coordenadas: number;
  };
  rede: ResellerRow[];
  ultima_importacao: ImportSummary | null;
}

export interface ImportBatch {
  id: string;
  source: string;
  status: "success" | "partial" | "failed";
  rows_processed: number | null;
  rows_failed: number | null;
  error_log: { _sheet: string; _row: number | null; _error: string }[] | null;
  created_at: string;
  completed_at: string | null;
}

export interface EventoRecente {
  quando: string;
  tipo: "search" | "reseller_click";
  termo: string | null;
  produto: string | null;
  cidade: string | null;
  uf: string | null;
  resultado: number | null;
  online: number | null;
  acao: "whatsapp" | "call" | "site" | "directions" | null;
  revendedor: string | null;
}

export interface RevendedorDesempenho {
  id: string;
  nome: string;
  tipo: string;
  cidade: string | null;
  uf: string | null;
  contatos: number;
  whatsapp: number;
  ligar: number;
  rota: number;
  site: number;
  ultimo_contato: string | null;
}
