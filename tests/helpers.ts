import { loadEnvFile } from 'node:process';
try {
  loadEnvFile('.env');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  `postgresql://licensing:${encodeURIComponent(process.env.POSTGRES_PASSWORD ?? '')}@127.0.0.1:5432/licensing_test`;
process.env.RABBITMQ_URL =
  process.env.TEST_RABBITMQ_URL ??
  `amqp://licensing:${encodeURIComponent(process.env.RABBITMQ_PASSWORD ?? '')}@127.0.0.1:5672/licensing_test`;
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export async function until<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  timeout = 15_000,
): Promise<T> {
  const deadline = Date.now() + timeout;
  while (true) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() >= deadline) throw new Error('Timed out waiting for persisted result');
    await sleep(50);
  }
}
