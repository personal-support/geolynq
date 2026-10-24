# Site de amostra (demo.geolynq.personalsupport.tech): HTML estático servido pelo Nginx.
# Build context = RAIZ do repositório (mesmo padrão do widget):
#   docker build -f apps/demo/Dockerfile -t geolynq-demo .
# Resultado: https://<dominio>/  e  https://<dominio>/img/<sku>.svg

FROM nginx:1.27-alpine
COPY apps/demo/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/demo/index.html /usr/share/nginx/html/index.html
COPY apps/demo/img/ /usr/share/nginx/html/img/
EXPOSE 80
