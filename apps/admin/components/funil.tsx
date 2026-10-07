import { Card, CardHeader, Empty } from "@/components/ui";
import { num, pct } from "@/lib/format";
import type { Funil } from "@/lib/types";

type Etapa = { rotulo: string; sub: string; valor: number };

function Degraus({ etapas, tom }: { etapas: Etapa[]; tom: "ink" | "ok" }) {
  const topo = Math.max(1, etapas[0]?.valor ?? 0);
  return (
    <ol className="space-y-3">
      {etapas.map((e, i) => {
        const anterior = i === 0 ? null : etapas[i - 1].valor;
        const doAnterior = anterior && anterior > 0 ? Math.round((100 * e.valor) / anterior) : null;
        return (
          <li key={e.rotulo} data-etapa={e.rotulo}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 text-sm font-semibold">{e.rotulo}</p>
              <p className="shrink-0 text-sm">
                <span className="font-display text-base font-semibold">{num(e.valor)}</span>
                {doAnterior !== null ? <span className="ml-2 text-xs text-ink-3">{pct(doAnterior)} da etapa anterior</span> : null}
              </p>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className={`h-full rounded-full ${tom === "ok" ? "bg-ok" : "bg-ink"}`} style={{ width: `${e.valor === 0 ? 0 : Math.max(3, Math.round((100 * e.valor) / topo))}%` }} />
            </div>
            <p className="mt-1 text-[12px] text-ink-3">{e.sub}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** Funil de uso do widget: o que as pessoas fazem entre abrir a página "Onde encontrar" e chegar a um revendedor. */
export function FunilDeUso({ f }: { f: Funil }) {
  const p = f.produto;
  const l = f.lista;
  const semNavegacao = p.escolheram === 0 && l.abriram === 0 && f.digitaram === 0;
  return (
    <Card className="mb-6">
      <CardHeader
        titulo="Como as pessoas usam o localizador"
        dica="Cada número é uma visita (uma abertura da página). Só entram visitas que digitaram, escolheram um produto ou abriram a lista. Quem recusou a medição não aparece."
      />
      {semNavegacao ? (
        <Empty titulo="Ainda não há navegação medida neste período">
          Quando alguém digitar no campo de busca, escolher um produto ou abrir a lista de revendedores, o caminho aparece aqui.
        </Empty>
      ) : (
        <div className="grid gap-8 px-5 pb-6 pt-4 lg:grid-cols-[1.3fr_1fr]" data-funil>
          <div className="space-y-8">
            <section aria-label="Caminho pelo produto">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">Caminho pelo produto</h3>
              <Degraus
                tom="ink"
                etapas={[
                  { rotulo: "Escolheram um produto", sub: "Clicaram em “Onde encontrar” (ou chegaram pela página do produto)", valor: p.escolheram },
                  { rotulo: "Informaram onde estão", sub: "CEP ou localização do aparelho", valor: p.localizacao },
                  { rotulo: "Havia revendedor por perto", sub: "Ao menos uma loja física a 100 km", valor: p.com_revendedor },
                  { rotulo: "Foram até um revendedor", sub: "WhatsApp, ligação, rota ou site", valor: p.clicaram },
                ]}
              />
            </section>
            <section aria-label="Caminho pela lista de revendedores">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">Caminho pela lista de revendedores</h3>
              <Degraus
                tom="ok"
                etapas={[
                  { rotulo: "Abriram a lista", sub: "Botão “Lista de revendedores”", valor: l.abriram },
                  { rotulo: "Filtraram", sub: "Escolheram estado, cidade ou produto", valor: l.filtraram },
                  { rotulo: "Foram até um revendedor", sub: "Clicaram em um contato depois de abrir a lista", valor: l.clicaram },
                ]}
              />
            </section>
          </div>

          <section aria-label="O que as pessoas digitam">
            <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">O que as pessoas digitam</h3>
            <p className="mb-3 text-[13px] text-ink-2">
              {num(f.digitaram)} {f.digitaram === 1 ? "visita digitou" : "visitas digitaram"} no campo de busca.
            </p>
            {f.termos.length === 0 ? (
              <p className="text-[13px] text-ink-3">Nenhum termo no período.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {f.termos.map((t) => (
                  <li key={t.termo} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate">
                      “{t.termo}”
                      {t.achou ? null : <span className="ml-2 rounded-md bg-gap-soft px-1.5 py-0.5 text-[11px] font-semibold text-gap-deep">fora do catálogo</span>}
                    </span>
                    <span className="shrink-0 font-semibold">{num(t.buscas)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Card>
  );
}
