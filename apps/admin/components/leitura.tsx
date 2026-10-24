/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
import { gerarLeituraIA } from "@/app/dashboard/actions";
import { BotaoGerar } from "@/components/botao-gerar";
import { Card, CardHeader, Empty } from "@/components/ui";
import type { LeituraGuardada } from "@/lib/data";
import { num } from "@/lib/format";
import type { Periodo } from "@/lib/periodo";
import { MENSAGEM_ERRO, type ErroIA } from "@/lib/ia";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Botao({ periodo, rotulo }: { periodo: Periodo; rotulo: string }) {
  return (
    <form action={gerarLeituraIA}>
      {[...new URLSearchParams(periodo.query)].map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <BotaoGerar rotulo={rotulo} />
    </form>
  );
}

/** Leitura do período por IA. Os números vêm do banco e são conferidos antes de aparecer (lib/ia.ts). */
export function LeituraDoPeriodo({ leitura, periodo, erro, detalhe, simulados }: { leitura: LeituraGuardada | null; periodo: Periodo; erro: string | null; detalhe?: string | null; simulados?: { simulados: number; total: number } | null }) {
  const msg = erro && erro in MENSAGEM_ERRO ? MENSAGEM_ERRO[erro as ErroIA] : null;
  const c = leitura?.conteudo;
  return (
    <Card className="mb-6">
      <div id="leitura" />
      <CardHeader
        titulo="Leitura do período"
        dica="Texto escrito por IA a partir dos números deste painel. Cada número citado é conferido contra os dados antes de aparecer; a IA não calcula nada."
        direita={leitura ? <Botao periodo={periodo} rotulo="Gerar nova leitura" /> : undefined}
      />
      <div className="px-5 pb-6 pt-4">
        {simulados && simulados.simulados > 0 ? (
          <p className="mb-4 rounded-xl border border-line bg-paper px-4 py-2.5 text-xs text-ink-2">
            Esta leitura usa os números deste painel, que incluem dados de demonstração ({num(simulados.simulados)} de {num(simulados.total)} eventos simulados). Não representa o resultado de nenhum cliente real.
          </p>
        ) : null}
        {msg ? (
          <p role="alert" className="mb-4 rounded-xl border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">
            {msg}
            {erro === "nao_confiavel" && detalhe ? <span className="mt-1 block text-xs">Detalhe técnico: {detalhe.startsWith("formato") ? `resposta fora do formato combinado (${detalhe.replace("formato", "").trim() || "?"})` : `números reprovados: ${detalhe}`}</span> : null}
          </p>
        ) : null}
        {!c ? (
          <div className="flex flex-col items-start gap-4">
            <Empty titulo="Nenhuma leitura gerada para este período">
              Gere um resumo com os pontos de atenção e as ações sugeridas para a equipe comercial.
            </Empty>
            <Botao periodo={periodo} rotulo="Gerar leitura" />
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
              Gerada por IA em {quando(leitura.created_at)}, com os dados do período “{periodo.rotulo}”. Vale por 24 horas: depois disso os números já mudaram e ela some. Confira sempre os números nos cartões acima e abaixo.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
