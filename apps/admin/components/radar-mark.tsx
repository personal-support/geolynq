/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
/** Marca do GeoLynq: alvo de radar com varredura lenta e um ponto de lacuna (laranja). */
export function RadarMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="GeoLynq"
      className={className}
    >
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeOpacity="0.9" strokeWidth="2" />
      <circle cx="24" cy="24" r="13.5" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2" />
      <circle cx="24" cy="24" r="6" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
      <g className="gl-sweep">
        <path d="M24 24 L24 3 A21 21 0 0 1 42.2 13.5 Z" fill="currentColor" fillOpacity="0.22" />
        <path d="M24 24 L24 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx="35" cy="31" r="3.6" fill="#d94a18" />
    </svg>
  );
}
