FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci --workspace=@app/backend
COPY apps/backend apps/backend
RUN npm run build -w @app/backend
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@app/backend"]
