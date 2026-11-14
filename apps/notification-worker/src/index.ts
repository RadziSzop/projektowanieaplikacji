import { createServer } from 'node:http';
import { createDatabase } from '@app/database';
import { queues } from '@app/contracts';
import { encryptionKey } from '@app/license-core';
import { startConsumer } from '@app/messaging';
import { deliver } from './service.js';
import { createMailer, writeMetric } from './adapters.js';

const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} required`);
  return value;
};
const db = createDatabase();
const secret = required('KEY_ENCRYPTION_KEY');
encryptionKey(secret);
const url = required('RABBITMQ_URL');
const port = Number(process.env.PORT ?? 3002);
const smtpPort = Number(process.env.SMTP_PORT ?? 1025);
if (![port, smtpPort].every((v) => Number.isInteger(v) && v > 0 && v <= 65535))
  throw new Error('Invalid port');
const mailer = createMailer({
  host: required('SMTP_HOST'),
  port: smtpPort,
  from: process.env.SMTP_FROM ?? 'licenses@nova.local',
});
const influx = {
  url: required('INFLUXDB_URL'),
  token: required('INFLUXDB_TOKEN'),
  org: process.env.INFLUXDB_ORG ?? 'licensing',
  bucket: process.env.INFLUXDB_BUCKET ?? 'events',
};
const email = startConsumer(db, url, queues.email, (message) =>
  deliver(db, secret, queues.email, message, mailer.send),
);
const metrics = startConsumer(db, url, queues.metrics, (message) =>
  deliver(db, secret, queues.metrics, message, (context) => writeMetric(influx, context)),
);
const server = createServer((_request, response) => {
  void db.$queryRaw`SELECT 1`
    .then(() => {
      const ready = email.ready && metrics.ready;
      response
        .writeHead(ready ? 200 : 503, { 'content-type': 'application/json' })
        .end(JSON.stringify({ status: ready ? 'ready' : 'starting' }));
    })
    .catch(() => response.writeHead(503).end());
}).listen(port, '0.0.0.0');
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref();
    server.close();
    void Promise.all([email.stop(), metrics.stop()])
      .then(() => {
        mailer.close();
        return db.$disconnect();
      })
      .then(() => {
        clearTimeout(force);
        process.exit(0);
      });
  });
