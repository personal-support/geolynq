import { ErroPainel } from "@/components/erro-painel";
import { Card, CardHeader, Empty, Kpi, PageHeader, Pill, TD, TH } from "@/components/ui";
import { carregar, getCatalog, getMembership } from "@/lib/data";
import { num, TIPO_REVENDEDOR, rotuloCategoria } from "@/lib/format";

export const metadata = { title: "Catálogo" };

export default async function Catalogo() {
  const m = await getMembership();
  if (!m) return null;
  const r = await carregar(() => getCatalog(m.tenant.id));
  if ("erro" in r) return <ErroPainel erro={r.erro} />;
  const c = r.dados;

  return (
    <>
      <PageHeader
        titulo="Catálogo e cobertura"
        subtitulo="Cada produto da sua marca e quantos revendedores o vendem. Produto sem revendedor é lacuna que já existe antes de alguém buscar."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi rotulo="Produtos ativos" valor={num(c.produtos_ativos)} />
        <Kpi
          rotulo="Sem nenhum revendedor"
          valor={<span className={c.produtos_sem_revendedor.length ? "text-gap" : ""}>{num(c.produtos_sem_revendedor.length)}</span>}
          detalhe={c.produtos_sem_revendedor.length ? c.produtos_sem_revendedor.map((p) => p.name).slice(0, 2).join(", ") : "Todos têm onde ser vendidos"}
        />
        <Kpi
          rotulo="Só em loja online"
          valor={num(c.produtos_sem_revendedor_fisico.length)}
          detalhe="Produtos sem revendedor físico: não atendem quem busca perto de casa"
        />
        <Kpi
          rotulo="Revendedores sem produto"
          valor={num(c.revendedores_sem_produto.length)}
          detalhe={c.revendedores_sem_produto.length ? "Provável erro na planilha de cobertura" : "Todos vendem algum produto"}
        />
      </div>

      <Card className="mb-6">
        <CardHeader titulo="Produtos" dica="“Físicos” são os revendedores que entram na busca por distância." />
        {c.produtos.length === 0 ? (
          <Empty titulo="Nenhum produto cadastrado">Os produtos aparecem aqui depois da importação do catálogo.</Empty>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-y border-line">
                  <th className={TH}>Produto</th>
                  <th className={TH}>Categoria</th>
                  <th className={`${TH} text-right`}>Revendedores</th>
                  <th className={`${TH} text-right`}>Físicos</th>
                  <th className={TH}>Estados com revendedor físico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {c.produtos.map((p) => (
                  <tr key={p.id}>
                    <td className={TD}>
                      <p className="font-semibold">{p.name}</p>
                      <p className="font-mono text-[11px] text-ink-3">{p.sku}</p>
                    </td>
                    <td className={`${TD} text-ink-2`}>{rotuloCategoria(p.category)}</td>
                    <td className={`${TD} text-right font-display text-base font-semibold`}>{num(p.revendedores)}</td>
                    <td className={`${TD} text-right`}>{num(p.fisicos)}</td>
                    <td className={TD}>
                      {p.revendedores === 0 ? (
                        <Pill tom="ruim">Sem revendedor</Pill>
                      ) : p.fisicos === 0 ? (
                        <Pill tom="aviso">Só online</Pill>
                      ) : (
                        <span className="text-ink-2">{p.ufs.join(", ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {c.revendedores_sem_produto.length > 0 ? (
        <Card>
          <CardHeader
            titulo="Revendedores sem nenhum produto vinculado"
            dica="Eles não aparecem em nenhuma busca. Confira a aba Cobertura da planilha de importação."
          />
          <ul className="mt-3 divide-y divide-line pb-2">
            {c.revendedores_sem_produto.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="font-semibold">{x.name}</span>
                <span className="text-ink-3">
                  {TIPO_REVENDEDOR[x.type] ?? x.type}
                  {x.city ? ` · ${x.city}${x.state ? "/" + x.state : ""}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
