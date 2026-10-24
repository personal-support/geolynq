/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
import { Card } from "@/components/ui";

export function ErroPainel({ erro }: { erro: string }) {
  return (
    <Card className="mx-auto mt-10 max-w-xl p-8 text-center">
      <p className="font-display text-xl font-semibold">Não foi possível carregar esta página</p>
      <p className="mt-2 text-[15px] text-ink-2">{erro}</p>
      <p className="mt-4 text-sm text-ink-3">Atualize a página. Se continuar, avise a GeoLynq informando a hora do problema.</p>
    </Card>
  );
}
