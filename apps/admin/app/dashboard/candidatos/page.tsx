/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
import Link from "next/link";
import { removerTermo, salvarTermo } from "@/app/dashboard/actions";
import { LinhaCandidato } from "@/components/candidatos";
import { ErroPainel } from "@/components/erro-painel";
import { Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { ANDAMENTOS, lerFiltroCandidatos, lerPagina, POR_PAGINA, queryDosFiltros, ROTULO_ANDAMENTO } from "@/lib/candidatos";
import { carregar, getCandidatosLista, getMembership, getTermos } from "@/lib/data";
import { num } from "@/lib/format";

export const metadata = { title: "Candidatos a revendedor" };

export default async function Candidatos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filtro = lerFiltroCandidatos(sp);
  const pagina = lerPagina(sp);
  const m = await getMembership();
  if (!m) return null;
  const r = await carregar(() => getCandidatosLista(m.tenant.id, filtro, POR_PAGINA, (pagina - 1) * POR_PAGINA));
  if ("erro" in r) return <ErroPainel erro={r.erro} />;
  const lista = r.dados;
  const podeEditar = m.role === "owner" || m.role === "admin";
  const erroCand = typeof sp.cand === "string" && /^(permissao|falha|invalido)$/.test(sp.cand) ? sp.cand : null;
  const erroTermo = typeof sp.termo === "string" && /^(permissao|falha|invalido|limite)$/.test(sp.termo) ? sp.termo : null;
  const termos = await getTermos(m.tenant.id);

  if (!lista) {
    return (
      <>
        <PageHeader titulo="Candidatos a revendedor" subtitulo="Empresas do ramo da sua marca que ainda não constam na sua rede." />
        <Empty titulo="Em breve">A lista de candidatos ainda não foi habilitada para esta conta.</Empty>
      </>
    );
  }

  const filtrando = Object.values(filtro).some(Boolean);
  const qs = queryDosFiltros(filtro);
  const totalPaginas = Math.max(1, Math.ceil(lista.total / POR_PAGINA));
  const cidades = lista.filtros.cidades.filter((c) => !filtro.uf || c.uf === filtro.uf);
  const ps = lista.filtros.por_status;
  const semBase = lista.filtros.ufs.length === 0;
  const link = (p: number) => `/dashboard/candidatos?${queryDosFiltros(filtro, p)}`;
  const campo = "mt-1 block w-full rounded-lg border border-line-2 bg-white px-3 py-2 text-sm font-normal text-ink";

  return (
    <>
      <PageHeader
        titulo="Candidatos a revendedor"
        subtitulo="Empresas ativas do ramo da sua marca que não constam na sua rede, nas cidades onde houve busca sem revendedor."
        direita={
          lista.total > 0 ? (
            <a
              href={`/dashboard/candidatos/export${qs ? `?${qs}` : ""}`}
              className="inline-flex items-center rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-2"
            >
              Exportar CSV ({num(Math.min(lista.total, 5000))})
            </a>
          ) : undefined
        }
      />

      {erroCand ? (
        <p role="alert" className="mb-4 rounded-lg border border-gap/30 bg-gap-soft px-4 py-2.5 text-[13px] text-gap-deep">
          {erroCand === "permissao" ? "Seu acesso é só de leitura: peça a um administrador para marcar o andamento." : "Não foi possível salvar. Tente de novo."}
        </p>
      ) : null}

      <Card className="mb-6">
        <CardHeader
          titulo={`${num(lista.total)} ${lista.total === 1 ? "candidato" : "candidatos"}${filtrando ? " com esses filtros" : ""}`}
          dica="Dado cadastral público da Receita Federal. Não sabemos se a empresa já vende os seus produtos: confira antes de abordar. Quem a equipe marcar como “Não vende” ou “Sem interesse” sai da contagem de em aberto."
        />
        {semBase ? (
          <Empty titulo="Ainda não há candidatos carregados">
            Assim que a base de empresas for carregada para as cidades com lacuna, elas aparecem aqui.
          </Empty>
        ) : (
          <>
            <form method="get" className="grid gap-3 px-5 pt-4 sm:grid-cols-2 lg:grid-cols-6" aria-label="Filtros">
              <label className="text-[13px] font-medium text-ink-2 lg:col-span-2">
                Buscar por nome ou CNPJ
                <input type="search" name="q" defaultValue={filtro.q} maxLength={80} placeholder="Ex.: academia, 19.283" className={campo} />
              </label>
              <label className="text-[13px] font-medium text-ink-2">
                Estado
                <select name="uf" defaultValue={filtro.uf} className={campo}>
                  <option value="">Todos</option>
                  {lista.filtros.ufs.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[13px] font-medium text-ink-2">
                Cidade
                <select name="cidade" defaultValue={filtro.cidade} className={campo}>
                  <option value="">Todas</option>
                  {cidades.map((c) => (
                    <option key={`${c.uf}-${c.cidade}`} value={c.cidade}>
                      {c.cidade}/{c.uf} ({num(c.n)})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[13px] font-medium text-ink-2">
                Atividade
                <select name="cnae" defaultValue={filtro.cnae} className={campo}>
                  <option value="">Todas</option>
                  {lista.filtros.cnaes.map((c) => (
                    <option key={c.cnae} value={c.cnae}>
                      {(c.descricao ?? `CNAE ${c.cnae}`).slice(0, 48)} ({num(c.n)})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[13px] font-medium text-ink-2">
                Andamento
                <select name="status" defaultValue={filtro.status} className={campo}>
                  <option value="">Todos</option>
                  <option value="abertos">Em aberto ({num(ps.novo + ps.contatado)})</option>
                  {ANDAMENTOS.map((s) => (
                    <option key={s} value={s}>
                      {ROTULO_ANDAMENTO[s]} ({num(ps[s])})
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-6">
                <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-2">
                  Filtrar
                </button>
                {filtrando ? (
                  <Link href="/dashboard/candidatos" className="py-2 text-sm font-medium text-ink-2 underline underline-offset-2">
                    Limpar
                  </Link>
                ) : null}
              </div>
            </form>

            {lista.total === 0 ? (
              <Empty titulo="Nenhum candidato com esses filtros">Tente outra cidade, atividade ou andamento, ou limpe os filtros.</Empty>
            ) : (
              <>
                <ul className="mt-4 divide-y divide-line border-t border-line" data-lista-candidatos>
                  {lista.itens.map((c) => (
                    <LinhaCandidato key={c.id} c={c} podeEditar={podeEditar} onde="candidatos" filtros={queryDosFiltros(filtro, pagina)} />
                  ))}
                </ul>
                {totalPaginas > 1 ? (
                  <nav aria-label="Páginas" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm">
                    {pagina > 1 ? (
                      <Link href={link(pagina - 1)} className="rounded-lg border border-line-2 px-3 py-1.5 font-medium text-ink-2 hover:bg-line">
                        ← Anteriores
                      </Link>
                    ) : (
                      <span />
                    )}
                    <span className="text-[13px] text-ink-3">
                      Página {pagina} de {num(totalPaginas)}
                    </span>
                    {pagina < totalPaginas ? (
                      <Link href={link(pagina + 1)} className="rounded-lg border border-line-2 px-3 py-1.5 font-medium text-ink-2 hover:bg-line">
                        Próximos →
                      </Link>
                    ) : (
                      <span />
                    )}
                  </nav>
                ) : null}
              </>
            )}
          </>
        )}
        <p className="border-t border-line px-5 py-3 text-[12px] text-ink-3">
          Fonte: base pública de CNPJ da Receita Federal (só empresas ativas): nome fantasia, endereço comercial, atividade e o telefone e e-mail cadastrais, quando existem.
          O site da empresa não consta na Receita: use “Pesquisar no Google”. O e-mail cadastrado costuma ser o do contador da empresa, não o da loja: confira antes de abordar. A exportação traz até 5.000 linhas com os filtros aplicados.
        </p>
      </Card>

      <Card className="mb-6">
        <div id="palavras" />
        <CardHeader
          titulo="Palavras do ramo"
          dica="Ajudam a separar quem é do seu ramo. Uma palavra que SOBE aumenta a aderência de quem a tem no nome fantasia (ex.: academia, nutrição); uma que DESCE diminui (ex.: moda, bicicleta). Sem acento e sem diferença de maiúsculas. Vale a de maior peso de cada tipo."
        />
        {erroTermo ? (
          <p role="alert" className="mx-5 mt-3 rounded-lg border border-gap/30 bg-gap-soft px-4 py-2.5 text-[13px] text-gap-deep">
            {erroTermo === "permissao"
              ? "Seu acesso é só de leitura: peça a um administrador para mudar as palavras."
              : erroTermo === "limite"
                ? "Limite de 60 palavras. Remova alguma antes de adicionar outra."
                : erroTermo === "invalido"
                  ? "Palavra inválida: use de 2 a 40 letras ou números."
                  : "Não foi possível salvar. Tente de novo."}
          </p>
        ) : null}
        <div className="grid gap-6 px-5 pb-5 pt-4 md:grid-cols-2" data-termos>
          {(["sobe", "desce"] as const).map((tipo) => {
            const lista = termos.filter((t) => t.tipo === tipo);
            return (
              <section key={tipo} aria-label={tipo === "sobe" ? "Palavras que sobem" : "Palavras que descem"}>
                <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">{tipo === "sobe" ? "Sobem no ranking" : "Descem no ranking"}</h3>
                {lista.length === 0 ? (
                  <p className="text-[13px] text-ink-3">Nenhuma palavra.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {lista.map((t) => (
                      <li key={t.termo} data-termo={`${tipo}:${t.termo}`} className="inline-flex items-center gap-1 rounded-lg border border-line-2 bg-white py-1 pl-2.5 pr-1 text-sm">
                        <span>
                          {t.termo} <span className="text-xs text-ink-3">({tipo === "sobe" ? "+" : "−"}{t.peso})</span>
                        </span>
                        {podeEditar ? (
                          <form action={removerTermo}>
                            <input type="hidden" name="termo" value={t.termo} />
                            <input type="hidden" name="tipo" value={tipo} />
                            <input type="hidden" name="filtros" value={queryDosFiltros(filtro, pagina)} />
                            <button type="submit" aria-label={`Remover a palavra ${t.termo}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-line">
                              ✕
                            </button>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        {podeEditar ? (
          <form action={salvarTermo} className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-4">
            <input type="hidden" name="filtros" value={queryDosFiltros(filtro, pagina)} />
            <label className="min-w-0 flex-1 basis-40 text-[13px] font-medium text-ink-2">
              Palavra
              <input type="text" name="termo" required minLength={2} maxLength={40} placeholder="Ex.: academia" className={campo} />
            </label>
            <label className="text-[13px] font-medium text-ink-2">
              O que faz
              <select name="tipo" defaultValue="sobe" className={campo}>
                <option value="sobe">Sobe no ranking</option>
                <option value="desce">Desce no ranking</option>
              </select>
            </label>
            <label className="text-[13px] font-medium text-ink-2">
              Peso
              <select name="peso" defaultValue="6" className={campo}>
                {[2, 4, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-2">
              Adicionar
            </button>
          </form>
        ) : null}
        <p className="border-t border-line px-5 py-3 text-[12px] text-ink-3">
          O ranking também aprende com as suas marcações: depois de 5 marcações “Vende”, “Não vende” ou “Sem interesse” em uma mesma atividade, ela sobe ou desce até 6 pontos; e
          se outra empresa da mesma rede já vende, a candidata sobe 6, se foi marcada sem interesse ou não vende, desce 10. Nada é apagado: desfazer a marcação volta o ranking.
        </p>
      </Card>
    </>
  );
}
