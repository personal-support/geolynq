import { ErroPainel } from "@/components/erro-painel";
import { Card, CardHeader, Empty, Kpi, PageHeader, Pill, TD, TH } from "@/components/ui";
import { carregar, getCatalog, getMembership } from "@/lib/data";
import { num, pct, TIPO_REVENDEDOR } from "@/lib/format";

export const metadata = { title: "Rede de revendedores" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default async function Rede({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = um(sp.q).trim();
  const uf = um(sp.uf).trim();
  const tipo = um(sp.tipo).trim();

  const m = await getMembership();
  if (!m) return null;
  const r = await carregar(() => getCatalog(m.tenant.id));
  if ("erro" in r) return <ErroPainel erro={r.erro} />;
  const c = r.dados;
  const cp = c.completude;

  const ufs = [...new Set(c.rede.map((x) => x.uf).filter((x): x is string => !!x))].sort();
  const lista = c.rede.filter(
    (x) =>
      (!q || semAcento(`${x.nome} ${x.cidade ?? ""} ${x.cnpj ?? ""}`).includes(semAcento(q))) &&
      (!uf || x.uf === uf) &&
      (!tipo || x.tipo === tipo),
  );
  const filtrando = Boolean(q || uf || tipo);
  const semCoord = cp.fisicos - cp.fisicos_com_coordenadas;

  return (
    <>
      <PageHeader titulo="Rede de revendedores" subtitulo="Quem vende os seus produtos hoje, onde estão e quão completo está o cadastro." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi rotulo="Revendedores ativos" valor={num(cp.total)} detalhe={`${num(cp.fisicos)} físicos · ${num(cp.total - cp.fisicos)} online`} />
        <Kpi rotulo="Com WhatsApp" valor={pct(cp.total ? (100 * cp.com_whatsapp) / cp.total : null)} detalhe={`${num(cp.com_whatsapp)} de ${num(cp.total)}`} />
        <Kpi rotulo="Com CNPJ" valor={pct(cp.total ? (100 * cp.com_cnpj) / cp.total : null)} detalhe={`${num(cp.com_cnpj)} de ${num(cp.total)}`} />
        <Kpi
          rotulo="Físicos localizados no mapa"
          valor={pct(cp.fisicos ? (100 * cp.fisicos_com_coordenadas) / cp.fisicos : null)}
          detalhe={
            semCoord > 0
              ? `${num(semCoord)} sem coordenadas não aparece${semCoord === 1 ? "" : "m"} na busca por distância`
              : "Todos aparecem na busca por distância"
          }
        />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_2.2fr]">
        <Card>
          <CardHeader titulo="Por estado" />
          {c.por_uf.length === 0 ? (
            <Empty titulo="Nenhum revendedor cadastrado" />
          ) : (
            <ul className="mt-3 divide-y divide-line pb-2">
              {c.por_uf.map((u) => (
                <li key={u.uf} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="font-semibold">{u.uf}</span>
                  <span className="text-ink-2">
                    <span className="font-display text-base font-semibold text-ink">{num(u.revendedores)}</span>
                    <span className="ml-2 text-xs text-ink-3">
                      {u.fisicos} {u.fisicos === 1 ? "físico" : "físicos"}
                      {u.online ? ` · ${u.online} online` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader titulo="Revendedores" dica={`${num(lista.length)} ${lista.length === 1 ? "encontrado" : "encontrados"}${filtrando ? " com os filtros" : ""}.`} />
          <form method="get" className="mt-4 flex flex-wrap items-end gap-3 px-5" role="search">
            <label className="min-w-[200px] flex-1 text-xs font-semibold text-ink-3">
              Buscar por nome, cidade ou CNPJ
              <input
                name="q"
                defaultValue={q}
                className="mt-1 block w-full rounded-lg border border-line-2 bg-white px-3 py-2 text-sm font-normal text-ink focus:border-ok focus:outline-none focus:ring-2 focus:ring-ok/25"
              />
            </label>
            <label className="text-xs font-semibold text-ink-3">
              Estado
              <select name="uf" defaultValue={uf} className="mt-1 block rounded-lg border border-line-2 bg-white px-3 py-2 text-sm font-normal text-ink">
                <option value="">Todos</option>
                {ufs.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-ink-3">
              Tipo
              <select name="tipo" defaultValue={tipo} className="mt-1 block rounded-lg border border-line-2 bg-white px-3 py-2 text-sm font-normal text-ink">
                <option value="">Todos</option>
                {Object.entries(TIPO_REVENDEDOR).map(([v, rot]) => (
                  <option key={v} value={v}>
                    {rot}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-2">
              Filtrar
            </button>
            {filtrando ? (
              <a href="/dashboard/rede" className="py-2 text-sm font-medium text-ink-2 underline underline-offset-2">
                Limpar
              </a>
            ) : null}
          </form>

          {lista.length === 0 ? (
            <Empty titulo={filtrando ? "Nenhum revendedor com esses filtros" : "Nenhum revendedor cadastrado"}>
              {filtrando ? "Tente outro nome ou limpe os filtros." : "Os revendedores aparecem aqui depois da importação do catálogo."}
            </Empty>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-y border-line">
                    <th className={TH}>Revendedor</th>
                    <th className={TH}>Tipo</th>
                    <th className={TH}>Local</th>
                    <th className={TH}>Contato</th>
                    <th className={`${TH} text-right`}>Produtos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lista.map((x) => {
                    const fisicoSemCoord = x.tipo !== "online" && (x.lat == null || x.lng == null);
                    return (
                      <tr key={x.id}>
                        <td className={TD}>
                          <p className="font-semibold">{x.nome}</p>
                          {x.cnpj ? <p className="font-mono text-[11px] text-ink-3">{formataCnpj(x.cnpj)}</p> : null}
                        </td>
                        <td className={TD}>{TIPO_REVENDEDOR[x.tipo] ?? x.tipo}</td>
                        <td className={TD}>
                          {x.cidade ?? "—"}
                          {x.uf ? <span className="text-ink-3">/{x.uf}</span> : null}
                          {fisicoSemCoord ? (
                            <p className="mt-1">
                              <Pill tom="ruim">Fora da busca por distância</Pill>
                            </p>
                          ) : null}
                        </td>
                        <td className={`${TD} text-[13px] text-ink-2`}>
                          {[x.tem_whatsapp && "WhatsApp", x.tem_telefone && "Telefone", x.tem_site && "Site"].filter(Boolean).join(" · ") || (
                            <span className="text-gap-deep">Sem contato</span>
                          )}
                        </td>
                        <td className={`${TD} text-right font-display text-base font-semibold`}>
                          {x.produtos === 0 ? <span className="text-gap-deep">0</span> : num(x.produtos)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function formataCnpj(v: string) {
  return v.length === 14 ? v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : v;
}
