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
