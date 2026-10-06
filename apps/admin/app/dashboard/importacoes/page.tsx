import { ErroPainel } from "@/components/erro-painel";
import { Card, Empty, PageHeader, Pill } from "@/components/ui";
import { carregar, getImports, getMembership } from "@/lib/data";
import { dataHora, haQuanto, num, STATUS_IMPORTACAO } from "@/lib/format";

export const metadata = { title: "Importações" };

export default async function Importacoes() {
  const m = await getMembership();
  if (!m) return null;
  const r = await carregar(() => getImports(m.tenant.id));
  if ("erro" in r) return <ErroPainel erro={r.erro} />;
  const lotes = r.dados;

  return (
    <>
      <PageHeader
        titulo="Importações"
        subtitulo="Cada envio da planilha de catálogo, o que entrou e o que precisa de correção. Corrija a planilha e reimporte: nada é duplicado."
      />

      <Card>
        {lotes.length === 0 ? (
          <Empty titulo="Nenhuma importação ainda">A GeoLynq importa o seu catálogo a partir da planilha-modelo. O histórico aparece aqui.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {lotes.map((l) => {
              const st = STATUS_IMPORTACAO[l.status] ?? { rotulo: l.status, tom: "aviso" as const };
              const log = l.error_log ?? [];
              const avisos = log.filter((e) => e._error.startsWith("AVISO"));
              const erros = log.filter((e) => !e._error.startsWith("AVISO"));
              const quando = l.completed_at ?? l.created_at;
              return (
                <li key={l.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {dataHora(quando)} <span className="ml-1 text-sm font-normal text-ink-3">({haQuanto(quando)})</span>
                      </p>
                      <p className="mt-0.5 text-[13px] text-ink-3">
                        {num(l.rows_processed)} linhas lidas · {num(l.rows_failed)} {l.rows_failed === 1 ? "falha" : "falhas"}
                        {avisos.length ? ` · ${avisos.length} ${avisos.length === 1 ? "aviso" : "avisos"}` : ""}
                      </p>
                    </div>
                    <Pill tom={st.tom}>{st.rotulo}</Pill>
                  </div>

                  {log.length > 0 ? (
                    <details className="mt-3 rounded-xl border border-line bg-paper">
                      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold">
                        Ver o que corrigir ({erros.length} {erros.length === 1 ? "erro" : "erros"}
                        {avisos.length ? `, ${avisos.length} ${avisos.length === 1 ? "aviso" : "avisos"}` : ""})
                      </summary>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-t border-line text-left text-[12px] uppercase tracking-wide text-ink-3">
                            <th className="px-4 py-2 font-semibold">Aba</th>
                            <th className="px-4 py-2 font-semibold">Linha</th>
                            <th className="px-4 py-2 font-semibold">O que aconteceu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {log.map((e, i) => (
                            <tr key={i} className={e._error.startsWith("AVISO") ? "bg-warn-soft/50" : ""}>
                              <td className="px-4 py-2">{e._sheet}</td>
                              <td className="px-4 py-2 font-mono text-xs">{e._row ?? "—"}</td>
                              <td className="px-4 py-2">{e._error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
