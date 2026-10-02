# Fases 4.5 e 4.1 — empacota o widget (apps/widget) e o site de amostra (apps/demo) como
# arquivos estáticos servidos pelo Nginx, um site por nome de host (ver nginx.conf).
# Build context = RAIZ do repositório (precisa do package-lock.json e dos workspaces):
#   docker build -f apps/widget/Dockerfile -t geolynq-widget .
# Resultado: https://widget.<dominio>/v1/embed.js  (contrato público do Blueprint Fase 4.2)
#            https://demo.<dominio>/                (site de amostra)

FROM node:22-alpine AS build
WORKDIR /app

# Só os package.json primeiro: a camada de `npm ci` fica em cache enquanto as deps não mudam.
# Todos os workspaces precisam estar presentes para o npm validar o package-lock.json.
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/
COPY apps/widget/package.json apps/widget/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace=@geolynq/widget --include-workspace-root

COPY packages/shared packages/shared
COPY apps/widget apps/widget
COPY apps/demo apps/demo

# Valores PÚBLICOS por design: o Vite os embute no embed.js e todo visitante do site do
# cliente os enxerga; quem protege os dados é a RLS do banco. Chave publishable do projeto
# geolynq-prod. NUNCA colocar service_role aqui. Para trocar de projeto/chave, passe
# --build-arg (ou os mesmos nomes como variável de build no painel).
ARG VITE_SUPABASE_URL=https://vshlsisnuaugeceafipt.supabase.co
ARG VITE_SUPABASE_ANON_KEY=sb_publishable_uPV6cGkhNDXFiDb0Teq2rA_EUFyKIxR
RUN npm run build -w @geolynq/widget

# Site de amostra: gerador Node sem dependências (não entra no package-lock.json).
RUN node apps/demo/build.mjs

FROM nginx:1.27-alpine
COPY apps/widget/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/widget/dist/ /usr/share/nginx/html/
COPY --from=build /app/apps/demo/dist/ /usr/share/nginx/demo/
# Rede de segurança: configuração inválida derruba o BUILD (o deploy falha e o container
# que está no ar continua), em vez de derrubar o widget em produção.
RUN nginx -t
EXPOSE 80
