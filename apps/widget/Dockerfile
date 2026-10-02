# Fase 4.5 — empacota o widget (apps/widget) como arquivo estático servido pelo Nginx.
# Build context = RAIZ do repositório (precisa do package-lock.json e dos workspaces):
#   docker build -f apps/widget/Dockerfile -t geolynq-widget .
# Resultado: https://<dominio>/v1/embed.js  (contrato público do Blueprint Fase 4.2)

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

# Valores PÚBLICOS por design: o Vite os embute no embed.js e todo visitante do site do
# cliente os enxerga; quem protege os dados é a RLS do banco. Chave publishable do projeto
# geolynq-prod. NUNCA colocar service_role aqui. Para trocar de projeto/chave, passe
# --build-arg (ou os mesmos nomes como variável de build no painel).
ARG VITE_SUPABASE_URL=https://vshlsisnuaugeceafipt.supabase.co
ARG VITE_SUPABASE_ANON_KEY=sb_publishable_uPV6cGkhNDXFiDb0Teq2rA_EUFyKIxR
RUN npm run build -w @geolynq/widget

FROM nginx:1.27-alpine
COPY apps/widget/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/widget/dist/ /usr/share/nginx/html/
EXPOSE 80
