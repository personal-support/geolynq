import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Client público (anon key) — uso em Admin (client-side) e Widget.
 * Protegido por RLS: nunca expõe dado fora do escopo das policies públicas.
 */
export function createSupabaseBrowserClient(
  url: string,
  anonKey: string
): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey);
}

/**
 * Client privilegiado (service_role key) — uso EXCLUSIVO em rotas server-side
 * do Admin (import de planilha, criação de tenant). Nunca importar em código
 * que roda no navegador.
 */
export function createSupabaseServiceClient(
  url: string,
  serviceRoleKey: string
): SupabaseClient<Database> {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
