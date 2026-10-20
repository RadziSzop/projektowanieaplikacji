import { serve } from '@hono/node-server';
import { createDatabase } from '@app/database';
import { startOutboxPublisher } from '@app/messaging';
import { createApi } from './api.js';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const db = createDatabase();
const secret = process.env.KEY_ENCRYPTION_KEY ?? '';
const brokerUrl = process.env.RABBITMQ_URL;
if (!brokerUrl) throw new Error('RABBITMQ_URL required');
const origin = process.env.PUBLIC_ORIGIN ?? 'http://localhost:8080';
const origins = [origin, ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173'])];
const app = createApi({ db, secret, origins, secureCookies: new URL(origin).protocol === 'https:', verifyUrl: process.env.LICENSE_SERVICE_URL ?? 'http://license-service:3001' });
const publisher = startOutboxPublisher(db, brokerUrl);
const server = serve({ fetch: app.fetch, hostname: '0.0.0.0', port }, () => {
  console.log(`API listening on port ${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    const force = setTimeout(() => process.exit(1), 15_000); force.unref();
    void Promise.all([new Promise<void>((resolve) => server.close(() => resolve())), publisher.stop()])
      .then(() => db.$disconnect()).then(() => { clearTimeout(force); process.exit(0); });
  });
}
