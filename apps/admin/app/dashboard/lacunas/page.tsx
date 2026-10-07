import { AvisoBasePequena } from "@/components/avisos";
import { BarList } from "@/components/charts";
import { ErroPainel } from "@/components/erro-painel";
import { PeriodTabs } from "@/components/period-tabs";
import { Card, CardHeader, Empty, PageHeader, TD, TH } from "@/components/ui";
import { carregar, getGaps, getMembership, getOverview, parseDias } from "@/lib/data";
import { filtrarLacunas, lerFiltro } from "@/lib/lacunas";
import { avisoDeBase } from "@/lib/avisos";
import { num } from "@/lib/format";

export const metadata = { title: "Lacunas" };

export default async function Lacunas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const dias = parseDias(sp.dias);
  const filtro = lerFiltro(sp);
  const m = await getMembership();
  if (!m) return null;
  const [r, g] = await Promise.all([carregar(() => getOverview(m.tenant.id, dias)), carregar(() => getGaps(m.tenant.id, dias))]);
  if ("erro" in r) return <ErroPainel erro={r.erro} />;
  if ("erro" in g) return <ErroPainel erro={g.erro} />;
  const o = r.dados;
  const todas = g.dados;
  const lista = filtrarLacunas(todas.itens, filtro);
  const filtrando = Boolean(filtro.uf || filtro.sku);
  const totalBuscas = lista.reduce((s, l) => s + l.buscas, 0);
  const ufs = [...new Set(todas.itens.map((l) => l.uf).filter((x): x is string => !!x))].sort();
  const produtos = [...new Map(todas.itens.map((l) => [l.sku, l.produto])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const qs = new URLSearchParams({ dias: String(dias), ...(filtro.uf && { uf: filtro.uf }), ...(filtro.sku && { produto: filtro.sku }) }).toString();
  const truncada = todas.combinacoes > todas.itens.length;
  const aviso = avisoDeBase(o.kpis.buscas, o.anterior.buscas, dias, false);

  return (
    <>
      <PageHeader
        titulo="Lacunas de cobertura"
        subtitulo="Onde as pessoas procuraram um produto da sua marca e não havia revendedor físico a até 100 km."
        direita={<PeriodTabs dias={dias} base="/dashboard/lacunas" />}
      />

      <AvisoBasePequena aviso={aviso} />

      <Card className="mb-6">
        <CardHeader
          titulo={`${num(lista.length)} ${lista.length === 1 ? "combinação" : "combinações"} de produto e cidade`}
          dica={
            lista.length
              ? `${num(totalBuscas)} ${filtrando ? `de ${num(todas.total_buscas)} ` : ""}buscas sem revendedor por perto nos últimos ${dias} dias. Ordenadas das mais procuradas para as menos.${
                  truncada ? ` Mostrando as ${num(todas.itens.length)} maiores de ${num(todas.combinacoes)}.` : ""
                }`
              : undefined
          }
          direita={
            lista.length ? (
              <a
                href={`/dashboard/lacunas/export?${qs}`}
                className="shrink-0 rounded-lg border border-line-2 px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-line"
              >
                Exportar CSV
              </a>
            ) : undefined
          }
        />
        {todas.itens.length > 0 ? (
          <form method="get" className="flex flex-wrap items-end gap-3 px-5 pt-4">
            <input type="hidden" name="dias" value={dias} />
            <label className="text-[13px] font-medium text-ink-2">
              Estado
              <select name="uf" defaultValue={filtro.uf} className="mt-1 block rounded-lg border border-line-2 bg-white px-3 py-2 text-sm font-normal text-ink">
                <option value="">Todos</option>
                {ufs.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-[13px] font-medium text-ink-2">
              Produto
              <select name="produto" defaultValue={filtro.sku} className="mt-1 block max-w-[260px] rounded-lg border border-line-2 bg-white px-3 py-2 text-sm font-normal text-ink">
                <option value="">Todos</option>
                {produtos.map(([sku, nome]) => (
                  <option key={sku} value={sku}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-2">
              Filtrar
            </button>
            {filtrando ? (
              <a href={`/dashboard/lacunas?dias=${dias}`} className="py-2 text-sm font-medium text-ink-2 underline underline-offset-2">
                Limpar
              </a>
            ) : null}
          </form>
        ) : null}
        {lista.length === 0 && filtrando ? (
          <Empty titulo="Nenhuma lacuna com esses filtros">Tente outro estado ou produto, ou limpe os filtros.</Empty>
        ) : lista.length === 0 ? (
          o.kpis.buscas_com_produto === 0 ? (
            <Empty titulo="Sem dados para medir lacunas">Nenhuma busca do período identificou um produto do catálogo.</Empty>
          ) : (
            <Empty titulo="Nenhuma lacuna neste período">
              Todas as buscas com produto identificado encontraram um revendedor físico por perto.
            </Empty>
          )
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={TH}>Produto</th>
                  <th className={TH}>Onde buscaram</th>
                  <th className={`${TH} text-right`}>Buscas</th>
                  <th className={`${TH} text-right`}>Pessoas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lista.map((l) => (
                  <tr key={`${l.product_id}-${l.cidade}-${l.uf}`}>
                    <td className={TD}>
                      <p className="font-semibold">{l.produto}</p>
                      <p className="font-mono text-[11px] text-ink-3">{l.sku}</p>
                    </td>
                    <td className={TD}>
                      {l.cidade}
                      {l.uf ? <span className="text-ink-3">/{l.uf}</span> : null}
                    </td>
                    <td className={`${TD} text-right font-display text-lg font-semibold text-gap`}>{num(l.buscas)}</td>
                    <td className={`${TD} text-right`}>{num(l.sessoes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">
              Em breve: para cada lacuna, a lista de candidatos a revendedor na região (empresas do ramo que ainda não vendem a sua marca).
            </p>
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            titulo="Regiões com mais buscas"
            dica="A parte laranja são as buscas dali que ficaram sem revendedor por perto."
          />
          <div className="mt-3 pb-2">
            <BarList
              itens={o.regioes.map((g) => ({
                rotulo: `${g.cidade}${g.uf ? "/" + g.uf : ""}`,
                valor: g.buscas,
                lacuna: g.sem_cobertura,
              }))}
              vazio="Sem buscas com localização no período."
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            titulo="Procuraram e você não tem"
            dica="Termos que não batem com nenhum produto do catálogo."
          />
          <div className="mt-3 pb-2">
            <BarList
              itens={o.fora_do_catalogo.map((t) => ({
                rotulo: t.termo,
                valor: t.buscas,
                extra: t.sessoes !== t.buscas ? `${num(t.sessoes)} ${t.sessoes === 1 ? "pessoa" : "pessoas"}` : undefined,
              }))}
              vazio="Nenhuma busca fora do catálogo no período."
              neutro
            />
          </div>
        </Card>
      </div>
    </>
  );
}
