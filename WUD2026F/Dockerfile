FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:22-alpine
WORKDIR /app
COPY --from=build --chown=node:node /app/dist/wud2026-f ./dist
ENV NODE_ENV=production PORT=4000
USER node
EXPOSE 4000
CMD ["node", "dist/server/server.mjs"]
