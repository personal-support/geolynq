/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { opcoesCookieSessao } from "@/lib/cookies";
import { carregar, COOKIE_CLIENTE, getFunnel, getMembership, getMemberships, getOverview, getResellerPerf, getSession } from "@/lib/data";
import { resolverPeriodo } from "@/lib/periodo";
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
  const campo = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const periodo = resolverPeriodo({ p: campo("p"), de: campo("de"), ate: campo("ate"), dias: campo("dias") }, new Date());
  const volta = (erro?: string, det?: string) =>
    redirect(`/dashboard?${periodo.query}${erro ? `&ia=${erro}` : ""}${det ? `&det=${encodeURIComponent(det.slice(0, 60))}` : ""}#leitura`);
  const m = await getMembership();
  if (!m) {
    console.error("[ia] sem vínculo do usuário com o cliente em exibição");
    return volta("falha");
  }
  if (!process.env.ANTHROPIC_API_KEY) return volta("sem_chave");

  // limite ANTES de chamar a IA (o banco também barra, mas aí o custo já teria sido gasto)
  const { supabase } = await getSession();
  const { data: ultima } = await supabase.from("panel_ai_readings").select("created_at").eq("tenant_id", m.tenant.id).order("created_at", { ascending: false }).limit(1);
  if (ultima?.[0] && Date.now() - new Date(ultima[0].created_at).getTime() < 2 * 60 * 1000) return volta("limite");

  const [ov, fun, perf] = await Promise.all([
    carregar(() => getOverview(m.tenant.id, periodo)),
    carregar(() => getFunnel(m.tenant.id, periodo)),
    carregar(() => getResellerPerf(m.tenant.id, periodo)),
  ]);
  if ("erro" in ov || "erro" in fun || "erro" in perf) {
    console.error("[ia] falha ao carregar os dados do período:", [ov, fun, perf].map((x) => ("erro" in x ? x.erro : "ok")).join(" | "));
    return volta("dados");
  }
  if (ov.dados.kpis.buscas === 0) return volta("sem_dados");

  let resultado;
  try {
    resultado = await gerarLeitura(montarDados(m.tenant.name, periodo, ov.dados, fun.dados, perf.dados));
  } catch (e) {
    if (e instanceof LeituraErro) return volta(e.codigo, e.detalhe);
    console.error(`[ia] erro inesperado: ${e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : "desconhecido"}`);
    return volta("inesperado");
  }

  const { error } = await supabase.from("panel_ai_readings").insert({
    tenant_id: m.tenant.id,
    dias: Math.min(periodo.dias, 365), // a coluna aceita de 1 a 365
    chave: periodo.id,
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

const ANDAMENTOS = ["novo", "contatado", "vende", "nao_vende", "sem_interesse"] as const;

/**
 * Muda o andamento de um candidato a revendedor (contatado, vende, não vende, sem interesse). O banco confere o papel
 * (só owner/admin) e o vínculo com o cliente; aqui só validamos a forma dos campos e voltamos para a lista.
 */
export async function marcarCandidato(formData: FormData) {
  const campo = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  const periodo = resolverPeriodo({ p: campo("p") || undefined, de: campo("de") || undefined, ate: campo("ate") || undefined, dias: campo("dias") || undefined }, new Date());
  // para onde voltar: a tela Lacunas (com o período) ou a página Candidatos (com os filtros e a página de antes, só chaves conhecidas)
  const filtros = new URLSearchParams(campo("filtros"));
  const seguros = new URLSearchParams();
  for (const k of ["uf", "cidade", "cnae", "status", "q", "pagina"]) {
    const v = filtros.get(k);
    if (v && v.length <= 80) seguros.set(k, v);
  }
  const volta = (erro?: string) =>
    campo("onde") === "candidatos"
      ? redirect(`/dashboard/candidatos?${seguros.toString()}${erro ? `${seguros.size ? "&" : ""}cand=${erro}` : ""}`)
      : redirect(`/dashboard/lacunas?${periodo.query}${erro ? `&cand=${erro}` : ""}#candidatos`);
  const id = campo("id");
  const status = campo("status");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(ANDAMENTOS as readonly string[]).includes(status)) return volta("invalido");
  const m = await getMembership();
  if (!m) return volta("falha");
  const { supabase } = await getSession();
  const { error } = await supabase.rpc("panel_candidate_status", { p_tenant_id: m.tenant.id, p_candidate_id: id, p_status: status });
  if (error) {
    console.error("[candidatos] andamento não gravado:", error.code, error.message);
    return volta(error.code === "42501" ? "permissao" : "falha");
  }
  return volta();
}

/** Adiciona (ou atualiza o peso de) uma palavra do ramo: "sobe" ou "desce" o candidato no ranking. O banco confere o papel (owner/admin). */
export async function salvarTermo(formData: FormData) {
  const campo = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  const volta = (erro?: string) => redirect(`/dashboard/candidatos?${filtrosSeguros(campo("filtros"))}${erro ? `${filtrosSeguros(campo("filtros")) ? "&" : ""}termo=${erro}` : ""}#palavras`);
  const termo = campo("termo").trim();
  const tipo = campo("tipo");
  const peso = parseInt(campo("peso") || "6", 10);
  if (termo.length < 2 || termo.length > 40 || !["sobe", "desce"].includes(tipo) || !(peso >= 1 && peso <= 12)) return volta("invalido");
  const m = await getMembership();
  if (!m) return volta("falha");
  const { supabase } = await getSession();
  const { error } = await supabase.rpc("panel_term_set", { p_tenant_id: m.tenant.id, p_termo: termo, p_tipo: tipo, p_peso: peso });
  if (error) {
    console.error("[termos] não gravado:", error.code, error.message);
    return volta(error.code === "42501" ? "permissao" : error.code === "54000" ? "limite" : error.code === "22023" ? "invalido" : "falha");
  }
  return volta();
}

export async function removerTermo(formData: FormData) {
  const campo = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  const volta = (erro?: string) => redirect(`/dashboard/candidatos?${filtrosSeguros(campo("filtros"))}${erro ? `${filtrosSeguros(campo("filtros")) ? "&" : ""}termo=${erro}` : ""}#palavras`);
  const tipo = campo("tipo");
  if (!["sobe", "desce"].includes(tipo) || !/^[a-z0-9 ]{2,40}$/.test(campo("termo"))) return volta("invalido");
  const m = await getMembership();
  if (!m) return volta("falha");
  const { supabase } = await getSession();
  const { error } = await supabase.rpc("panel_term_remove", { p_tenant_id: m.tenant.id, p_termo: campo("termo"), p_tipo: tipo });
  if (error) {
    console.error("[termos] não removido:", error.code, error.message);
    return volta(error.code === "42501" ? "permissao" : "falha");
  }
  return volta();
}

/** Só as chaves de filtro conhecidas, com tamanho curto, para voltar à página Candidatos sem confiar na querystring. */
function filtrosSeguros(bruto: string): string {
  const entrada = new URLSearchParams(bruto);
  const saida = new URLSearchParams();
  for (const k of ["uf", "cidade", "cnae", "status", "q", "pagina"]) {
    const v = entrada.get(k);
    if (v && v.length <= 80) saida.set(k, v);
  }
  return saida.toString();
}
