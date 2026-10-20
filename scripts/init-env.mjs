import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const secret = () => randomBytes(32).toString('hex');
const content = [
  `POSTGRES_PASSWORD=${secret()}`,
  `RABBITMQ_PASSWORD=${secret()}`,
  `KEY_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`,
  'ADMIN_EMAIL=admin@example.test',
  `ADMIN_PASSWORD=${secret()}`,
  `INFLUXDB_PASSWORD=${secret()}`,
  `INFLUXDB_TOKEN=${secret()}`,
  'PUBLIC_ORIGIN=http://localhost:8080',
  '',
].join('\n');
try {
  await writeFile('.env', content, { flag: 'wx', mode: 0o600 });
  console.log(
    'Created ignored .env with local secrets. Read the administrator credentials from that file.',
  );
} catch (error) {
  if (error.code === 'EEXIST') console.log('Existing .env preserved.');
  else throw error;
}
