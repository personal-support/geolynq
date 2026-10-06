import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/env";
import { opcoesCookieSessao } from "@/lib/cookies";

/** Client do Supabase para Server Components e Server Actions (sessão lida dos cookies). */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, opcoesCookieSessao(options)));
        } catch {
          // Chamado de um Server Component (cookies somente leitura): o proxy.ts renova a sessão a cada requisição.
        }
      },
    },
  });
}
