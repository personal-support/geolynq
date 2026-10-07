import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Leitura } from "@/lib/ia";
import type { Catalog, EventoRecente, Funil, ImportBatch, LacunasCompletas, Overview, RevendedorDesempenho, Tenant } from "@/lib/types";

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

/** Cookie com o cliente (slug) que o usuário está vendo. Só vale se o usuário for mesmo membro dele (o RLS já filtra a lista). */
export const COOKIE_CLIENTE = "gl_cliente";

/**
 * Clientes (tenants) do usuário. O RLS só devolve linhas do próprio usuário, então não há como pedir o de outro.
 * Quem tem mais de um vínculo (ex.: a equipe da GeoLynq) escolhe qual ver pelo seletor da barra lateral.
 */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const { supabase, user } = await getSession();
  if (!user) return [];
  const { data, error } = await supabase
    .from("tenant_users")
    .select("role, tenants(id, name, slug, status, primary_color)")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Não foi possível carregar o seu cliente: ${error.message}`);
  const lista: Membership[] = [];
  for (const row of (data ?? []) as unknown as { role: string; tenants: Tenant | Tenant[] | null }[]) {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    if (tenant) lista.push({ role: row.role, tenant, email: user.email ?? null });
  }
  return lista;
});

/** O cliente em exibição: o escolhido no seletor (cookie) ou, na falta, o primeiro vinculado ao usuário. */
export const getMembership = cache(async (): Promise<Membership | null> => {
  const todos = await getMemberships();
  if (todos.length === 0) return null;
  const slug = (await cookies()).get(COOKIE_CLIENTE)?.value;
  return todos.find((m) => m.tenant.slug === slug) ?? todos[0];
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

/**
 * Quantos eventos do cliente são simulados (sessões "seed-…", criadas por supabase/tests/03_eventos_simulados.sql).
 * Alimenta a faixa "Dados de demonstração". Em caso de erro devolve null: sem faixa (não dá para afirmar nada).
 */
export const getEventosSimulados = cache(async (tenantId: string): Promise<{ simulados: number; total: number } | null> => {
  const { supabase } = await getSession();
  const [sim, tot] = await Promise.all([
    supabase.from("widget_events").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).like("session_id", "seed-%"),
    supabase.from("widget_events").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);
  if (sim.error || tot.error || sim.count == null || tot.count == null) return null;
  return { simulados: sim.count, total: tot.count };
});


/** Últimos eventos do cliente (buscas e contatos com revendedores), do mais recente para o mais antigo. */
export const getRecent = cache(async (tenantId: string, limite = 12): Promise<EventoRecente[]> => {
  const { supabase } = await getSession();
  const { data, error } = await supabase.rpc("panel_recent", { p_tenant_id: tenantId, p_limit: limite });
  if (error) throw new Error(error.code === "PGRST202" ? REPORTS_HINT : `Últimas buscas indisponíveis: ${error.message}`);
  return (data ?? []) as EventoRecente[];
});

/** Contatos gerados por revendedor no período (inclui quem não gerou nenhum). */
export const getResellerPerf = cache(async (tenantId: string, dias: number): Promise<RevendedorDesempenho[]> => {
  const { supabase } = await getSession();
  const { data, error } = await supabase.rpc("panel_resellers", { p_tenant_id: tenantId, p_days: dias });
  if (error) throw new Error(error.code === "PGRST202" ? REPORTS_HINT : `Desempenho da rede indisponível: ${error.message}`);
  return (data ?? []) as RevendedorDesempenho[];
});


/** Funil de uso do widget (digitou, escolheu produto, informou local, achou revendedor, clicou; e o caminho pela lista). */
export const getFunnel = cache(async (tenantId: string, dias: number): Promise<Funil> => {
  const { supabase } = await getSession();
  const { data, error } = await supabase.rpc("panel_funnel", { p_tenant_id: tenantId, p_days: dias });
  if (error) throw new Error(error.code === "PGRST202" ? REPORTS_HINT : `Funil indisponível: ${error.message}`);
  if (!data) throw new Error("Sem acesso a este cliente.");
  return data as Funil;
});

/** Todas as lacunas do período (até 500 combinações) com o total exato de buscas sem revendedor por perto. */
export const getGaps = cache(async (tenantId: string, dias: number): Promise<LacunasCompletas> => {
  const { supabase } = await getSession();
  const { data, error } = await supabase.rpc("panel_gaps", { p_tenant_id: tenantId, p_days: dias });
  if (error) throw new Error(error.code === "PGRST202" ? REPORTS_HINT : `Lacunas indisponíveis: ${error.message}`);
  if (!data) throw new Error("Sem acesso a este cliente.");
  return data as LacunasCompletas;
});

/** Última leitura por IA guardada para o cliente e o período (ou null). */
export interface LeituraGuardada {
  id: string;
  conteudo: Leitura;
  modelo: string;
  created_at: string;
}
export const getUltimaLeitura = cache(async (tenantId: string, dias: number): Promise<LeituraGuardada | null> => {
  const { supabase } = await getSession();
  const { data, error } = await supabase
    .from("panel_ai_readings")
    .select("id, conteudo, modelo, created_at")
    .eq("tenant_id", tenantId)
    .eq("dias", dias)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    // tabela ainda não criada neste banco: o painel segue sem o cartão
    if (error.code === "PGRST205" || error.code === "42P01") return null;
    throw new Error(`Leitura por IA indisponível: ${error.message}`);
  }
  return ((data ?? [])[0] as LeituraGuardada | undefined) ?? null;
});
