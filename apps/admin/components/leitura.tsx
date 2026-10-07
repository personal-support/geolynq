import { gerarLeituraIA } from "@/app/dashboard/actions";
import { Card, CardHeader, Empty } from "@/components/ui";
import type { LeituraGuardada } from "@/lib/data";
import { MENSAGEM_ERRO, type ErroIA } from "@/lib/ia";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Botao({ dias, rotulo }: { dias: number; rotulo: string }) {
  return (
    <form action={gerarLeituraIA}>
      <input type="hidden" name="dias" value={dias} />
      <button
        type="submit"
        className="rounded-lg border border-line-2 px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-line"
      >
        {rotulo}
      </button>
    </form>
  );
}

/** Leitura do período por IA. Os números vêm do banco e são conferidos antes de aparecer (lib/ia.ts). */
export function LeituraDoPeriodo({ leitura, dias, erro }: { leitura: LeituraGuardada | null; dias: number; erro: string | null }) {
  const msg = erro && erro in MENSAGEM_ERRO ? MENSAGEM_ERRO[erro as ErroIA] : null;
  const c = leitura?.conteudo;
  return (
    <Card className="mb-6">
      <div id="leitura" />
      <CardHeader
        titulo="Leitura do período"
        dica="Texto escrito por IA a partir dos números deste painel. Cada número citado é conferido contra os dados antes de aparecer; a IA não calcula nada."
        direita={leitura ? <Botao dias={dias} rotulo="Gerar nova leitura" /> : undefined}
      />
      <div className="px-5 pb-6 pt-4">
        {msg ? (
          <p role="alert" className="mb-4 rounded-xl border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">
            {msg}
          </p>
        ) : null}
        {!c ? (
          <div className="flex flex-col items-start gap-4">
            <Empty titulo="Nenhuma leitura gerada para este período">
              Gere um resumo com os pontos de atenção e as ações sugeridas para a equipe comercial.
            </Empty>
            <Botao dias={dias} rotulo="Gerar leitura" />
          </div>
        ) : (
          <div data-leitura>
            <p className="max-w-3xl text-[17px] leading-snug text-ink">{c.resumo}</p>
            {c.destaques.length > 0 ? (
              <ul className="mt-5 grid gap-3 md:grid-cols-2">
                {c.destaques.map((d) => (
                  <li key={d.titulo} className="rounded-xl border border-line bg-paper px-4 py-3">
                    <p className="text-sm font-semibold">{d.titulo}</p>
                    <p className="mt-1 text-[13px] leading-snug text-ink-2">{d.texto}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            <h3 className="mb-2 mt-6 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">O que fazer agora</h3>
            <ol className="space-y-2.5">
              {c.acoes.map((a) => (
                <li key={a.acao} className="flex gap-3 text-sm">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink" />
                  <p>
                    <span className="font-semibold">{a.acao}</span> <span className="text-ink-2">{a.motivo}</span>
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-xs text-ink-3">
              Gerada por IA em {quando(leitura.created_at)}, com os dados dos últimos {dias} dias. Confira sempre os números nos cartões acima e abaixo.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
