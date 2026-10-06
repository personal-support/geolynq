import type { AvisoBase } from "@/lib/avisos";
import { LIMITE_BASE_PEQUENA } from "@/lib/avisos";
import { num } from "@/lib/format";

/** Faixa no topo de todas as telas quando o cliente tem eventos simulados (dados de teste). */
export function FaixaDemonstracao({ simulados, total }: { simulados: number; total: number }) {
  const tudo = simulados >= total;
  return (
    <div role="note" className="mb-6 flex gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3.5 text-warn sm:px-5">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0">
        <path d="M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
      </svg>
      <div className="text-[14px] leading-snug">
        <p className="font-semibold">Dados de demonstração</p>
        <p className="mt-0.5 text-warn/90">
          {tudo
            ? `Todos os ${num(total)} eventos deste painel foram simulados para testar o sistema.`
            : `${num(simulados)} de ${num(total)} eventos deste painel foram simulados; os números misturam dados simulados e reais.`}{" "}
          Não são buscas de consumidores reais e não representam o resultado de nenhum cliente.
        </p>
      </div>
    </div>
  );
}

/** Aviso de confiança estatística (pouca busca no período, ou período anterior pequeno demais para comparar). */
export function AvisoBasePequena({ aviso }: { aviso: AvisoBase }) {
  if (!aviso) return null;
  return (
    <div role="note" className="mb-6 flex gap-3 rounded-2xl border border-line-2 bg-card px-4 py-3.5 shadow-card sm:px-5">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0 text-ink-3">
        <path d="M3 3v18h18M7 14l4-4 3 3 5-6" />
      </svg>
      <div className="text-[14px] leading-snug text-ink-2">
        {aviso.tipo === "pequena" ? (
          <>
            <p className="font-semibold text-ink">Base pequena: {num(aviso.buscas)} {aviso.buscas === 1 ? "busca" : "buscas"} neste período</p>
            <p className="mt-0.5">
              Com menos de {LIMITE_BASE_PEQUENA} buscas, uma ou duas a mais mudam os percentuais. Leia os números como indício, não como conclusão
              {aviso.dias < 90 ? "; o período de 90 dias dá uma visão mais estável" : ""}.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-ink">Comparação pouco confiável</p>
            <p className="mt-0.5">
              O período anterior teve só {num(aviso.anterior)} {aviso.anterior === 1 ? "busca" : "buscas"}: as variações em % abaixo podem exagerar a mudança.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
