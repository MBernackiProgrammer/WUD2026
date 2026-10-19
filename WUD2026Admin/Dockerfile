FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --base-href /admin/
FROM nginxinc/nginx-unprivileged:alpine
USER root
RUN apk add --no-cache jq && chown -R 101:0 /usr/share/nginx/html
COPY --from=build --chown=101:0 /app/dist/wud2026-admin/browser /usr/share/nginx/html/admin
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
USER 101
EXPOSE 8080
