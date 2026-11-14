# Sklep z kluczami

Frontend: React, TypeScript i Tailwind. Backend: pusty Express, bez endpointów i obsługi bazy.

## Uruchomienie

```sh
docker compose up --build -d
```

Aplikacja: http://localhost:8080. Express działa na porcie 3000.
Wywołania `/api/products`, `/api/me`, `/api/register`, `/api/login`, `/api/logout` i `/api/orders` zwracają 404. Frontend wyświetla błędy API i nie zawiera mocków.

## Praca nad kodem

Node.js 24.12+ i npm:

```sh
npm ci
npm run dev
```

Frontend: http://localhost:5173. Backend: http://localhost:3000.

```sh
npm run build
npm run format
```

Widoki: `apps/frontend/src/pages`. Wspólne komponenty i navbar: `apps/frontend/src/components`.
Nawigacja: `apps/frontend/src/App.tsx`. Stan i wywołania API: `apps/frontend/src/useShop.ts`.
Style są w klasach Tailwinda. Express: `apps/backend/src/index.ts`.

MySQL jest odłączony od aplikacji. Można uruchomić go osobno przez `docker compose --profile database up -d db`. Istniejące dane pozostają w wolumenie.
