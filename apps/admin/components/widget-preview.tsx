/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
"use client";

import { createElement, useEffect } from "react";

/** Carrega o bundle público do widget e exibe o componente real do cliente (o mesmo que roda no site dele). */
export function WidgetPreview({ slug, cor, scriptUrl }: { slug: string; cor: string | null; scriptUrl: string }) {
  useEffect(() => {
    if (document.querySelector("script[data-geolynq-widget]")) return;
    const s = document.createElement("script");
    s.src = scriptUrl;
    s.defer = true;
    s.setAttribute("data-geolynq-widget", "");
    document.head.appendChild(s);
  }, [scriptUrl]);

  return (
    <div className="rounded-xl border border-dashed border-line-2 bg-paper p-4">
      {createElement("geolynq-widget", { tenant: slug, ...(cor ? { color: cor } : {}) })}
    </div>
  );
}
