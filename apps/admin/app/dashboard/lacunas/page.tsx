import { BarList } from "@/components/charts";
import { ErroPainel } from "@/components/erro-painel";
import { PeriodTabs } from "@/components/period-tabs";
import { Card, CardHeader, Empty, PageHeader, TD, TH } from "@/components/ui";
import { carregar, getMembership, getOverview, parseDias } from "@/lib/data";
import { num } from "@/lib/format";

export const metadata = { title: "Lacunas" };

export default async function Lacunas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const dias = parseDias((await searchParams).dias);
  const m = await getMembership();
  if (!m) return null;
  const r = await carregar(() => getOverview(m.tenant.id, dias));
  if ("erro" in r) return <ErroPainel erro={r.erro} />;
  const o = r.dados;
  const totalBuscas = o.lacunas.reduce((s, l) => s + l.buscas, 0);

  return (
    <>
      <PageHeader
        titulo="Lacunas de cobertura"
        subtitulo="Onde as pessoas procuraram um produto da sua marca e não havia revendedor físico a até 100 km."
        direita={<PeriodTabs dias={dias} base="/dashboard/lacunas" />}
      />

      <Card className="mb-6">
        <CardHeader
          titulo={`${num(o.lacunas.length)} ${o.lacunas.length === 1 ? "combinação" : "combinações"} de produto e cidade`}
          dica={
            o.lacunas.length
              ? `${num(totalBuscas)} buscas nos últimos ${dias} dias. Ordenadas das mais procuradas para as menos.`
              : undefined
          }
        />
        {o.lacunas.length === 0 ? (
          <Empty titulo="Nenhuma lacuna neste período">
            Todas as buscas com produto identificado encontraram um revendedor físico por perto.
          </Empty>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className={TH}>Produto</th>
                  <th className={TH}>Onde buscaram</th>
                  <th className={`${TH} text-right`}>Buscas</th>
                  <th className={`${TH} text-right`}>Pessoas</th>
                  <th className={TH}>Próximo passo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {o.lacunas.map((l) => (
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
                    <td className={`${TD} text-[13px] text-ink-3`}>Lista de candidatos a revendedor: em breve</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
