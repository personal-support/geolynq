import { paraCsv } from "@/lib/csv";
import { getGaps, getMembership, getSession, parseDias } from "@/lib/data";
import { filtrarLacunas, lerFiltro } from "@/lib/lacunas";

export const dynamic = "force-dynamic";

/** Exporta as lacunas (com os mesmos filtros da tela) em CSV. Exige sessão; o RLS decide o que o usuário pode ler. */
export async function GET(req: Request) {
  const { user } = await getSession();
  if (!user) return new Response("Faça login para exportar.", { status: 401 });
  const m = await getMembership();
  if (!m) return new Response("Sua conta não está ligada a uma marca.", { status: 403 });

  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const dias = parseDias(sp.dias);
  const filtro = lerFiltro(sp);

  let gaps;
  try {
    gaps = await getGaps(m.tenant.id, dias);
  } catch {
    return new Response("Não foi possível gerar a lista agora.", { status: 502 });
  }
  const itens = filtrarLacunas(gaps.itens, filtro);
  const csv = paraCsv([
    ["Produto", "SKU", "Cidade", "UF", "Buscas sem revendedor por perto", "Visitas"],
    ...itens.map((l) => [l.produto, l.sku, l.cidade, l.uf, l.buscas, l.sessoes]),
  ]);
  const nome = `lacunas-${m.tenant.slug.replace(/[^a-z0-9-]/gi, "")}-${dias}d.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nome}"`,
      "cache-control": "no-store",
    },
  });
}
