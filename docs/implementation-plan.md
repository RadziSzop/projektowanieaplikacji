# Backend systemu licencji

## Ustalenia

- Gałąź użytkownika feature/mzak/backend-infra z origin/frontend; bez commitów i push bez osobnej zgody użytkownika.
- Hono + TypeScript, Node 24, npm workspaces, jeden lockfile; bez Turborepo.
- Istniejące źródła frontendu pozostają bez zmian. Sklep demonstracyjny bez płatności.
- PostgreSQL + Prisma 7, RabbitMQ, Mailpit, InfluxDB 2, Docker Compose.
- Gdy zostaną zlecone commity: Angular Conventional Commits, angielski imperative summary, body wyjaśniające powód (poza docs), autor matisofficial@interia.pl.

## Tickety i odbiór

| Ticket | Zakres                                             | Odbiór / zależności                                      |
| ------ | -------------------------------------------------- | -------------------------------------------------------- |
| T01    | Klon, lokalna gałąź, Hono, health/errors, shutdown | build + test HTTP                                        |
| T02    | Compose, usługi, env, health, wolumeny             | poprawny config + start infrastruktury; po T01           |
| T03    | Prisma, migracje, indeksy, seed                    | migracje na pustej bazie; po T02                         |
| T04    | Konta, sesje, role, bezpieczeństwo                 | register/login/logout/me, cudze zasoby; po T03           |
| T05    | Katalog i niezmienne wersje konfiguracji           | products zgodne z UI; po T04                             |
| T06    | Losowanie, format, checksum, szyfrowanie           | testy formatu i kryptografii; po T03                     |
| T07    | Outbox, RabbitMQ, deduplikacja, retry, DLQ         | brak utraty po awarii brokera; po T03                    |
| T08    | Generowanie, HTTP weryfikacji, jobs/status/revoke  | jedna licencja na job; po T04–T07                        |
| T09    | Mail i InfluxDB                                    | niezależne statusy i retry; po T08                       |
| T10    | Zamówienia zgodne z frontendem                     | cena z DB, job na sztukę, oczekiwanie max20s; po T05/T08 |
| T11    | CLI DLQ list/peek/retry                            | bezpieczny redrive tylko failed; po T07–T09              |
| T12    | CLI verify, testy integracyjne, CI, dokumentacja   | pełny przepływ i awarie; po T10/T11                      |

## Kontrakty

- Zachować /api/products, /api/me, /api/register, /api/login, /api/logout, /api/orders oraz JSON {error:string}.
- Anonimowe me: 200 null. Session cookie HttpOnly, SameSite=Lax, 7 dni; token hash w DB, hasła scrypt, role USER/ADMIN.
- Product i Order mają numeryczne ID, ceny w groszach. Koszyk 1–10 sztuk/produkt, bez duplikatów i pustych pozycji.
- POST orders atomowo zapisuje zamówienie, zadania i outbox. Po maksymalnie20s zwraca201 z dostępnymi kluczami; reszta trafi mailem.
- POST jobs:202 {jobId,status}; statusy generowania, SMTP i metryk oddzielne. Własność zasobów jest sprawdzana na serwerze.
- Verify: VALID/INVALID/EXPIRED/REVOKED; awaria serwisu:503.
- Domyślny format NOVA, 4x5 znaków ABCDEFGHJKLMNPQRSTUVWXYZ23456789, separator -, checksum SHA256[:8]. Normalizacja trim+uppercase.
- Wersje konfiguracji niezmienne; keyHash unique i generationJobId unique. AES256GCM ciphertext zachowany przez życie licencji, sekret poza repo.
- Envelope messageId/eventId/type/entityId bez kluczy. Retry po10s/60s/300s przez availableAt outbox. Terminalne błędy w rzeczywistych kolejkach license.generate.dlq, notification.email.dlq, notification.metrics.dlq i rejestrze DB.
- Redrive zapisuje replay do outboxa przed ACK; nie ponawia zakończonych operacji. SMTP może powtórzyć ten sam klucz po awarii tuż po akceptacji.

## Weryfikacja

Każdy ticket ma testy zachowania. Odbiór: konto→zamówienie→jedna licencja/sztuka→Mailpit→Influx→verify. Ponadto: cudze zasoby, checksum, expiry/revoke, broker down/outbox, duplikaty, restart przed ACK, niezależne awarie SMTP/Influx, DLQ i redrive. Źródła frontendu niezmienione. Nie usuwać danych ani DLQ automatycznie.
