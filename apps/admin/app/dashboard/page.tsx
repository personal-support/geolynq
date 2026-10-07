import Link from "next/link";
import { AvisoBasePequena } from "@/components/avisos";
import { BarList, TrendChart } from "@/components/charts";
import { CoverageMap } from "@/components/coverage-map";
import { ErroPainel } from "@/components/erro-painel";
import { PeriodTabs } from "@/components/period-tabs";
import { Card, CardHeader, Delta, Empty, Kpi, PageHeader } from "@/components/ui";
import { UltimasBuscas, QuemGeraContato } from "@/components/ao-vivo";
import { FunilDeUso } from "@/components/funil";
import { carregar, getCatalog, getFunnel, getMembership, getOverview, getRecent, getResellerPerf, parseDias } from "@/lib/data";
import { avisoDeBase } from "@/lib/avisos";
import { ACAO_CLIQUE, km, num, pct, variacao } from "@/lib/format";

export const metadata = { title: "Visão geral" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function VisaoGeral({ searchParams }: { searchParams: SP }) {
  const dias = parseDias((await searchParams).dias);
  const m = await getMembership();
  if (!m) return null;

  const [ov, cat, rec, perf, fun] = await Promise.all([
    carregar(() => getOverview(m.tenant.id, dias)),
    carregar(() => getCatalog(m.tenant.id)),
    carregar(() => getRecent(m.tenant.id, 10)),
    carregar(() => getResellerPerf(m.tenant.id, dias)),
    carregar(() => getFunnel(m.tenant.id, dias)),
  ]);
  if ("erro" in ov) return <ErroPainel erro={ov.erro} />;
  if ("erro" in cat) return <ErroPainel erro={cat.erro} />;
  const o = ov.dados;
  const c = cat.dados;
  const k = o.kpis;

  const semBuscas = k.buscas === 0;
  const maior = o.lacunas[0];
  const vLacunas = variacao(k.sem_cobertura, o.anterior.sem_cobertura, "descer");
  const aviso = avisoDeBase(k.buscas, o.anterior.buscas, dias, true);

  return (
    <>
      <PageHeader
        titulo="Visão geral"
        subtitulo={`Últimos ${dias} dias, comparados com os ${dias} dias anteriores.`}
        direita={<PeriodTabs dias={dias} base="/dashboard" />}
      />

      <AvisoBasePequena aviso={aviso} />

      {/* A frase do painel: o que a equipe comercial precisa saber primeiro */}
      <Card className="mb-6 overflow-hidden">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-3">O que o radar achou</p>
            {semBuscas ? (
              <>
                <h2 className="mt-3 text-4xl font-semibold leading-[1.04] sm:text-[44px]">Ainda não há buscas neste período.</h2>
                <p className="mt-4 max-w-xl text-[15px] text-ink-2">
                  {m.tenant.status === "active"
                    ? "Assim que alguém buscar um produto no site da sua marca, os números aparecem aqui."
                    : "O widget só atende clientes ativos. Quando a GeoLynq ativar a sua marca, as buscas passam a ser medidas."}
                </p>
              </>
            ) : k.buscas_com_produto === 0 ? (
              <>
                <h2 className="mt-3 text-4xl font-semibold leading-[1.04] sm:text-[44px]">
                  {k.buscas === 1 ? "A única busca não bateu" : `Nenhuma das ${num(k.buscas)} buscas bateu`} com um produto do catálogo.
                </h2>
                <p className="mt-4 max-w-xl text-[15px] text-ink-2">
                  Sem produto identificado não dá para medir cobertura de revendedores. Veja abaixo, em “Procuraram e você não tem”, o que as
                  pessoas buscaram.
                </p>
              </>
            ) : k.sem_cobertura === 0 ? (
              <>
                <h2 className="mt-3 text-4xl font-semibold leading-[1.04] sm:text-[44px]">
                  Todas as buscas com produto encontraram revendedor por perto.
                </h2>
                <p className="mt-4 max-w-xl text-[15px] text-ink-2">
                  {num(k.buscas_com_produto)} {k.buscas_com_produto === 1 ? "busca" : "buscas"} com produto identificado, nenhuma sem revendedor a menos
                  de 100 km.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-3 text-4xl font-semibold leading-[1.04] sm:text-[44px]">
                  <span className="text-gap">{num(k.sem_cobertura)}</span>{" "}
                  {k.sem_cobertura === 1 ? "busca ficou" : "buscas ficaram"} sem revendedor por perto.
                </h2>
                <p className="mt-4 max-w-xl text-[15px] text-ink-2">
                  São {pct(100 - (k.cobertura_pct ?? 100))} das {num(k.buscas_com_produto)} buscas com produto identificado.
                  {maior ? (
                    <>
                      {" "}
                      A maior lacuna: <strong>{maior.produto}</strong> em{" "}
                      <strong>
                        {maior.cidade}
                        {maior.uf ? `/${maior.uf}` : ""}
                      </strong>{" "}
                      ({num(maior.buscas)} {maior.buscas === 1 ? "busca" : "buscas"}).
                    </>
                  ) : null}
                </p>
                <div className="mt-3">
                  <Delta v={vLacunas} />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 text-sm lg:items-end">
            <Link
              href="/dashboard/lacunas"
              className="inline-flex items-center justify-center rounded-xl bg-ink px-5 py-3 text-[15px] font-semibold text-white hover:bg-ink-2"
            >
              Ver todas as lacunas →
            </Link>
            <p className="max-w-xs text-ink-3 lg:text-right">
              “Sem revendedor por perto” = nenhum revendedor físico a até 100 km de quem buscou. Loja online não conta.
            </p>
          </div>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          rotulo="Buscas no widget"
          valor={num(k.buscas)}
          detalhe={`${num(k.sessoes)} ${k.sessoes === 1 ? "visita com busca" : "visitas com busca"}`}
          rodape={<Delta v={variacao(k.buscas, o.anterior.buscas)} />}
        />
        <Kpi
          rotulo="Foram até um revendedor"
          valor={pct(k.conversao_pct)}
          detalhe={`${num(k.cliques)} ${k.cliques === 1 ? "clique" : "cliques"} em WhatsApp, rota, ligação ou site`}
          rodape={<Delta v={variacao(k.cliques, o.anterior.cliques)} />}
        />
        <Kpi
          rotulo="Buscas com revendedor por perto"
          valor={pct(k.cobertura_pct)}
          detalhe={k.distancia_media_km != null ? `Revendedor mais próximo a ${km(k.distancia_media_km)}, em média` : "Entre as buscas com produto identificado"}
        />
        <Kpi
          rotulo="Buscas fora do catálogo"
          valor={num(k.fora_do_catalogo)}
          detalhe="Pessoas procuraram algo que a sua marca não cadastrou"
        />
      </div>

      {"erro" in fun ? <ErroPainel erro={fun.erro} /> : <FunilDeUso f={fun.dados} />}

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            titulo="Mapa de cobertura"
            dica="Onde as pessoas buscaram e onde há revendedor. Passe o mouse (ou toque) nos pontos para ver os detalhes."
          />
          <div className="mt-4">
            <CoverageMap rede={c.rede} demanda={o.mapa_demanda} />
          </div>
        </Card>

        <Card>
          <CardHeader titulo="Maiores lacunas" dica="Produto procurado onde não há revendedor físico a 100 km." />
          {o.lacunas.length === 0 ? (
            k.buscas_com_produto === 0 ? (
              <Empty titulo="Sem dados para medir lacunas">Nenhuma busca do período identificou um produto do catálogo.</Empty>
            ) : (
              <Empty titulo="Nenhuma lacuna no período">Todas as buscas com produto encontraram revendedor por perto.</Empty>
            )
          ) : (
            <ol className="mt-3 divide-y divide-line">
              {o.lacunas.slice(0, 6).map((l) => (
                <li key={`${l.product_id}-${l.cidade}-${l.uf}`} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{l.produto}</p>
                    <p className="truncate text-[13px] text-ink-3">
                      {l.cidade}
                      {l.uf ? `/${l.uf}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="font-display text-xl font-semibold text-gap">{num(l.buscas)}</span>
                    <span className="block text-[11px] text-ink-3">{l.buscas === 1 ? "busca" : "buscas"}</span>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* Ao vivo: o que acabou de acontecer no site e quem da rede gera contato */}
      <div className="mb-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]" id="ao-vivo">
        {"erro" in rec ? <ErroPainel erro={rec.erro} /> : <UltimasBuscas eventos={rec.dados} />}
        {"erro" in perf ? <ErroPainel erro={perf.erro} /> : <QuemGeraContato rede={perf.dados} dias={dias} />}
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            titulo="Buscas por dia"
            dica="Linha escura: buscas. Linha verde: cliques em revendedor."
            direita={
              <ul className="flex shrink-0 gap-4 text-xs text-ink-2" aria-label="Legenda">
                <li className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 bg-ink" /> Buscas
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 bg-ok" /> Cliques
                </li>
              </ul>
            }
          />
          <div className="px-3 pb-4 pt-2 sm:px-5">
            {o.serie.length > 0 ? <TrendChart serie={o.serie} /> : <Empty titulo="Sem dados" />}
          </div>
        </Card>

        <Card>
          <CardHeader titulo="Produtos mais buscados" dica="A parte laranja da barra são as buscas sem revendedor por perto." />
          <div className="mt-3 pb-2">
            <BarList
              itens={o.top_produtos.map((p) => ({
                rotulo: p.name,
                sub: p.sku,
                valor: p.buscas,
                lacuna: p.sem_cobertura,
              }))}
              vazio="Nenhuma busca com produto identificado no período."
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            titulo="Procuraram e você não tem"
            dica="Termos buscados que não batem com nenhum produto do catálogo. Sinal para o time de produto."
          />
          <div className="mt-3 pb-2">
            <BarList
              itens={o.fora_do_catalogo.slice(0, 8).map((t) => ({ rotulo: t.termo, valor: t.buscas }))}
              vazio="Nenhuma busca fora do catálogo no período."
              neutro
            />
          </div>
        </Card>

        <Card>
          <CardHeader titulo="O que as pessoas fazem depois da busca" dica="Ação escolhida ao clicar em um revendedor." />
          <div className="mt-3 pb-2">
            <BarList
              itens={o.acoes.map((a) => ({ rotulo: ACAO_CLIQUE[a.acao] ?? a.acao, valor: a.cliques }))}
              vazio="Ainda não há cliques em revendedores no período."
              neutro
            />
          </div>
        </Card>
      </div>
    </>
  );
}
