import { Card, CardHeader, Empty } from "@/components/ui";
import { ACAO_CLIQUE, haQuanto, num, TIPO_REVENDEDOR } from "@/lib/format";
import type { EventoRecente, RevendedorDesempenho } from "@/lib/types";

/** Passos de navegação (digitou, escolheu produto, abriu a lista, filtrou a lista). */
function LinhaNavegacao({ e, local }: { e: EventoRecente; local: string | null }) {
  let titulo = "";
  let detalhe = "";
  if (e.tipo === "catalog_search") {
    titulo = `Digitou “${e.termo ?? "—"}”`;
    detalhe = `${num(e.resultado)} ${e.resultado === 1 ? "produto encontrado" : "produtos encontrados"}`;
  } else if (e.tipo === "product_select") {
    titulo = `Escolheu ${e.produto ?? "um produto"}`;
    detalhe = "Clicou em “Onde encontrar”";
  } else if (e.tipo === "list_open") {
    titulo = "Abriu a lista de revendedores";
    detalhe = e.produto ? `a partir de ${e.produto}` : "pelo botão do início";
  } else {
    titulo = "Filtrou a lista de revendedores";
    detalhe = [e.produto, local, `${num(e.resultado)} ${e.resultado === 1 ? "revendedor" : "revendedores"}`].filter(Boolean).join(" · ");
  }
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <span className="mt-0.5 rounded-md bg-line px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Navegação</span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{titulo}</p>
        <p className="truncate text-[13px] text-ink-3">{detalhe}</p>
      </div>
      <time dateTime={e.quando} className="shrink-0 text-xs text-ink-3">
        {haQuanto(e.quando)}
      </time>
    </li>
  );
}

function Linha({ e }: { e: EventoRecente }) {
  const local = e.cidade ? `${e.cidade}${e.uf ? `/${e.uf}` : ""}` : null;
  if (e.tipo === "reseller_click") {
    return (
      <li className="flex items-start gap-3 px-5 py-3">
        <span className="mt-0.5 rounded-md bg-ok-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ok-deep">Contato</span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">
            {e.acao ? ACAO_CLIQUE[e.acao] ?? e.acao : "Contato"} · {e.revendedor ?? "revendedor"}
          </p>
          <p className="truncate text-[13px] text-ink-3">{[e.produto, local].filter(Boolean).join(" · ")}</p>
        </div>
        <time dateTime={e.quando} className="shrink-0 text-xs text-ink-3">
          {haQuanto(e.quando)}
        </time>
      </li>
    );
  }
  if (e.tipo !== "search") return <LinhaNavegacao e={e} local={local} />;
  const foraDoCatalogo = !e.produto;
  const semLoja = !foraDoCatalogo && (e.resultado ?? 0) === 0;
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <span className="mt-0.5 rounded-md bg-line px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Busca</span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {foraDoCatalogo ? (
            <>
              “{e.termo ?? "—"}” <span className="font-normal text-ink-3">· fora do catálogo</span>
            </>
          ) : (
            e.produto
          )}
        </p>
        <p className="truncate text-[13px] text-ink-3">
          {local ?? "local não informado"}
          {foraDoCatalogo ? null : semLoja ? (
            <>
              {" · "}
              <span className="font-semibold text-gap-deep">sem loja por perto</span>
              {(e.online ?? 0) > 0 ? " (há loja online)" : ""}
            </>
          ) : (
            ` · ${num(e.resultado)} ${e.resultado === 1 ? "loja" : "lojas"} por perto`
          )}
        </p>
      </div>
      <time dateTime={e.quando} className="shrink-0 text-xs text-ink-3">
        {haQuanto(e.quando)}
      </time>
    </li>
  );
}

/** Feed das últimas buscas e contatos. Atualiza ao recarregar a página. */
export function UltimasBuscas({ eventos }: { eventos: EventoRecente[] }) {
  return (
    <Card>
      <CardHeader
        titulo="Atividade ao vivo"
        dica="O que acabou de acontecer no site da sua marca: navegação, buscas e contatos. Recarregue a página para atualizar."
        direita={
          <a href="/dashboard" className="shrink-0 rounded-lg border border-line-2 px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-line">
            Atualizar
          </a>
        }
      />
      {eventos.length === 0 ? (
        <Empty titulo="Nada por aqui ainda">Quando alguém buscar, escolher um produto ou clicar em um revendedor, aparece aqui.</Empty>
      ) : (
        <ul className="mt-3 divide-y divide-line pb-2">
          {eventos.map((e, i) => (
            <Linha key={`${e.quando}-${i}`} e={e} />
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Quem da rede mais gera contato no período; mostra também quem está parado. */
export function QuemGeraContato({ rede, dias }: { rede: RevendedorDesempenho[]; dias: number }) {
  const fisicosOuTodos = rede;
  const top = fisicosOuTodos.filter((r) => r.contatos > 0).slice(0, 6);
  const parados = fisicosOuTodos.filter((r) => r.contatos === 0 && r.tipo !== "online");
  const max = Math.max(1, ...top.map((r) => r.contatos));
  return (
    <Card>
      <CardHeader
        titulo="Quem gera contato"
        dica={`Revendedores que mais receberam clique (WhatsApp, ligação, rota ou site) nos últimos ${dias} dias.`}
      />
      {top.length === 0 ? (
        <Empty titulo="Sem contatos no período">Ainda não houve clique em revendedores.</Empty>
      ) : (
        <ol className="mt-3 divide-y divide-line pb-2">
          {top.map((r) => (
            <li key={r.id} className="px-5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold">{r.nome}</p>
                <p className="shrink-0 font-display text-base font-semibold">{num(r.contatos)}</p>
              </div>
              <p className="truncate text-[13px] text-ink-3">
                {TIPO_REVENDEDOR[r.tipo] ?? r.tipo}
                {r.cidade ? ` · ${r.cidade}${r.uf ? `/${r.uf}` : ""}` : ""}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                <div className="h-full rounded-full bg-ok" style={{ width: `${Math.max(4, Math.round((100 * r.contatos) / max))}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
      {parados.length > 0 ? (
        <p className="border-t border-line px-5 py-3 text-[13px] text-ink-2">
          <span className="font-semibold text-gap-deep">{num(parados.length)}</span> {parados.length === 1 ? "loja física não recebeu" : "lojas físicas não receberam"} nenhum
          contato no período: {parados.slice(0, 3).map((r) => r.nome).join(", ")}
          {parados.length > 3 ? "…" : ""}.
        </p>
      ) : null}
    </Card>
  );
}
