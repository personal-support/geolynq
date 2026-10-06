import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Catalog, ImportBatch, Overview, Tenant } from "@/lib/types";

/** Usuário logado (validado no servidor do Supabase) + client. Uma consulta por requisição. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

export interface Membership {
  role: string;
  tenant: Tenant;
  email: string | null;
}

/**
 * Cliente (tenant) do usuário. O RLS só devolve linhas do próprio usuário, então não há como pedir o de outro.
 * MVP: um usuário = um cliente (o primeiro vínculo). Seletor de cliente fica para quando houver consultor multi-cliente.
 */
export const getMembership = cache(async (): Promise<Membership | null> => {
  const { supabase, user } = await getSession();
  if (!user) return null;
  const { data, error } = await supabase
    .from("tenant_users")
    .select("role, tenants(id, name, slug, status, primary_color)")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(`Não foi possível carregar o seu cliente: ${error.message}`);
  const row = data?.[0] as { role: string; tenants: Tenant | Tenant[] | null } | undefined;
  const tenant = Array.isArray(row?.tenants) ? row?.tenants[0] : row?.tenants;
  if (!row || !tenant) return null;
  return { role: row.role, tenant, email: user.email ?? null };
});

const REPORTS_HINT =
  "Os relatórios do painel ainda não foram habilitados neste banco (migration 20261006000000_painel_relatorios.sql).";

export const getOverview = cache(async (tenantId: string, dias: number): Promise<Overview> => {
  const { supabase } = await getSession();
  const { data, error } = await supabase.rpc("panel_overview", { p_tenant_id: tenantId, p_days: dias });
  if (error) throw new Error(error.code === "PGRST202" ? REPORTS_HINT : `Relatório de demanda indisponível: ${error.message}`);
  if (!data) throw new Error("Sem acesso a este cliente.");
  return data as Overview;
});

export const getCatalog = cache(async (tenantId: string): Promise<Catalog> => {
  const { supabase } = await getSession();
  const { data, error } = await supabase.rpc("panel_catalog", { p_tenant_id: tenantId });
  if (error) throw new Error(error.code === "PGRST202" ? REPORTS_HINT : `Relatório de catálogo indisponível: ${error.message}`);
  if (!data) throw new Error("Sem acesso a este cliente.");
  return data as Catalog;
});

export const getImports = cache(async (tenantId: string): Promise<ImportBatch[]> => {
  const { supabase } = await getSession();
  const { data, error } = await supabase
    .from("import_batches")
    .select("id, source, status, rows_processed, rows_failed, error_log, created_at, completed_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Histórico de importações indisponível: ${error.message}`);
  return (data ?? []) as ImportBatch[];
});

/** Períodos aceitos no painel (dias). Qualquer outro valor cai em 30. */
export const PERIODOS = [7, 30, 90] as const;
export function parseDias(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return (PERIODOS as readonly number[]).includes(n) ? n : 30;
}

/**
 * Em produção o Next esconde a mensagem de erros de Server Components. Para o cliente ver algo útil
 * (e não uma tela branca), as páginas carregam dados por aqui e mostram o erro de forma controlada.
 */
export async function carregar<T>(fn: () => Promise<T>): Promise<{ dados: T } | { erro: string }> {
  try {
    return { dados: await fn() };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro inesperado ao carregar os dados." };
  }
}
