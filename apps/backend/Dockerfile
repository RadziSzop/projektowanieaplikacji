FROM node:24-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app /app
RUN npm prune --omit=dev && npm cache clean --force
USER node
EXPOSE 3000
CMD ["node", "apps/backend/dist/index.js"]