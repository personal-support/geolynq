/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
import { lerFiltroCandidatos, LIMITE_EXPORTACAO, ROTULO_ANDAMENTO, formataCep, formataCnpj, formataTelefone } from "@/lib/candidatos";
import { paraCsv } from "@/lib/csv";
import { getCandidatosLista, getMembership, getSession } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Exporta os candidatos (com os mesmos filtros da página, até 5.000 linhas) em CSV. Exige sessão; o RLS decide o que o usuário pode ler. */
export async function GET(req: Request) {
  const { user } = await getSession();
  if (!user) return new Response("Faça login para exportar.", { status: 401 });
  const m = await getMembership();
  if (!m) return new Response("Sua conta não está ligada a uma marca.", { status: 403 });

  const filtro = lerFiltroCandidatos(Object.fromEntries(new URL(req.url).searchParams));
  let lista;
  try {
    lista = await getCandidatosLista(m.tenant.id, filtro, LIMITE_EXPORTACAO, 0);
  } catch {
    return new Response("Não foi possível gerar a lista agora.", { status: 502 });
  }
  if (!lista) return new Response("A lista de candidatos ainda não foi habilitada.", { status: 404 });

  const csv = paraCsv([
    ["Nome fantasia", "CNPJ", "Atividade (CNAE)", "Descrição da atividade", "Logradouro", "Número", "Complemento", "Bairro", "Cidade", "UF", "CEP", "Telefone", "E-mail", "Andamento", "Aderência", "Ajuste do ranking"],
    ...lista.itens.map((c) => [
      c.nome, formataCnpj(c.cnpj), c.cnae, c.cnae_desc, c.logradouro, c.numero, c.complemento, c.bairro, c.municipio, c.uf,
      formataCep(c.cep), formataTelefone(c.telefone), c.email, ROTULO_ANDAMENTO[c.status], c.score, c.ajuste ?? 0,
    ]),
  ]);
  const nome = `candidatos-${m.tenant.slug.replace(/[^a-z0-9-]/gi, "")}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nome}"`,
      "cache-control": "no-store",
    },
  });
}
