"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { opcoesCookieSessao } from "@/lib/cookies";
import { COOKIE_CLIENTE, getMemberships } from "@/lib/data";

/** Troca o cliente em exibição. Só aceita um slug de cliente ao qual o usuário realmente pertence. */
export async function trocarCliente(formData: FormData) {
  const slug = String(formData.get("cliente") ?? "");
  const meus = await getMemberships();
  if (meus.some((m) => m.tenant.slug === slug)) {
    (await cookies()).set(COOKIE_CLIENTE, slug, opcoesCookieSessao({ path: "/", maxAge: 60 * 60 * 24 * 30 }));
  }
  redirect("/dashboard");
}
