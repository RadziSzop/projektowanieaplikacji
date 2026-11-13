import { randomUUID } from 'node:crypto';
import { envelopeSchema, queues, type Envelope, type Queue } from '@app/contracts';
import { type Database, type Transaction } from '@app/database';
import { LeaseBusy, WorkError } from './errors.js';
import { lockEntity, markProcessed, processed } from './idempotency.js';
import { enqueue } from './outbox.js';

export const retryDelays = [10_000, 60_000, 300_000] as const;

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

export async function quarantine(db: Database, queue: Queue, messageId: string) {
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
