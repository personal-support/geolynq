import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { opcoesCookieSessao } from "@/lib/cookies";
import { supabaseEnv } from "@/lib/env";

/**
 * Proxy (Next 16: substitui o antigo middleware).
 * 1. Renova a sessão do Supabase (cookies) a cada requisição.
 * 2. Protege /dashboard/*: sem sessão → /login?next=…
 * 3. Quem já está logado e abre /login → /dashboard.
 * A autorização de verdade é do banco (RLS); isto é só a porta de entrada.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, opcoesCookieSessao(options)));
      },
    },
  });

  // getUser() valida o token no servidor do Supabase (getSession() só leria o cookie, que pode ser forjado).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && path.startsWith("/dashboard")) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = "";
    if (path !== "/dashboard") to.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(to);
  }

  if (user && path === "/login") {
    const to = request.nextUrl.clone();
    to.pathname = "/dashboard";
    to.search = "";
    return NextResponse.redirect(to);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
