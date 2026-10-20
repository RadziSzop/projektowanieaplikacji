# Sklep z kluczami licencyjnymi

Istniejący frontend React/Vite/Tailwind oraz backend Hono + TypeScript. Monorepo używa npm workspaces i jednego `package-lock.json`.

## Szybki start

Wymagania: Node.js 24.12+ (24 LTS), npm, Docker Desktop z działającym silnikiem Linux.

```sh
npm ci
npm run env:init
docker compose up --build -d --wait --wait-timeout 180
```

Repozytorium zawiera `.env` z danymi lokalnego środowiska demonstracyjnego. **To nie jest aplikacja produkcyjna. Przechowywanie sekretów w Git jest niebezpieczne: każda osoba z dostępem do repo zna te dane. Nie używaj tych haseł ani kluczy poza lokalnym demo.** W środowisku produkcyjnym sekrety muszą być dostarczane poza repozytorium i zastąpione nowymi wartościami.

`env:init` tworzy `.env` z losowymi sekretami wyłącznie wtedy, gdy plik nie istnieje; nigdy nie nadpisuje istniejącego pliku. Dane administratora są w `ADMIN_EMAIL` i `ADMIN_PASSWORD`. Można też przygotować `.env` na podstawie `.env.example`; `KEY_ENCRYPTION_KEY` to dokładnie 32 losowe bajty zakodowane w base64. Hasła użyte w URL-ach bazy i brokera powinny zawierać znaki bezpieczne dla URL, tak jak generowane wartości hex.

| Usługa                                 | Adres lokalny                    |
| -------------------------------------- | -------------------------------- |
| Sklep i publiczne API przez Nginx      | http://localhost:8080            |
| Mailpit — podgląd lokalnych wiadomości | http://localhost:8025            |
| RabbitMQ Management                    | http://localhost:15672           |
| InfluxDB 2                             | http://localhost:8086            |
| API do developmentu                    | http://localhost:3000/api/health |

RabbitMQ: użytkownik `licensing`, hasło `RABBITMQ_PASSWORD`. InfluxDB: użytkownik i organizacja `licensing`, hasło `INFLUXDB_PASSWORD`, bucket `events`. Wewnętrzne serwisy nie publikują portów na hoście. Wszystkie publikowane porty są związane z adresem loopback.

Migracje i seed wykonuje jednorazowy kontener `migrate`. Seed tworzy produkty Standard/Plus/Pro i administratora; nie zmienia istniejących haseł, produktów ani konfiguracji i nie promuje konta utworzonego przez publiczną rejestrację.

```sh
docker compose logs -f backend license-service notification-worker
docker compose down
```

Dane pozostają w nazwanych wolumenach. Nie używaj `down -v`, jeśli chcesz je zachować. Zachowaj także `KEY_ENCRYPTION_KEY` — bez niego nie odczytasz istniejących kluczy. Dawny wolumen MySQL nie jest używany ani automatycznie usuwany.

## Praca lokalna

```sh
docker compose up -d --wait postgres rabbitmq mailpit influxdb
npm run build
node scripts/with-local-env.mjs node node_modules/prisma/build/index.js migrate deploy --config packages/database/prisma.config.ts
node scripts/with-local-env.mjs node packages/database/dist/seed-cli.js
npm run dev
```

Przed developmentem zatrzymaj kontenerowe aplikacje, aby zwolnić port API:

```sh
docker compose stop frontend backend license-service notification-worker
```

Vite działa na http://localhost:5173 i przekazuje `/api` do lokalnego backendu. Skrypt `with-local-env.mjs` wczytuje `.env` i ustawia adresy zależności na `127.0.0.1`; Compose używa nazw usług. `npm run dev` uruchamia frontend, API, generator i worker. Po zmianach wspólnych pakietów wykonaj ponownie `npm run build` i zrestartuj procesy developerskie.

## API

Frontend pozostaje bez zmian; zachowano jego DTO i błędy `{ "error": "..." }`.

| Endpoint                               | Dostęp i zachowanie                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`, `GET /api/ready`    | Życie procesu i gotowość PostgreSQL; gotowość API nie wymaga działającego brokera                                                     |
| `GET /api/products`                    | Publiczny katalog; ceny w groszach                                                                                                    |
| `POST /api/register`                   | `{name,email,password}`; potwierdzenie utworzenia konta, bez automatycznego logowania                                                 |
| `POST /api/login`, `POST /api/logout`  | Własne konta i odwoływalne sesje HttpOnly, SameSite=Lax, ważne 7 dni                                                                  |
| `GET /api/me`                          | `{name,email}` lub `null` dla niezalogowanego                                                                                         |
| `POST /api/orders`                     | Dane formularza i `items:[{id,quantity}]`; ceny obliczane przez serwer, 1–10 sztuk/produkt                                            |
| `GET /api/orders/:id`                  | Zamówienie właściciela lub administratora, wygenerowane klucze i statusy zadań                                                        |
| `GET /api/configs`                     | Dostępne konfiguracje z najnowszą wersją; wymagane logowanie                                                                          |
| `POST /api/jobs`                       | `{configVersionId,ownerId?,recipientEmail?}`; `202 {jobId,status}`. USER zamawia dla siebie, ADMIN może wskazać inne istniejące konto |
| `GET /api/jobs/:id`                    | Właściciel lub administrator; osobne statusy generowania, SMTP i metryk                                                               |
| `GET /api/licenses`                    | Ostatnie 100 licencji zalogowanego właściciela                                                                                        |
| `POST /api/licenses/verify`            | Publiczne `{key}`; `VALID`, `INVALID`, `EXPIRED`, `REVOKED`; niedostępny serwis oznacza HTTP503                                       |
| `POST /api/admin/configs`              | ADMIN; `{name,description?,format:{...}}`                                                                                             |
| `POST /api/admin/configs/:id/versions` | ADMIN; nowy format, bez modyfikacji wydanych wersji; produkty przechodzą na nową wersję                                               |
| `POST /api/admin/licenses/:id/revoke`  | ADMIN; trwałe unieważnienie                                                                                                           |

Żądania zmieniające stan wymagają JSON. Przeglądarkowy `Origin` musi pasować do `PUBLIC_ORIGIN`; poza trybem production dozwolony jest także lokalny Vite. Przy HTTPS ciasteczka otrzymują `Secure`. Logowanie, rejestracja i weryfikacja są ograniczane per adres połączenia; limity są lokalne dla pojedynczego procesu.

Zamówienie, zadania i outbox są zapisywane atomowo. `POST /api/orders` czeka na wygenerowanie kluczy najwyżej 20 sekund, bez oczekiwania na mail/metryki. Potem zwraca `201` i obecny DTO zamówienia, z już dostępnymi kluczami; tablice mogą być puste. Brakujące klucze dotrą mailem, a status jest dostępny przez API. Ten wariant pozwala zachować frontend bez pollingu. Odświeżenie strony potwierdzenia zachowuje dotychczasowe zachowanie frontendu; zamówienie pozostaje w bazie i można je odczytać przez API.

Osobne żądania HTTP tworzą osobne zamówienia. Gwarancja pojedynczego wydania dotyczy zadania. Przy przerwanym połączeniu sprawdź utworzone zamówienie przed ponownym zleceniem.

## Format i przechowywanie kluczy

Konfiguracja: `prefix`, `alphabet`, `segmentCount`, `segmentLength`, `separator`, `checksum`, `validityDays`. Domyślnie `NOVA`, alfabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 4 grupy po 5 znaków, separator `-`, checksum w postaci pierwszych 8 znaków SHA-256 i 365 dni ważności. `validityDays:null` oznacza bezterminowość. Minimalna entropia części losowej: 80 bitów; domyślnie 100 bitów. Alfabet zawiera unikalne wielkie litery ASCII/cyfry; separator to `-` lub `_`.

Wersje są niezmienne także na poziomie bazy. Normalizacja przycina tylko zewnętrzne odstępy i zamienia litery na wielkie. Checksum wykrywa literówki; źródłem prawdy jest PostgreSQL. Hash SHA-256 służy do wyszukiwania, a AES-256-GCM chroni klucz potrzebny do wysyłki i odczytu zamówienia. Szyfrogram pozostaje przez okres istnienia licencji. Nie wdrożono rotacji sekretu; nie zmieniaj go dla istniejących danych.

```sh
npm run verify -- TWOJ-KLUCZ
```

Klient wypisuje wyłącznie wynik, nigdy klucz. Kody wyjścia: `0` ważny, `1` nieważny/wygasły/unieważniony, `2` błąd wejścia lub niedostępność usługi.

## RabbitMQ, retry i DLQ

API publikuje również outbox zapisany przez generator. Publikacja kończy się po publisher confirm. Konsumenci potwierdzają dopiero trwały zapis wyniku lub zaplanowanie retry/DLQ. Wiadomości zawierają tylko identyfikatory. Deduplikacja `(consumer,messageId)`, blokady i unikalność `generationJobId` zabezpieczają przed podwójnym wydaniem.

Generowanie ma statusy `PENDING/PROCESSING/COMPLETED/FAILED`. Mail i metryki mają oddzielne rekordy: `PENDING/PROCESSING/SENT` lub `WRITTEN`, a po wyczerpaniu prób `FAILED`. `SENT` oznacza przyjęcie przez SMTP, nie przeczytanie wiadomości.

Trzy ponowienia po błędzie przejściowym: 10s, 60s i 300s. Opóźnienie jest trwałym `availableAt` w outboxie; ponowna dostawa ma nowy `messageId`, zachowując `eventId`. Błędy trwałe i czwarta nieudana próba trafiają do rzeczywistych kolejek:

- `license.generate.dlq`
- `notification.email.dlq`
- `notification.metrics.dlq`

```sh
docker compose exec backend npm run dlq -- list
docker compose exec backend npm run dlq -- peek --queue notification.email --limit 10
docker compose exec backend npm run dlq -- retry --queue notification.email --limit 10
```

CLI działa jako lokalne narzędzie operatora kontenera. Najpierw usuń przyczynę błędu. Redrive zapisuje replay do outboxa i resetuje wyłącznie nieudany etap przed ACK wiadomości DLQ. Powtórzenie nie regeneruje zakończonej licencji ani nie wysyła zakończonego maila. Nieprawidłowe wiadomości bez poprawnej koperty pozostają w DLQ do analizy; nie są ślepo odtwarzane. `peek` pokazuje rejestr PostgreSQL, a `list` również liczniki rzeczywistych kolejek. Liczniki mogą chwilowo różnić się podczas publikacji outboxa.

Po awarii pomiędzy akceptacją SMTP a zapisem statusu możliwy jest ponowny mail z tym samym kluczem. Stały Message-ID pomaga rozpoznać duplikat. InfluxDB używa stałych tagów i czasu zdarzenia, więc ponowny zapis nadpisuje ten sam punkt.

## Testy

```sh
npm run typecheck
npm run build
npm test
npm run test:integration
npm run test:smoke
```

Testy integracyjne wymagają działającej infrastruktury i `.env`. Automatycznie tworzą oddzielną bazę `licensing_test` i vhost RabbitMQ `licensing_test`; nie usuwają danych aplikacji i mogą działać obok kontenerowych aplikacji. Zaawansowane ustawienia: `TEST_DATABASE_URL` (nazwa musi kończyć się `_test`), `TEST_RABBITMQ_URL` (vhost musi kończyć się `_test`) i `TEST_RABBITMQ_MANAGEMENT_URL`.

`test:smoke` wymaga całego Compose. Sprawdza konta, zamówienie, dwie różne licencje, ten sam klucz w Mailpit, punkt w InfluxDB, klienta CLI, odmowę dostępu do cudzych zasobów i unieważnienie przez administratora. Tworzy lokalne konta i zamówienia testowe. Testy awaryjne obejmują duplikaty, retry, rzeczywiste DLQ, redrive, awarię brokera, zatrzymanie procesu podczas łączenia i nieprawidłowe wiadomości bez zapisu ich treści.

CI powtarza smoke test po odtworzeniu backendu i workerów bez restartu frontendu. Nginx korzysta z resolvera Docker i odświeża adres backendu; healthcheck frontendu sprawdza połączenie z API. Reguły rozwiązywania nazw opisuje [dokumentacja Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass).

## Podział prac

Tickety i ustalenia: `docs/implementation-plan.md`; zapis weryfikacji: `docs/progress.md`. Nie są to zgłoszenia GitHub Issues. Przed każdym commitem wymagana jest zgoda użytkownika. Format commitów: Angular Conventional Commits, autor `matisofficial@interia.pl`. Push wymaga osobnej zgody.
