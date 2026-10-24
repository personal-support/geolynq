/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
import type { Candidato, StatusCandidato } from "@/lib/types";

export const POR_PAGINA = 50;
export const LIMITE_EXPORTACAO = 5000;

export const ROTULO_ANDAMENTO: Record<StatusCandidato, string> = {
  novo: "Novo",
  contatado: "Contatado",
  vende: "Vende",
  nao_vende: "Não vende",
  sem_interesse: "Sem interesse",
};

export const ANDAMENTOS = Object.keys(ROTULO_ANDAMENTO) as StatusCandidato[];

export interface FiltroCandidatos {
  uf: string;
  cidade: string;
  cnae: string;
  status: string; // "", "abertos" ou um andamento
  q: string;
}

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Lê os filtros da URL sem confiar neles: só formatos esperados e tamanhos curtos. */
export function lerFiltroCandidatos(sp: Record<string, string | string[] | undefined>): FiltroCandidatos {
  const uf = um(sp.uf).trim().toUpperCase();
  const cnae = um(sp.cnae).replace(/\D/g, "");
  const status = um(sp.status).trim();
  return {
    uf: /^[A-Z]{2}$/.test(uf) ? uf : "",
    cidade: um(sp.cidade).trim().slice(0, 80),
    cnae: /^\d{7}$/.test(cnae) ? cnae : "",
    status: status === "abertos" || (ANDAMENTOS as string[]).includes(status) ? status : "",
    q: um(sp.q).trim().slice(0, 80),
  };
}

export function lerPagina(sp: Record<string, string | string[] | undefined>): number {
  const n = parseInt(um(sp.pagina), 10);
  return Number.isFinite(n) && n >= 1 && n <= 10000 ? n : 1;
}

/** Querystring só com os filtros preenchidos (e a página, se passar de 1). */
export function queryDosFiltros(f: FiltroCandidatos, pagina = 1): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  if (pagina > 1) p.set("pagina", String(pagina));
  return p.toString();
}

export const formataCnpj = (v: string) =>
  v.length === 14 ? v.replace(/^([0-9A-Z]{2})([0-9A-Z]{3})([0-9A-Z]{3})([0-9A-Z]{4})(\d{2})$/, "$1.$2.$3/$4-$5") : v;

export const formataCep = (v: string | null) => (v && v.length === 8 ? `${v.slice(0, 5)}-${v.slice(5)}` : v);

/** 11 dígitos → (13) 99999-0000; 10 → (13) 3333-4444; 8 ou 9 (sem DDD) → 3333-4444. */
export function formataTelefone(v: string | null): string | null {
  if (!v) return null;
  if (v.length === 11) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  if (v.length === 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  if (v.length === 9) return `${v.slice(0, 5)}-${v.slice(5)}`;
  if (v.length === 8) return `${v.slice(0, 4)}-${v.slice(4)}`;
  return v;
}

/** "AVENIDA ANA COSTA, 100, SALA 2 · Gonzaga" (sem a cidade, que o cartão já mostra no título). */
export function enderecoRua(c: Pick<Candidato, "logradouro" | "numero" | "complemento" | "bairro">): string {
  const rua = [c.logradouro, c.numero, c.complemento].filter(Boolean).join(", ");
  return [rua, c.bairro].filter(Boolean).join(" · ");
}

export function enderecoCompleto(c: Candidato): string {
  const cep = formataCep(c.cep);
  return [[c.logradouro, c.numero].filter(Boolean).join(", "), c.complemento, c.bairro, `${c.municipio}/${c.uf}`, cep].filter(Boolean).join(" - ");
}

/** Links de pesquisa (o site da empresa não vem da Receita): abrem a busca do Google e o mapa; nada é guardado. */
export const linkGoogle = (c: Candidato) => `https://www.google.com/search?q=${encodeURIComponent([c.nome ?? formataCnpj(c.cnpj), c.municipio, c.uf].join(" "))}`;
export const linkMapa = (c: Candidato) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto(c))}`;
