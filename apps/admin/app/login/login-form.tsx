/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const CAMPO =
  "mt-1.5 block w-full rounded-xl border border-line-2 bg-white px-3.5 py-3 text-[15px] text-ink shadow-sm placeholder:text-ink-3/70 focus:border-ok focus:outline-none focus:ring-2 focus:ring-ok/25";

export function LoginForm({ next }: { next: string }) {
  const [estado, acao, pendente] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={acao} className="mt-8 space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />

      <div>
        <label htmlFor="email" className="text-sm font-semibold">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          defaultValue={estado.email}
          placeholder="voce@suamarca.com.br"
          className={CAMPO}
          aria-invalid={estado.erro ? true : undefined}
          aria-describedby={estado.erro ? "erro-login" : undefined}
        />
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-semibold">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={CAMPO}
          aria-invalid={estado.erro ? true : undefined}
          aria-describedby={estado.erro ? "erro-login" : undefined}
        />
      </div>

      {estado.erro ? (
        <p id="erro-login" role="alert" className="rounded-lg bg-gap-soft px-3.5 py-2.5 text-sm font-medium text-gap-deep">
          {estado.erro}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendente}
        className="w-full rounded-xl bg-ink px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-ink-2 disabled:cursor-wait disabled:opacity-70"
      >
        {pendente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
