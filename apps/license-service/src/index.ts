import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { serve } from '@hono/node-server';
import { createDatabase } from '@app/database';
import { queues, verifySchema, z } from '@app/contracts';
import { encryptionKey } from '@app/license-core';
import { startConsumer } from '@app/messaging';
import { generateLicense, verifyLicense } from './service.js';

const db = createDatabase();
const secret = process.env.KEY_ENCRYPTION_KEY ?? '';
encryptionKey(secret);
const url = process.env.RABBITMQ_URL;
if (!url) throw new Error('RABBITMQ_URL required');
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const consumer = startConsumer(db, url, queues.generation, (message) =>
  generateLicense(db, secret, message),
);
const app = new Hono();
app.use('*', bodyLimit({ maxSize: 4096 }));
app.get('/health', async (c) => {
  await db.$queryRaw`SELECT 1`;
  return c.json({ status: 'ok', broker: consumer.ready });
});
app.post('/verify', async (c) => {
  const { key } = verifySchema.parse(await c.req.json());
  return c.json({ status: await verifyLicense(db, key) });
});
app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((error, c) =>
  c.json(
    {
      error:
        error instanceof z.ZodError || error instanceof SyntaxError
          ? 'Invalid request'
          : 'Service unavailable',
    },
    error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503,
  ),
);
const server = serve({ fetch: app.fetch, hostname: '0.0.0.0', port });
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref();
    server.close();
    void consumer
      .stop()
      .then(() => db.$disconnect())
      .then(() => {
        clearTimeout(force);
        process.exit(0);
      });
  });
