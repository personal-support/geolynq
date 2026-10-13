"use client";

import { useFormStatus } from "react-dom";

/** Botão que avisa que está trabalhando: a IA leva de 10 a 60 segundos e, sem aviso, parece que o clique não fez nada. */
export function BotaoGerar({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="rounded-lg border border-line-2 px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-line disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Gerando leitura… pode levar 1 minuto" : rotulo}
    </button>
  );
}
