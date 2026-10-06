# Fase 5 — painel do cliente (apps/admin, Next.js 16, saída "standalone").
# Build context = RAIZ do repositório (precisa do package-lock.json e dos workspaces):
#   docker build -f apps/admin/Dockerfile -t geolynq-admin .
# EasyPanel: Fonte Git, Dockerfile `apps/admin/Dockerfile`, caminho de build `/`, porta 3000,
#            domínio painel.geolynq.personalsupport.tech (HTTPS automático).

FROM node:22-alpine AS build
WORKDIR /app

# Só os package.json primeiro: a camada de `npm ci` fica em cache enquanto as dependências não mudam.
# Todos os workspaces precisam estar presentes para o npm validar o package-lock.json.
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/
COPY apps/widget/package.json apps/widget/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace=@geolynq/admin --include-workspace-root

COPY packages/shared packages/shared
COPY apps/admin apps/admin

# Valores PÚBLICOS por design (o Next os embute no JavaScript do navegador; quem protege os dados é a RLS do banco).
# URL e chave publishable do projeto geolynq-prod. NUNCA colocar service_role aqui: o painel não precisa dela.
# Para outro projeto/chave, passe --build-arg (ou os mesmos nomes como variável de build no EasyPanel).
ARG NEXT_PUBLIC_SUPABASE_URL=https://vshlsisnuaugeceafipt.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_uPV6cGkhNDXFiDb0Teq2rA_EUFyKIxR
ARG NEXT_PUBLIC_WIDGET_SCRIPT_URL=https://widget.geolynq.personalsupport.tech/v1/embed.js
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_WIDGET_SCRIPT_URL=$NEXT_PUBLIC_WIDGET_SCRIPT_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @geolynq/admin

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app

# Saída standalone: servidor mínimo + só as dependências usadas. O monorepo mantém o caminho apps/admin/.
COPY --from=build --chown=app:app /app/apps/admin/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build --chown=app:app /app/apps/admin/public ./apps/admin/public

USER app
EXPOSE 3000
# /login responde 200 sem sessão; se o servidor travar, o EasyPanel reinicia o container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1
CMD ["node", "apps/admin/server.js"]
