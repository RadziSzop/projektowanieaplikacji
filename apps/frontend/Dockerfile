FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build -w @app/frontend
FROM nginx:stable-alpine AS runtime
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]