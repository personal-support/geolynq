# GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
# Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
# total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
# Unauthorized copying, replication, redistribution or commercial use is prohibited.
# GeoLynq — landing page estática (HTML + CSS + JS, sem build).
# Build context = apps/landing:
#   docker build -t geolynq-landing apps/landing
# No EasyPanel: origem GitHub, caminho de build "apps/landing", Dockerfile "Dockerfile", domínio geolynq.personalsupport.tech, porta 80.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html privacidade.html 404.html styles.css app.js robots.txt sitemap.xml llms.txt /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
COPY fonts/ /usr/share/nginx/html/fonts/
# Configuração inválida derruba o BUILD (o site no ar continua), em vez de derrubar o site.
RUN nginx -t
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
