"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  erro?: string;
  email?: string;
}

/** Só aceita voltar para dentro do painel (evita redirecionamento aberto via ?next=). */
function destinoSeguro(next: string): string {
  if (!next.startsWith("/dashboard")) return "/dashboard";
  if (next.includes("//") || next.includes("\\") || next.includes("@")) return "/dashboard";
  return next;
}

function mensagem(erro: { code?: string; status?: number; message: string }): string {
  if (erro.code === "invalid_credentials") return "E-mail ou senha incorretos.";
  if (erro.code === "email_not_confirmed") return "Confirme o e-mail antes de entrar.";
  if (erro.status === 429 || erro.code === "over_request_rate_limit") return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  return "Não foi possível entrar agora. Tente de novo em instantes.";
}

export async function signIn(_anterior: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("password") ?? "");
  const destino = destinoSeguro(String(formData.get("next") ?? ""));

  if (!email || !senha) return { erro: "Informe o e-mail e a senha.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return { erro: mensagem(error), email };

  redirect(destino);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
