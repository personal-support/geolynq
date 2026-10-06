import { Card, CardHeader, PageHeader, Pill } from "@/components/ui";
import { WidgetPreview } from "@/components/widget-preview";
import { getMembership } from "@/lib/data";
import { WIDGET_SCRIPT_URL } from "@/lib/env";

export const metadata = { title: "Widget no site" };

export default async function WidgetPage() {
  const m = await getMembership();
  if (!m) return null;
  const { slug, status, primary_color: cor } = m.tenant;
  const ativo = status === "active";

  const snippet = `<script src="${WIDGET_SCRIPT_URL}" defer></script>\n<geolynq-widget tenant="${slug}"></geolynq-widget>`;

  return (
    <>
      <PageHeader titulo="Widget no site" subtitulo="O “onde encontrar” que o consumidor usa no site da sua marca. Cada busca alimenta este painel." />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              titulo="Situação"
              direita={<Pill tom={ativo ? "ok" : "aviso"}>{ativo ? "No ar" : "Ainda não atende o público"}</Pill>}
            />
            <p className="px-5 pb-5 pt-3 text-[15px] text-ink-2">
              {ativo
                ? "O widget está ativo: quem usar o seu site encontra os revendedores, e as buscas aparecem na Visão geral."
                : "O widget só responde ao público quando a sua marca está ativa. Enquanto estiver em teste, ele mostra uma mensagem de indisponível. Fale com a GeoLynq para ativar."}
            </p>
          </Card>

          <Card>
            <CardHeader titulo="Instalar no seu site" dica="Cole estas duas linhas na página onde o “onde encontrar” deve aparecer." />
            <pre className="mx-5 mb-3 mt-4 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[12.5px] leading-relaxed text-white/90">
              <code>{snippet}</code>
            </pre>
            <ul className="space-y-1.5 px-5 pb-5 text-[13px] text-ink-2">
              <li>
                Em página de produto, acrescente <code className="rounded bg-paper px-1 py-0.5 font-mono text-xs">product=&quot;SKU&quot;</code> para abrir já com o
                produto escolhido.
              </li>
              <li>
                Para mudar a cor do botão, acrescente <code className="rounded bg-paper px-1 py-0.5 font-mono text-xs">color=&quot;#RRGGBB&quot;</code>.
              </li>
            </ul>
          </Card>
        </div>

        <Card>
          <CardHeader titulo="Pré-visualização" dica="O mesmo componente que roda no seu site, lendo os seus dados reais." />
          <div className="p-5">
            {ativo ? (
              <WidgetPreview slug={slug} cor={cor} scriptUrl={WIDGET_SCRIPT_URL} />
            ) : (
              <p className="rounded-xl border border-dashed border-line-2 bg-paper p-6 text-center text-sm text-ink-3">
                A pré-visualização aparece quando a sua marca estiver ativa.
              </p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
