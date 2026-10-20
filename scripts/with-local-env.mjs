import { loadEnvFile } from 'node:process';
import { spawn } from 'node:child_process';
try {
  loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
process.env.DATABASE_URL ??= `postgresql://licensing:${encodeURIComponent(process.env.POSTGRES_PASSWORD ?? '')}@127.0.0.1:5432/licensing`;
process.env.RABBITMQ_URL ??= `amqp://licensing:${encodeURIComponent(process.env.RABBITMQ_PASSWORD ?? '')}@127.0.0.1:5672`;
process.env.LICENSE_SERVICE_URL ??= 'http://127.0.0.1:3001';
process.env.SMTP_HOST ??= '127.0.0.1';
process.env.SMTP_PORT ??= '1025';
process.env.INFLUXDB_URL ??= 'http://127.0.0.1:8086';
process.env.INFLUXDB_ORG ??= 'licensing';
process.env.INFLUXDB_BUCKET ??= 'events';
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('Pass a command to execute with the local environment');
const child = spawn(command === 'node' ? process.execPath : command, args, {
  stdio: 'inherit',
  shell: false,
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => {
  console.error('Unable to start local command');
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
