import amqp, { type ChannelModel } from 'amqplib';
import { setTimeout as delay } from 'node:timers/promises';
import { queues } from '@app/contracts';

export async function connectBroker(url: string) {
  const connection = await amqp.connect(url, { timeout: 5000 });
  connection.on('error', () => {});
  try {
    const channel = await connection.createConfirmChannel();
    channel.on('error', () => {});
    for (const queue of Object.values(queues)) {
      await channel.assertQueue(queue, { durable: true });
      await channel.assertQueue(`${queue}.dlq`, { durable: true });
    }
    return { connection, channel };
  } catch (error) {
    await connection.close().catch(() => {});
    throw error;
  }
}

export type Runner = { stop(): Promise<void>; readonly ready: boolean };
export function background(
  run: (
    signal: AbortSignal,
    connected: (connection: ChannelModel) => void,
    ready: (value: boolean) => void,
  ) => Promise<void>,
): Runner {
  const abort = new AbortController();
  let connection: ChannelModel | undefined;
  let ready = false;
  const loop = (async () => {
    while (!abort.signal.aborted) {
      try {
        await run(
          abort.signal,
          (c) => {
            connection = c;
          },
          (v) => {
            ready = v;
          },
        );
      } catch {
        if (!abort.signal.aborted)
          console.error(JSON.stringify({ code: 'BROKER_OR_DATABASE_UNAVAILABLE' }));
      }
      ready = false;
      await connection?.close().catch(() => {});
      connection = undefined;
      if (!abort.signal.aborted)
        await delay(1000, undefined, { signal: abort.signal }).catch(() => {});
    }
  })();
  return {
    get ready() {
      return ready;
    },
    async stop() {
      abort.abort();
      await connection?.close().catch(() => {});
      await loop;
    },
  };
}
