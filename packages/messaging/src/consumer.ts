import { randomUUID } from 'node:crypto';
import { envelopeSchema, queues, type Envelope, type Queue } from '@app/contracts';
import { type Database } from '@app/database';
import { background, connectBroker, type Runner } from './broker.js';
import { WorkError } from './errors.js';
import { quarantine, recordFailure } from './failure.js';
import { markProcessed, processed } from './idempotency.js';

export function startConsumer(
  db: Database,
  url: string,
  queue: Queue,
  handler: (message: Envelope) => Promise<void>,
): Runner {
  return background(async (signal, connected, ready) => {
    const { connection, channel } = await connectBroker(url);
    connected(connection);
    if (signal.aborted) return;
    await channel.prefetch(1);
    const inFlight = new Set<Promise<void>>();
    const closed = new Promise<void>((resolve) => connection.once('close', resolve));
    const { consumerTag } = await channel.consume(queue, (delivery) => {
      if (!delivery) return;
      const work = (async () => {
        try {
          let parsed;
          try {
            parsed = envelopeSchema.safeParse(
              delivery.content.length <= 8192
                ? JSON.parse(delivery.content.toString('utf8'))
                : null,
            );
          } catch {
            parsed = envelopeSchema.safeParse(null);
          }
          if (!parsed.success) {
            const validId = envelopeSchema.shape.messageId.safeParse(delivery.properties.messageId);
            const id = validId.success ? validId.data : randomUUID();
            await quarantine(db, queue, id);
          } else if (!(await processed(db, queue, parsed.data.messageId))) {
            try {
              const expected =
                queue === queues.generation ? 'license.generation.requested' : 'license.generated';
              if (parsed.data.type !== expected) throw new WorkError('WRONG_EVENT_TYPE', true);
              await handler(parsed.data);
              await markProcessed(db, queue, parsed.data.messageId);
            } catch (error) {
              await recordFailure(db, queue, parsed.data, error);
            }
          }
          channel.ack(delivery);
        } catch {
          // Leave the message unacknowledged when persistence failed; reconnect redelivers it.
          await connection.close().catch(() => {});
        }
      })();
      inFlight.add(work);
      void work.finally(() => inFlight.delete(work));
    });
    ready(true);
    const abort = signal.aborted
      ? Promise.resolve()
      : new Promise<void>((resolve) =>
          signal.addEventListener('abort', () => resolve(), { once: true }),
        );
    await Promise.race([closed, abort]);
    await channel.cancel(consumerTag).catch(() => {});
    await Promise.allSettled(inFlight);
  });
}
