/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
import { paraCsv } from "@/lib/csv";
import { getGaps, getMembership, getSession } from "@/lib/data";
import { resolverPeriodo } from "@/lib/periodo";
import { filtrarLacunas, lerFiltro } from "@/lib/lacunas";

export const dynamic = "force-dynamic";

/** Exporta as lacunas (com os mesmos filtros da tela) em CSV. Exige sessão; o RLS decide o que o usuário pode ler. */
export async function GET(req: Request) {
  const { user } = await getSession();
  if (!user) return new Response("Faça login para exportar.", { status: 401 });
  const m = await getMembership();
  if (!m) return new Response("Sua conta não está ligada a uma marca.", { status: 403 });

  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const periodo = resolverPeriodo(sp, new Date());
  const filtro = lerFiltro(sp);

  let gaps;
  try {
    gaps = await getGaps(m.tenant.id, periodo);
  } catch {
    return new Response("Não foi possível gerar a lista agora.", { status: 502 });
  }
  const itens = filtrarLacunas(gaps.itens, filtro);
  const csv = paraCsv([
    ["Produto", "SKU", "Cidade", "UF", "Buscas sem revendedor por perto", "Visitas"],
    ...itens.map((l) => [l.produto, l.sku, l.cidade, l.uf, l.buscas, l.sessoes]),
  ]);
  const nome = `lacunas-${m.tenant.slug.replace(/[^a-z0-9-]/gi, "")}-${periodo.id.replace(/[^a-z0-9-]/gi, "_")}.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nome}"`,
      "cache-control": "no-store",
    },
  });
}
