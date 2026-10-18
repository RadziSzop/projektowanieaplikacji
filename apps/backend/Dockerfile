FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci
COPY apps/backend apps/backend
RUN npm run build -w @app/backend

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci --omit=dev --workspace=@app/backend && npm cache clean --force
COPY --from=build --chown=node:node /app/apps/backend/dist apps/backend/dist
USER node
EXPOSE 3000
CMD ["node", "apps/backend/dist/index.js"]
