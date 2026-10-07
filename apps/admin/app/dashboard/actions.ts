"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { opcoesCookieSessao } from "@/lib/cookies";
import { carregar, COOKIE_CLIENTE, getFunnel, getMembership, getMemberships, getOverview, getResellerPerf, getSession, parseDias } from "@/lib/data";
import { gerarLeitura, LeituraErro, montarDados } from "@/lib/ia";

/** Troca o cliente em exibição. Só aceita um slug de cliente ao qual o usuário realmente pertence. */
export async function trocarCliente(formData: FormData) {
  const slug = String(formData.get("cliente") ?? "");
  const meus = await getMemberships();
  if (meus.some((m) => m.tenant.slug === slug)) {
    (await cookies()).set(COOKIE_CLIENTE, slug, opcoesCookieSessao({ path: "/", maxAge: 60 * 60 * 24 * 30 }));
  }
  redirect("/dashboard");
}

/**
 * Gera (e guarda) a "Leitura do período" por IA. Só para quem é membro do cliente em exibição (o RLS do banco também barra o resto).
 * Erros voltam para a tela como ?ia=<codigo>; nada de segredo ou detalhe técnico vai para o navegador.
 */
export async function gerarLeituraIA(formData: FormData) {
  const dias = parseDias(String(formData.get("dias") ?? ""));
  const volta = (erro?: string) => redirect(`/dashboard?dias=${dias}${erro ? `&ia=${erro}` : ""}#leitura`);
  const m = await getMembership();
  if (!m) return volta("falha");
  if (!process.env.ANTHROPIC_API_KEY) return volta("sem_chave");

  // limite ANTES de chamar a IA (o banco também barra, mas aí o custo já teria sido gasto)
  const { supabase } = await getSession();
  const { data: ultima } = await supabase.from("panel_ai_readings").select("created_at").eq("tenant_id", m.tenant.id).order("created_at", { ascending: false }).limit(1);
  if (ultima?.[0] && Date.now() - new Date(ultima[0].created_at).getTime() < 2 * 60 * 1000) return volta("limite");

  const [ov, fun, perf] = await Promise.all([
    carregar(() => getOverview(m.tenant.id, dias)),
    carregar(() => getFunnel(m.tenant.id, dias)),
    carregar(() => getResellerPerf(m.tenant.id, dias)),
  ]);
  if ("erro" in ov || "erro" in fun || "erro" in perf) {
    console.error("[ia] falha ao carregar os dados do período:", [ov, fun, perf].map((x) => ("erro" in x ? x.erro : "ok")).join(" | "));
    return volta("dados");
  }
  if (ov.dados.kpis.buscas === 0) return volta("sem_dados");

  let resultado;
  try {
    resultado = await gerarLeitura(montarDados(m.tenant.name, dias, ov.dados, fun.dados, perf.dados));
  } catch (e) {
    return volta(e instanceof LeituraErro ? e.codigo : "falha");
  }

  const { error } = await supabase.from("panel_ai_readings").insert({
    tenant_id: m.tenant.id,
    dias,
    conteudo: resultado.leitura,
    modelo: resultado.modelo.slice(0, 80),
    tokens_in: resultado.entrada,
    tokens_out: resultado.saida,
  });
  if (error) {
    console.error(`[ia] não gravou a leitura: ${error.code ?? ""} ${error.message}`);
    return volta(/limite_leitura_ia/.test(error.message) ? "limite" : "gravar");
  }
  return volta();
}
