/**
 * Escolha do visitante sobre a medição anônima. Só existem dois estados guardados:
 *   "ok" = leu o aviso (medição continua) · "no" = recusou (NADA é gravado nem contado).
 * Sem escolha (null) a medição segue ligada: o aviso não trava o widget.
 * Guardamos apenas esta preferência (nada de identificador), para não perguntar de novo e para honrar a recusa nas próximas páginas.
 * Se o navegador bloquear o armazenamento, a escolha vale só até recarregar a página.
 */
export type Consent = "ok" | "no" | null;

const KEY = "geolynq_medicao";
/** Disparado em `window` quando o visitante escolhe, para fechar o aviso em todos os widgets da página. */
export const CONSENT_EVENT = "geolynq:consent";
let memory: Consent = null;

export function readConsent(): Consent {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "ok" || v === "no") return v;
  } catch {
    /* armazenamento bloqueado: vale a memória */
  }
  return memory;
}

export function saveConsent(c: "ok" | "no"): void {
  memory = c;
  try {
    window.localStorage.setItem(KEY, c);
  } catch {
    /* ignora */
  }
}

/** Única porta para gravar telemetria: recusou, não grava. */
export function mayTrack(): boolean {
  return readConsent() !== "no";
}
