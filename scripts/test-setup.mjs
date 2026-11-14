import { loadEnvFile } from 'node:process';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import pg from 'pg';
import { createDatabase } from '@app/database';
import { seedDatabase } from '../packages/database/dist/seed.js';
try {
  loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  `postgresql://licensing:${encodeURIComponent(process.env.POSTGRES_PASSWORD ?? '')}@127.0.0.1:5432/licensing_test`;
const target = new URL(databaseUrl);
if (!/^\/[a-z0-9_]+_test$/.test(target.pathname))
  throw new Error('Test database name must end in _test');
const adminUrl = new URL(databaseUrl);
adminUrl.pathname = '/postgres';
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
try {
  const name = target.pathname.slice(1);
  if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])).rowCount)
    await admin.query(`CREATE DATABASE "${name}"`);
} finally {
  await admin.end();
}
const management = process.env.TEST_RABBITMQ_MANAGEMENT_URL ?? 'http://127.0.0.1:15672';
const brokerUrl = new URL(
  process.env.TEST_RABBITMQ_URL ??
    `amqp://licensing:${encodeURIComponent(process.env.RABBITMQ_PASSWORD ?? '')}@127.0.0.1:5672/licensing_test`,
);
const vhost = decodeURIComponent(brokerUrl.pathname.slice(1));
if (!vhost.endsWith('_test')) throw new Error('Test RabbitMQ vhost must end in _test');
const authorization = `Basic ${Buffer.from(`${decodeURIComponent(brokerUrl.username)}:${decodeURIComponent(brokerUrl.password)}`).toString('base64')}`;
for (const [path, body] of [
  [`/api/vhosts/${encodeURIComponent(vhost)}`, {}],
  [
    `/api/permissions/${encodeURIComponent(vhost)}/${encodeURIComponent(brokerUrl.username)}`,
    { configure: '.*', write: '.*', read: '.*' },
  ],
]) {
  const response = await fetch(new URL(path, management), {
    method: 'PUT',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Test broker setup failed: HTTP ${response.status}`);
}
const migration = spawn(
  process.execPath,
  [
    'node_modules/prisma/build/index.js',
    'migrate',
    'deploy',
    '--config',
    'packages/database/prisma.config.ts',
  ],
  { stdio: 'inherit', env: { ...process.env, DATABASE_URL: databaseUrl } },
);
const [exitCode] = await once(migration, 'exit');
if (exitCode !== 0) process.exit(exitCode ?? 1);
const db = createDatabase(databaseUrl);
try {
  await seedDatabase(db, process.env.ADMIN_EMAIL ?? '', process.env.ADMIN_PASSWORD ?? '');
} finally {
  await db.$disconnect();
}
console.log(
  'Isolated test database and RabbitMQ vhost ready; existing application data preserved.',
);
