/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
import Link from "next/link";
import { marcarCandidato } from "@/app/dashboard/actions";
import { Card, CardHeader, Empty } from "@/components/ui";
import { ANDAMENTOS, enderecoRua, formataCep, formataCnpj, formataTelefone, linkGoogle, linkMapa, ROTULO_ANDAMENTO } from "@/lib/candidatos";
import { num } from "@/lib/format";
import type { Candidato, CandidatosCidade } from "@/lib/types";

const linkClasse = "inline-flex min-h-8 items-center rounded-lg border border-line-2 px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-line";

/**
 * Uma empresa candidata: nome, CNPJ, endereço, contato cadastral da Receita, atividade, links de pesquisa e o andamento.
 * `onde`/`filtros` dizem para onde voltar depois de salvar (a tela Lacunas ou a página Candidatos, com os filtros de antes).
 */
export function LinhaCandidato({
  c,
  podeEditar,
  periodoQuery = "",
  onde,
  filtros = "",
}: {
  c: Candidato;
  podeEditar: boolean;
  periodoQuery?: string;
  onde: "lacunas" | "candidatos";
  filtros?: string;
}) {
  const fechado = c.status === "nao_vende" || c.status === "sem_interesse";
  const rua = enderecoRua(c);
  const fone = formataTelefone(c.telefone);
  return (
    <li className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 py-3.5 ${fechado ? "opacity-60" : ""}`} data-candidato={c.cnpj}>
      <div className="min-w-0 flex-1 basis-56 text-sm">
        <p className="break-words font-semibold">{c.nome ?? "Sem nome fantasia cadastrado"}</p>
        <p className="font-mono text-xs text-ink-3">{formataCnpj(c.cnpj)}</p>
        <p className="mt-1 break-words text-[13px] text-ink-2" data-endereco>
          {rua || "Endereço não informado"}
          <span className="text-ink-3">
            {" "}
            · {c.municipio}/{c.uf}
            {c.cep ? ` · ${formataCep(c.cep)}` : ""}
          </span>
        </p>
        <p className="mt-0.5 break-words text-[13px] text-ink-2" data-contato>
          {fone ? (
            <a href={`tel:+55${c.telefone}`} className="underline underline-offset-2">
              {fone}
            </a>
          ) : (
            <span className="text-ink-3">Sem telefone cadastrado</span>
          )}
          {c.email ? (
            <>
              {" · "}
              <a href={`mailto:${c.email}`} className="break-all underline underline-offset-2">
                {c.email}
              </a>
            </>
          ) : null}
        </p>
        <p className="mt-0.5 break-words text-xs text-ink-3">{c.cnae_desc ?? `CNAE ${c.cnae}`}</p>
        <p className="mt-2 flex flex-wrap gap-2">
          <a href={linkGoogle(c)} target="_blank" rel="noopener noreferrer" className={linkClasse}>
            Pesquisar no Google
          </a>
          <a href={linkMapa(c)} target="_blank" rel="noopener noreferrer" className={linkClasse}>
            Ver no mapa
          </a>
        </p>
      </div>
      {podeEditar ? (
        <form action={marcarCandidato} className="flex shrink-0 items-center gap-2">
          {[...new URLSearchParams(periodoQuery)].map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="onde" value={onde} />
          <input type="hidden" name="filtros" value={filtros} />
          <label className="sr-only" htmlFor={`st-${c.id}`}>
            Andamento de {c.nome ?? c.cnpj}
          </label>
          <select id={`st-${c.id}`} name="status" defaultValue={c.status} className="rounded-lg border border-line-2 bg-white px-2.5 py-2 text-sm text-ink">
            {ANDAMENTOS.map((s) => (
              <option key={s} value={s}>
                {ROTULO_ANDAMENTO[s]}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg border border-line-2 px-3 py-2 text-sm font-medium text-ink-2 hover:bg-line">
            Salvar
          </button>
        </form>
      ) : (
        <span className="shrink-0 rounded-md bg-line px-2 py-0.5 text-xs font-semibold text-ink-2">{ROTULO_ANDAMENTO[c.status]}</span>
      )}
    </li>
  );
}

/**
 * Candidatos a revendedor, por cidade onde houve busca sem revendedor (tela Lacunas). Se `cidades` for null, a função ainda não existe
 * no banco: mostra só o aviso "em breve" (a tela Lacunas continua inteira).
 */
export function CandidatosPorCidade({
  cidades,
  buscasPorCidade,
  podeEditar,
  periodoQuery,
  erro,
}: {
  cidades: CandidatosCidade[] | null;
  buscasPorCidade: Record<string, number>;
  podeEditar: boolean;
  periodoQuery: string;
  erro?: string | null;
}) {
  if (cidades === null) {
    return (
      <p className="mb-6 rounded-xl border border-line bg-card px-5 py-4 text-[13px] text-ink-3">
        Em breve: para cada lacuna, a lista de candidatos a revendedor na região (empresas do ramo que ainda não constam na sua rede).
      </p>
    );
  }
  return (
    <Card className="mb-6">
      <div id="candidatos" />
      <CardHeader
        titulo="Candidatos a revendedor"
        dica="Empresas ativas do ramo da sua marca que não constam na sua rede, nas cidades onde houve busca sem revendedor. Dado cadastral da Receita Federal: não sabemos se já vendem os seus produtos."
        direita={
          <Link href="/dashboard/candidatos" className="shrink-0 rounded-lg border border-line-2 px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-line">
            Ver todos, filtrar e exportar
          </Link>
        }
      />
      {erro ? (
        <p role="alert" className="mx-5 mt-3 rounded-lg border border-gap/30 bg-gap-soft px-4 py-2.5 text-[13px] text-gap-deep">
          {erro === "permissao" ? "Seu acesso é só de leitura: peça a um administrador para marcar o andamento." : "Não foi possível salvar. Tente de novo."}
        </p>
      ) : null}
      {cidades.length === 0 ? (
        <Empty titulo="Ainda não há candidatos para estas cidades">
          Assim que a base de empresas for carregada para as cidades com lacuna, elas aparecem aqui.
        </Empty>
      ) : (
        <div className="mt-3 divide-y divide-line border-t border-line">
          {cidades.map((c, i) => {
            const buscas = buscasPorCidade[`${c.uf}|${c.cidade.toLowerCase()}`] ?? 0;
            const total = c.abertos + c.por_status.nao_vende + c.por_status.sem_interesse;
            return (
              <details key={`${c.uf}-${c.cidade}`} open={i === 0} className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 font-semibold">
                    {c.cidade}
                    <span className="text-ink-3">/{c.uf}</span>
                  </span>
                  <span className="text-[13px] text-ink-2">
                    {buscas > 0 ? `${num(buscas)} ${buscas === 1 ? "busca" : "buscas"} sem revendedor · ` : ""}
                    <strong className="font-semibold text-ink">{num(c.abertos)}</strong> {c.abertos === 1 ? "candidato em aberto" : "candidatos em aberto"}
                    <span aria-hidden className="ml-2 text-xs group-open:hidden">▾</span>
                  </span>
                </summary>
                <ul className="divide-y divide-line border-t border-line bg-paper/40">
                  {c.itens.map((it) => (
                    <LinhaCandidato key={it.id} c={it} podeEditar={podeEditar} periodoQuery={periodoQuery} onde="lacunas" />
                  ))}
                </ul>
                {total > c.itens.length ? (
                  <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">
                    Mostrando os {c.itens.length} de maior aderência de {num(total)} nesta cidade.{" "}
                    <Link href={`/dashboard/candidatos?uf=${encodeURIComponent(c.uf)}&cidade=${encodeURIComponent(c.cidade)}`} className="font-medium underline underline-offset-2">
                      Ver todos
                    </Link>
                  </p>
                ) : null}
              </details>
            );
          })}
        </div>
      )}
      <p className="border-t border-line px-5 py-3 text-[12px] text-ink-3">
        Fonte: base pública de CNPJ da Receita Federal (só empresas ativas): nome fantasia, endereço comercial, atividade e o telefone e e-mail cadastrais, quando
        existem. Site não consta na Receita: use “Pesquisar no Google”. Atenção: o e-mail cadastrado na Receita costuma ser o do contador da empresa, não o da loja. Confira o contato antes de abordar.
      </p>
    </Card>
  );
}
