import amqp, { type ConfirmChannel, type ChannelModel } from 'amqplib';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { envelopeSchema, queues, type Envelope, type Queue } from '@app/contracts';
import { type Database, type Transaction, type GenerationJob, type Delivery } from '@app/database';

export class WorkError extends Error {
  constructor(
    public readonly code: string,
    public readonly permanent = false,
    public readonly leaseToken?: string,
  ) {
    super(code);
  }
}
export class LeaseBusy extends Error {
  constructor(public readonly waitMs: number) {
    super('LEASE_BUSY');
  }
}
export const retryDelays = [10_000, 60_000, 300_000] as const;
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
export async function processed(
  tx: Transaction,
  consumer: string,
  messageId: string,
): Promise<{ consumer: string; messageId: string; processedAt: Date } | null> {
  return tx.processedMessage.findUnique({ where: { consumer_messageId: { consumer, messageId } } });
}
export async function markProcessed(tx: Transaction, consumer: string, messageId: string) {
  await tx.processedMessage.createMany({ data: [{ consumer, messageId }], skipDuplicates: true });
}
export async function lockEntity(
  tx: Transaction,
  queue: Queue,
  id: string,
): Promise<GenerationJob | Delivery | null> {
  if (queue === queues.generation) {
    await tx.$queryRaw`SELECT id FROM licensing."GenerationJob" WHERE id = ${id}::uuid FOR UPDATE`;
    return tx.generationJob.findUnique({ where: { id } });
  }
  const kind = queue === queues.email ? 'EMAIL' : 'METRICS';
  await tx.$queryRaw`SELECT id FROM licensing."Delivery" WHERE "licenseId" = ${id}::uuid AND kind::text = ${kind} FOR UPDATE`;
  return tx.delivery.findUnique({ where: { licenseId_kind: { licenseId: id, kind } } });
}
const finished = (status: string) => ['COMPLETED', 'SENT', 'WRITTEN'].includes(status);

async function failInTransaction(tx: Transaction, queue: Queue, message: Envelope, error: unknown) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${queue}:${message.messageId}`}, 0))::text`;
  if (await processed(tx, queue, message.messageId)) return;
  const target = await lockEntity(tx, queue, message.entityId);
  if (target && (finished(target.status) || target.status === 'FAILED')) {
    await markProcessed(tx, queue, message.messageId);
    return;
  }
  if (
    error instanceof LeaseBusy ||
    (target &&
      'leaseToken' in target &&
      target.leaseToken &&
      error instanceof WorkError &&
      error.leaseToken !== target.leaseToken)
  ) {
    const wait = error instanceof LeaseBusy ? error.waitMs : 60_000;
    await enqueue(
      tx,
      queue,
      { ...message, messageId: randomUUID() },
      new Date(Date.now() + Math.max(1000, wait)),
    );
    await markProcessed(tx, queue, message.messageId);
    return;
  }
  const attempts = (target?.attempts ?? 0) + 1;
  const terminal =
    !target || (error instanceof WorkError && error.permanent) || attempts > retryDelays.length;
  const code = error instanceof WorkError ? error.code : 'PROCESSING_UNAVAILABLE';
  if (target) {
    const state = {
      attempts,
      errorCode: code,
      status: terminal ? ('FAILED' as const) : ('PENDING' as const),
      finishedAt: terminal ? new Date() : null,
    };
    if (queue === queues.generation)
      await tx.generationJob.update({ where: { id: target.id }, data: state });
    else
      await tx.delivery.update({
        where: { id: target.id },
        data: { ...state, leaseToken: null, leaseUntil: null },
      });
  }
  if (terminal) {
    const dead = await tx.deadLetter.create({
      data: {
        consumer: queue,
        messageId: message.messageId,
        queue,
        payload: message,
        attempts,
        errorCode: code,
      },
    });
    await tx.outbox.create({
      data: { eventId: message.eventId, queue: `${queue}.dlq`, payload: { deadLetterId: dead.id } },
    });
  } else {
    await enqueue(
      tx,
      queue,
      { ...message, messageId: randomUUID() },
      new Date(Date.now() + retryDelays[attempts - 1]),
    );
  }
  await markProcessed(tx, queue, message.messageId);
}
export const recordFailure = (db: Database, queue: Queue, message: Envelope, error: unknown) =>
  db.$transaction((tx) => failInTransaction(tx, queue, message, error));

async function quarantine(db: Database, queue: Queue, messageId: string) {
  await db.$transaction(async (tx) => {
    const dead = await tx.deadLetter.upsert({
      where: { consumer_messageId: { consumer: queue, messageId } },
      update: {},
      create: {
        consumer: queue,
        messageId,
        queue,
        payload: { invalid: true },
        errorCode: 'INVALID_ENVELOPE',
        attempts: 1,
      },
    });
    if (await processed(tx, queue, messageId)) return;
    await tx.outbox.create({
      data: { eventId: messageId, queue: `${queue}.dlq`, payload: { deadLetterId: dead.id } },
    });
    await markProcessed(tx, queue, messageId);
  });
}

export async function redrive(db: Database, deadLetterId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM messaging."DeadLetter" WHERE id = ${deadLetterId}::uuid FOR UPDATE`;
    const dead = await tx.deadLetter.findUniqueOrThrow({ where: { id: deadLetterId } });
    if (dead.redrivenAt) return false;
    const parsed = envelopeSchema.safeParse(dead.payload);
    if (!parsed.success || !Object.values(queues).includes(dead.queue as Queue))
      throw new WorkError('UNREPLAYABLE_MESSAGE', true);
    const queue = dead.queue as Queue;
    const target = await lockEntity(tx, queue, parsed.data.entityId);
    if (!target) throw new WorkError('ENTITY_NOT_FOUND', true);
    if (target.status === 'FAILED') {
      const reset = { status: 'PENDING' as const, attempts: 0, errorCode: null, finishedAt: null };
      if (queue === queues.generation)
        await tx.generationJob.update({ where: { id: target.id }, data: reset });
      else
        await tx.delivery.update({
          where: { id: target.id },
          data: { ...reset, leaseToken: null, leaseUntil: null },
        });
      await enqueue(tx, queue, { ...parsed.data, messageId: randomUUID() });
    }
    await tx.deadLetter.update({ where: { id: dead.id }, data: { redrivenAt: new Date() } });
    return target.status === 'FAILED';
  });
}

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

export type Runner = { stop(): Promise<void>; readonly ready: boolean };
function background(
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
