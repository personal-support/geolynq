"use client";

import { useEffect, useRef, useState } from "react";
import type { PontoDemanda, ResellerRow } from "@/lib/types";

/**
 * Mapa de cobertura (assinatura do painel).
 *  - discos teal translúcidos = área de 100 km ao redor de cada revendedor FÍSICO (é o raio de busca do widget);
 *  - pontos teal = revendedores;  - anéis = onde as pessoas buscaram (tamanho = nº de buscas);
 *  - anel LARANJA preenchido = 50% ou mais das buscas dali ficaram sem revendedor por perto.
 * Base: OpenStreetMap em tons de cinza (CSS em globals.css) para que teal e laranja sejam as únicas cores.
 */
export function CoverageMap({
  rede,
  demanda,
  raioKm = 100,
}: {
  rede: ResellerRow[];
  demanda: PontoDemanda[];
  raioKm?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const enquadrar = useRef<{ tudo: () => void; rede: () => void } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const temPontos = rede.some((r) => r.lat != null && r.lng != null) || demanda.length > 0;

  useEffect(() => {
    if (!temPontos) return;
    let cancelado = false;
    let mapa: import("leaflet").Map | undefined;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelado || !ref.current) return;

        mapa = L.map(ref.current, { scrollWheelZoom: false, worldCopyJump: false });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapa);

        const limites = L.latLngBounds([]);
        const limitesRede = L.latLngBounds([]);
        const fisicos = rede.filter((r) => r.tipo !== "online" && r.lat != null && r.lng != null);

        for (const r of fisicos) {
          L.circle([r.lat!, r.lng!], {
            radius: raioKm * 1000,
            color: "#0b7a75",
            weight: 1,
            opacity: 0.3,
            fillColor: "#0b7a75",
            fillOpacity: 0.13,
            interactive: false,
          }).addTo(mapa);
        }

        for (const r of fisicos) {
          L.circleMarker([r.lat!, r.lng!], { radius: 5, color: "#ffffff", weight: 1.5, fillColor: "#0b7a75", fillOpacity: 1 })
            .bindTooltip(`${esc(r.nome)}<br/><span style="color:#5d7482">${esc(r.cidade ?? "")}${r.uf ? "/" + esc(r.uf) : ""}</span>`, {
              className: "gl-tooltip",
            })
            .addTo(mapa);
          limites.extend([r.lat!, r.lng!]);
          limitesRede.extend([r.lat!, r.lng!]);
        }

        for (const p of demanda) {
          const lacuna = p.buscas > 0 ? p.sem_cobertura / p.buscas : 0;
          const critico = lacuna >= 0.5;
          const raio = 7 + Math.sqrt(p.buscas) * 2.4;
          L.circleMarker([p.lat, p.lng], {
            radius: raio,
            color: critico ? "#d94a18" : "#0a1f2c",
            weight: 2,
            fillColor: critico ? "#d94a18" : "#ffffff",
            fillOpacity: critico ? 0.28 : 0.15,
          })
            .bindTooltip(
              `<b>${esc(p.cidade)}${p.uf ? "/" + esc(p.uf) : ""}</b><br/>${p.buscas} ${p.buscas === 1 ? "busca" : "buscas"}` +
                (p.sem_cobertura > 0
                  ? `<br/><span style="color:#a8350d">${p.sem_cobertura} sem revendedor por perto</span>`
                  : `<br/><span style="color:#075a56">todas atendidas</span>`),
              { className: "gl-tooltip" },
            )
            .addTo(mapa);
          limites.extend([p.lat, p.lng]);
        }

        const m = mapa;
        const tudo = () => (limites.isValid() ? m.fitBounds(limites, { padding: [36, 36], maxZoom: 9 }) : m.setView([-14.2, -51.9], 4));
        // "A rede": foca onde há revendedor (com folga de ~100 km) para ver os discos de cobertura; os pontos distantes saem do quadro
        const soRede = () => (limitesRede.isValid() ? m.fitBounds(limitesRede.pad(0.6), { padding: [24, 24], maxZoom: 9 }) : tudo());
        enquadrar.current = { tudo, rede: soRede };
        soRede();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "falha ao carregar o mapa");
      }
    })();

    return () => {
      cancelado = true;
      enquadrar.current = null;
      mapa?.remove();
    };
  }, [rede, demanda, raioKm, temPontos]);

  if (!temPontos) {
    return (
      <div className="flex h-[440px] items-center justify-center rounded-b-2xl bg-paper px-6 text-center text-sm text-ink-3">
        O mapa aparece quando houver revendedores com endereço localizado ou buscas com localização.
      </div>
    );
  }

  return (
    <div className="gl-map">
      <div className="flex gap-2 px-5 pb-3" role="group" aria-label="Enquadramento do mapa">
        <button type="button" onClick={() => enquadrar.current?.rede()} className="rounded-lg border border-line-2 bg-white px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-paper">
          Foco na rede
        </button>
        <button type="button" onClick={() => enquadrar.current?.tudo()} className="rounded-lg border border-line-2 bg-white px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-paper">
          Mostrar todas as buscas
        </button>
      </div>
      <div
        ref={ref}
        role="application"
        aria-label="Mapa de cobertura: revendedores, área de 100 km e locais de busca"
        className="h-[440px] w-full overflow-hidden"
      />
      {erro ? <p className="px-5 py-2 text-xs text-gap-deep">Mapa indisponível: {erro}</p> : null}
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 px-5 py-3 text-xs text-ink-2" aria-label="Legenda do mapa">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-ok" /> Revendedor
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-full bg-ok/20" /> Área de {raioKm} km
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 border-ink bg-white/60" /> Buscas atendidas
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 border-gap bg-gap/30" /> Buscas sem revendedor por perto
        </li>
      </ul>
    </div>
  );
}

/** Texto vindo do banco entra em HTML de tooltip: escapar sempre. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
