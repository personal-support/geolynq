import type { CookieOptions } from "@supabase/ssr";

/**
 * Cookies de sessão do Supabase: o painel só usa o Supabase no SERVIDOR, então o navegador nunca precisa ler o token.
 * httpOnly impede que um XSS roube a sessão; SameSite=Lax + Secure (em produção) reduzem CSRF e vazamento em HTTP.
 */
export function opcoesCookieSessao(options?: CookieOptions): CookieOptions {
  return { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" };
}
