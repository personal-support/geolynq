# GeoLynq — landing page

Site estático (HTML + CSS + JS, sem build), servido por Nginx. **Status: publicada no EasyPanel em 2026-10-13 (serviço `geolynq_landing`, deploy manual). Acesso público e prévia do WhatsApp ainda a conferir.**

- Endereço previsto: `https://geolynq.personalsupport.tech/` (a raiz; o DNS `A geolynq` já existe).
- Serviço próprio no EasyPanel (projeto `personalsupport_saas`), separado do widget. Origem GitHub, caminho de build `apps/landing`, Dockerfile `Dockerfile`, porta 80.
- **Texto provisório.** Conteúdo, oferta e copy são do Danilo (comercial); esta é uma primeira versão para revisão. Preço: "sob consulta".

## Arquivos
| Arquivo | Para quê |
|---|---|
| `index.html` | Página única: hero, problema, como funciona, painel, implantação, investimento, FAQ, contato. Traz SEO, Open Graph (WhatsApp), JSON-LD (Organization, WebSite, SoftwareApplication, WebPage, FAQPage) |
| `styles.css`, `app.js` | Estilo (mobile-first) e envio do formulário |
| `privacidade.html` | Texto-base sobre os dados do formulário. **Precisa de revisão jurídica** (campos `[a definir]`); está `noindex` até lá |
| `robots.txt`, `sitemap.xml`, `llms.txt` | Busca tradicional e buscas por IA (robôs de IA liberados) |
| `nginx.conf`, `Dockerfile` | Cabeçalhos de segurança (CSP restrita), cache, `/healthz` |
| `assets/`, `fonts/` | Imagens WebP e fontes próprias (sem Google Fonts, sem terceiros) |

## Formulário de contato
Grava em `public.leads` (Supabase) pela API REST com a chave `sb_publishable_…` (pública). Defesas: campo-isca, tempo mínimo de 3 s, 1 envio/min por navegador, RLS só de INSERT.
A migration `supabase/migrations/20261013000000_leads_landing.sql` **já foi aplicada em produção** (2026-10-13): tirou privilégios demais do público e limitou tamanhos. Não há aviso automático de novo contato ainda (ver `status.md`).

## Testar localmente
Qualquer servidor estático na pasta serve (ex.: `python3 -m http.server`). Para testar com o `nginx.conf` real: `nginx -t` e apontar `root` para esta pasta.

## Antes de divulgar
- Trocar `og.jpg`/textos só se o comercial pedir; o WhatsApp guarda a prévia em cache (usar o depurador do Facebook para renovar).
- Search Console: verificar o domínio e enviar o `sitemap.xml`.
- Revisar `privacidade.html` com o jurídico e então remover o `noindex`.
