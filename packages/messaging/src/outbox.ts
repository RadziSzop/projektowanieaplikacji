import amqp, { type ConfirmChannel } from 'amqplib';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { queues, type Envelope, type Queue } from '@app/contracts';
import { type Database, type Transaction } from '@app/database';
import { background, connectBroker, type Runner } from './broker.js';
import { WorkError } from './errors.js';

export const newMessage = (
  type: Envelope['type'],
  entityId: string,
  eventId: string = randomUUID(),
): Envelope => ({ version: 1, messageId: randomUUID(), eventId, type, entityId });
export async function enqueue(
  tx: Transaction,
  queue: Queue,
  message: Envelope,
  availableAt = new Date(),
) {
  await tx.outbox.create({
    data: { id: message.messageId, eventId: message.eventId, queue, payload: message, availableAt },
  });
}

export async function publishOutboxBatch(db: Database, channel: ConfirmChannel): Promise<number> {
  const token = randomUUID();
  const rows = await db.$transaction(async (tx) => {
    const claimed = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM messaging."Outbox" WHERE "sentAt" IS NULL AND "availableAt" <= now() AND ("leaseUntil" IS NULL OR "leaseUntil" < now()) ORDER BY "availableAt" FOR UPDATE SKIP LOCKED LIMIT 25`;
    if (claimed.length)
      await tx.outbox.updateMany({
        where: { id: { in: claimed.map((r) => r.id) } },
        data: { leaseToken: token, leaseUntil: new Date(Date.now() + 30_000) },
      });
    return tx.outbox.findMany({ where: { leaseToken: token } });
  });
  const returned = new Set<string>();
  const onReturn = (msg: amqp.Message) => returned.add(msg.properties.messageId ?? '');
  channel.on('return', onReturn);
  try {
    for (const row of rows) {
      if (!Object.values(queues).some((q) => row.queue === q || row.queue === `${q}.dlq`))
        throw new WorkError('INVALID_QUEUE', true);
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('PUBLISH_TIMEOUT')), 10_000);
        channel.sendToQueue(
          row.queue,
          Buffer.from(JSON.stringify(row.payload)),
          { persistent: true, mandatory: true, contentType: 'application/json', messageId: row.id },
          (error) => {
            clearTimeout(timeout);
            if (error || returned.has(row.id)) reject(error ?? new Error('UNROUTABLE_MESSAGE'));
            else resolve();
          },
        );
      });
      await db.outbox.updateMany({
        where: { id: row.id, leaseToken: token },
        data: { sentAt: new Date(), leaseUntil: null, leaseToken: null },
      });
    }
    return rows.length;
  } catch (error) {
    await db.outbox
      .updateMany({ where: { leaseToken: token }, data: { leaseUntil: null, leaseToken: null } })
      .catch(() => {});
    throw error;
  } finally {
    channel.off('return', onReturn);
  }
}

export function startOutboxPublisher(db: Database, url: string): Runner {
  return background(async (signal, connected, ready) => {
    const broker = await connectBroker(url);
    connected(broker.connection);
    if (signal.aborted) return;
    ready(true);
    let closed = false;
    broker.connection.once('close', () => {
      closed = true;
    });
    while (!signal.aborted && !closed) {
      const count = await publishOutboxBatch(db, broker.channel);
      if (!count) await delay(300, undefined, { signal }).catch(() => {});
    }
  });
}
