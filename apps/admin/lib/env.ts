/**
 * Variáveis públicas (vão para o navegador): URL do projeto Supabase e a chave publishable (`sb_publishable_…`).
 * NUNCA colocar service_role aqui — o painel lê só pelo papel `authenticated`, protegido por RLS.
 */
export function supabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (chave publishable) no ambiente.");
  }
  return { url, key };
}

/** Bundle do widget publicado (usado só na tela "Widget" para o preview e o snippet de instalação). */
export const WIDGET_SCRIPT_URL =
  process.env.NEXT_PUBLIC_WIDGET_SCRIPT_URL ?? "https://widget.geolynq.personalsupport.tech/v1/embed.js";
