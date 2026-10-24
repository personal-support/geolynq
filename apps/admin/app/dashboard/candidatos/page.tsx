/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
import Link from "next/link";
import { LinhaCandidato } from "@/components/candidatos";
import { ErroPainel } from "@/components/erro-painel";
import { Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { ANDAMENTOS, lerFiltroCandidatos, lerPagina, POR_PAGINA, queryDosFiltros, ROTULO_ANDAMENTO } from "@/lib/candidatos";
import { carregar, getCandidatosLista, getMembership } from "@/lib/data";
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
          O site da empresa não consta na Receita: use “Pesquisar no Google”. A exportação traz até 5.000 linhas com os filtros aplicados.
        </p>
      </Card>
    </>
  );
}
