# Klucz — sklep z licencjami

Prosty projekt zaliczeniowy. React + TypeScript + Tailwind, Express, Prisma i MySQL.
Trzy edycje programu Nova: Standard, Plus i Pro.

## Uruchomienie

Wymagany Docker Desktop (kontenery Linux):

```sh
docker compose up --build -d
```

Sklep: http://localhost:8080. Baza, tabele i trzy produkty tworzą się automatycznie.
Zatrzymanie: `docker compose down`. Dane pozostają w wolumenie `mysql_data`.
Hasła w Compose są przykładowe i przeznaczone tylko do pracy lokalnej.

## Praca nad kodem

Wymagany Node.js 24.12+ i npm. Z katalogu głównego:

```sh
docker compose stop frontend backend
docker compose up -d db
npm ci
```

Skopiuj `apps/backend/.env.example` do `apps/backend/.env`, następnie:

```sh
npm run build
npm run db:setup -w @app/backend
npm run dev
```

Frontend: http://localhost:5173. Backend: http://localhost:3000/api/health.
Sprawdzenie kodu: `npm run typecheck` i `npm run build`.
Formatowanie plików Prettierem: `npm run format`.

## Co działa

- Sklep, szczegóły produktu, koszyk i formularz zamówienia na osobnych stronach.
- Rejestracja i logowanie, hasła haszowane przez scrypt, sesja w ciasteczku HttpOnly.
- Produkty i zamówienia w MySQL przez Prismę. Koszyk w localStorage.
- Formularz zamówienia jest dostępny na froncie po zalogowaniu. Wysyła dane do API i wyświetla klucze z odpowiedzi.
- Ceny i suma zamówienia liczone po stronie serwera, w groszach.

Widoki: `apps/frontend/src/pages`. Nawigacja i stan aplikacji: `apps/frontend/src/App.tsx`.
Wspólne pola formularzy i podsumowanie: `apps/frontend/src/components.tsx`.
Style są zapisane w klasach Tailwinda; `style.css` zawiera tylko import biblioteki.
Frontend korzysta z wywołań `/api/products`, `/api/me`, `/api/login`, `/api/register`, `/api/logout` i `/api/orders`, bez mocków i danych zastępczych. Błędy API są wyświetlane w interfejsie.
API: `apps/backend/src/app.ts`. Schemat i produkty: `apps/backend/prisma`.
Projekt używa `prisma db push` zamiast historii migracji, aby konfiguracja pozostała prosta.
