import { Hono, type Env } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';

export function createApp<E extends Env = Env>() {
  const app = new Hono<E>();
  app.use('*', secureHeaders());
  app.use('*', bodyLimit({ maxSize: 100_000, onError: (c) => c.json({ error: 'Żądanie jest zbyt duże.' }, 413) }));
  app.get('/api/health', (c) => c.json({ status: 'ok' }));
  app.notFound((c) => c.json({ error: 'Nie znaleziono zasobu.' }, 404));
  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    console.error(JSON.stringify({ code: 'INTERNAL_ERROR', name: error.name }));
    return c.json({ error: 'Błąd serwera.' }, 500);
  });
  return app;
}
