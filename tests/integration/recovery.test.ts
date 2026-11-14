import { sleep, until } from '../helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '@app/database';
import { queues } from '@app/contracts';
import {
  startConsumer,
  startOutboxPublisher,
  connectBroker,
  enqueue,
  newMessage,
  publishOutboxBatch,
} from '@app/messaging';
import { generateLicense } from '../../apps/license-service/src/service.js';
import { envelopeSchema } from '@app/contracts';
import type { GetMessage } from 'amqplib';

test('shutdown completes when requested before the consumer has connected', async () => {
  const db = createDatabase();
  const consumer = startConsumer(db, process.env.RABBITMQ_URL!, queues.generation, (message) =>
    generateLicense(db, process.env.KEY_ENCRYPTION_KEY!, message),
  );
  try {
    const stopping = consumer.stop();
    const stopped = await Promise.race([stopping.then(() => true), sleep(1500).then(() => false)]);
    if (!stopped) await consumer.stop();
    assert.equal(stopped, true, 'Stopping during connect must not leave a live consumer');
  } finally {
    await consumer.stop();
    await db.$disconnect();
  }
});

test('a result committed before ACK survives real RabbitMQ redelivery with the same license', async () => {
  const db = createDatabase();
  let broker = await connectBroker(process.env.RABBITMQ_URL!);
  const held: GetMessage[] = [];
  try {
    const user = await db.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const format = await db.configVersion.findFirstOrThrow();
    const job = await db.generationJob.create({
      data: {
        requestedById: user.id,
        ownerId: user.id,
        configVersionId: format.id,
        recipientEmail: user.email,
      },
    });
    const message = newMessage('license.generation.requested', job.id);
    await new Promise<void>((resolve, reject) =>
      broker.channel.sendToQueue(
        queues.generation,
        Buffer.from(JSON.stringify(message)),
        { persistent: true, messageId: message.messageId },
        (error) => (error ? reject(error) : resolve()),
      ),
    );
    async function target() {
      return until(
        async () => {
          const delivery = await broker.channel.get(queues.generation, { noAck: false });
          if (!delivery) return null;
          if (delivery.properties.messageId === message.messageId) return delivery;
          held.push(delivery);
          return null;
        },
        (delivery) => !!delivery,
      );
    }
    const first = (await target())!;
    await generateLicense(
      db,
      process.env.KEY_ENCRYPTION_KEY!,
      envelopeSchema.parse(JSON.parse(first.content.toString())),
    );
    const issued = await db.license.findUniqueOrThrow({ where: { generationJobId: job.id } });
    await broker.connection.close(); // Deliberately no ACK after the committed result.
    held.length = 0;
    broker = await connectBroker(process.env.RABBITMQ_URL!);
    const redelivered = (await target())!;
    assert.equal(redelivered.fields.redelivered, true);
    await generateLicense(
      db,
      process.env.KEY_ENCRYPTION_KEY!,
      envelopeSchema.parse(JSON.parse(redelivered.content.toString())),
    );
    broker.channel.ack(redelivered);
    assert.equal(await db.license.count({ where: { generationJobId: job.id } }), 1);
    assert.equal(
      (await db.license.findUniqueOrThrow({ where: { generationJobId: job.id } })).keyHash,
      issued.keyHash,
    );
    assert.equal((await db.generationJob.findUniqueOrThrow({ where: { id: job.id } })).attempts, 1);
  } finally {
    for (const delivery of held) broker.channel.nack(delivery, false, true);
    await broker.connection.close().catch(() => {});
    await db.$disconnect();
  }
});

test('outbox survives a broker outage and catches up after reconnection', async () => {
  const db = createDatabase();
  const message = newMessage('license.generation.requested', randomUUID());
  await db.$transaction((tx) => enqueue(tx, queues.generation, message));
  const publisher = startOutboxPublisher(db, 'amqp://127.0.0.1:1');
  try {
    await sleep(250);
    assert.equal(
      (await db.outbox.findUniqueOrThrow({ where: { id: message.messageId } })).sentAt,
      null,
    );
  } finally {
    await publisher.stop();
  }
  const broker = await connectBroker(process.env.RABBITMQ_URL!);
  try {
    for (let i = 0; i < 20; i++) {
      await publishOutboxBatch(db, broker.channel);
      if ((await db.outbox.findUniqueOrThrow({ where: { id: message.messageId } })).sentAt) break;
    }
    assert.ok((await db.outbox.findUniqueOrThrow({ where: { id: message.messageId } })).sentAt);
  } finally {
    await broker.connection.close();
    await db.$disconnect();
  }
});

test('malformed broker messages reach DLQ without persisting their body or looping on an invalid message id', async () => {
  const db = createDatabase();
  const initial = await db.deadLetter.count({ where: { errorCode: 'INVALID_ENVELOPE' } });
  const broker = await connectBroker(process.env.RABBITMQ_URL!);
  const consumer = startConsumer(db, process.env.RABBITMQ_URL!, queues.generation, (message) =>
    generateLicense(db, process.env.KEY_ENCRYPTION_KEY!, message),
  );
  try {
    await new Promise<void>((resolve, reject) =>
      broker.channel.sendToQueue(
        queues.generation,
        Buffer.from(JSON.stringify({ key: 'never-persist-poison-body' })),
        { persistent: true, messageId: '------------------------------------' },
        (error) => (error ? reject(error) : resolve()),
      ),
    );
    await until(
      () => db.deadLetter.count({ where: { errorCode: 'INVALID_ENVELOPE' } }),
      (count) => count > initial,
      4000,
    );
    const last = await db.deadLetter.findFirstOrThrow({
      where: { errorCode: 'INVALID_ENVELOPE' },
      orderBy: { createdAt: 'desc' },
    });
    assert.deepEqual(last.payload, { invalid: true });
  } finally {
    await consumer.stop();
    await broker.connection.close();
    await db.$disconnect();
  }
});
