# Projektowanie aplikacji

Monorepo z frontendem Vite + React + TypeScript oraz backendem Express + TypeScript.
Pakiety są zarządzane przez npm workspaces i wspólny `package-lock.json`.

## Wymagania

- Node.js 24.12+ (wersja 24 LTS) i npm.
- Docker z Docker Compose do uruchomienia kontenerów.

## Praca lokalna

```sh
npm ci
npm run dev
```

Frontend: http://localhost:5173. API: http://localhost:3000/api/health.
Vite przekazuje żądania `/api` do backendu, więc nie trzeba konfigurować CORS.
Backend odczytuje opcjonalną zmienną środowiskową `PORT` (domyślnie 3000).
Plik `apps/backend/.env.example` pokazuje jej format; pliki `.env` nie są automatycznie wczytywane.
Przy zmianie portu API należy też zmienić cel proxy w `apps/frontend/vite.config.ts`.

```sh
npm run typecheck
npm run build
npm run start -w @app/backend
```

## Docker

Z katalogu głównego repozytorium:

```sh
docker compose up --build -d
docker compose down
```

Aplikacja jest dostępna pod http://localhost:8080.
Nginx serwuje zbudowany frontend i przekazuje `/api` do backendu w sieci Compose.
Backend działa jako użytkownik bez uprawnień root i nie publikuje portu na hoście.
Obrazy są budowane wieloetapowo; obraz backendu zawiera tylko zależności produkcyjne.

## Struktura

```text
apps/
  frontend/  React, Vite, TypeScript, Nginx
  backend/   Express, TypeScript
compose.yaml
```

CI sprawdza typy, buduje aplikacje i obrazy oraz sprawdza połączenie z API przez Nginx.
