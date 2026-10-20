import { until } from '../helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '@app/database';
import { queues, type Envelope } from '@app/contracts';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import type { GetMessage } from 'amqplib';

test('failures persist delayed retries, deduplicate redelivery, and finish in the actual DLQ', async () => {
  const m = await import('../../packages/messaging/src/index.js').catch(() => null);
  assert.ok(m, 'Durable failure handling must exist');
  const db = createDatabase();
  try {
    const user = await db.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const format = await db.configVersion.findFirstOrThrow();
    const job = await db.generationJob.create({
      data: {
        ownerId: user.id,
        requestedById: user.id,
        configVersionId: format.id,
        recipientEmail: user.email,
      },
    });
    let msg: Envelope = {
      version: 1,
      messageId: randomUUID(),
      eventId: randomUUID(),
      type: 'license.generation.requested',
      entityId: job.id,
    };
    for (let attempt = 1; attempt <= 4; attempt++) {
      const before = Date.now();
      await m.recordFailure(db, queues.generation, msg, new m.WorkError('TEST_UNAVAILABLE'));
      await m.recordFailure(db, queues.generation, msg, new m.WorkError('TEST_UNAVAILABLE'));
      assert.equal(
        (await db.generationJob.findUniqueOrThrow({ where: { id: job.id } })).attempts,
        attempt,
      );
      if (attempt < 4) {
        const retry = await db.outbox.findFirstOrThrow({
          where: { eventId: msg.eventId, queue: queues.generation },
          orderBy: { createdAt: 'desc' },
        });
        assert.ok(
          retry.availableAt.getTime() >= before + [10000, 60000, 300000][attempt - 1] - 100,
        );
        msg = retry.payload as unknown as Envelope;
      }
    }
    assert.equal(
      (await db.generationJob.findUniqueOrThrow({ where: { id: job.id } })).status,
      'FAILED',
    );
    const dead = await db.deadLetter.findUniqueOrThrow({
      where: { consumer_messageId: { consumer: queues.generation, messageId: msg.messageId } },
    });
    const broker = await m.connectBroker(process.env.RABBITMQ_URL!);
    try {
      const row = await db.outbox.findFirstOrThrow({
        where: {
          queue: `${queues.generation}.dlq`,
          payload: { path: ['deadLetterId'], equals: dead.id },
        },
      });
      for (
        let index = 0;
        index < 100 && !(await db.outbox.findUniqueOrThrow({ where: { id: row.id } })).sentAt;
        index++
      )
        await m.publishOutboxBatch(db, broker.channel);
      const held: GetMessage[] = [];
      let target: GetMessage | undefined;
      try {
        for (let index = 0; index < 1000; index++) {
          const delivery = await broker.channel.get(`${queues.generation}.dlq`, { noAck: false });
          if (!delivery) break;
          if (JSON.parse(delivery.content.toString()).deadLetterId === dead.id) target = delivery;
          else held.push(delivery);
        }
        assert.ok(target, 'The exact failed record must reach the actual DLQ');
        broker.channel.nack(target, false, true);
        const before = await db.outbox.count({
          where: { eventId: msg.eventId, queue: queues.generation },
        });
        async function cli(fixture: boolean) {
          const child = spawn(
            process.execPath,
            [
              '--import',
              'tsx',
              fixture ? 'tests/fixtures/dlq-crash-before-ack.mjs' : 'apps/backend/src/dlq.ts',
              'retry',
              '--queue',
              queues.generation,
              '--limit',
              '1',
            ],
            { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
          );
          let output = '';
          child.stdout.on('data', (part) => {
            output += part;
          });
          const [code] = await once(child, 'exit');
          return { code, output };
        }
        assert.equal((await cli(true)).code, 91);
        assert.ok((await db.deadLetter.findUniqueOrThrow({ where: { id: dead.id } })).redrivenAt);
        assert.equal(
          (await db.generationJob.findUniqueOrThrow({ where: { id: job.id } })).status,
          'PENDING',
        );
        assert.equal(
          await db.outbox.count({ where: { eventId: msg.eventId, queue: queues.generation } }),
          before + 1,
        );
        await until(
          () => broker.channel.checkQueue(`${queues.generation}.dlq`),
          (state) => state.messageCount > 0,
        );
        const repeated = await cli(false);
        assert.equal(repeated.code, 0);
        assert.deepEqual(JSON.parse(repeated.output.trim()), { replayed: 0, retained: 0 });
        assert.equal(
          await db.outbox.count({ where: { eventId: msg.eventId, queue: queues.generation } }),
          before + 1,
        );
        const remaining = await broker.channel.get(`${queues.generation}.dlq`, { noAck: false });
        if (remaining) {
          console.log(
            JSON.stringify({
              diagnostic: 'DLQ_AFTER_CLI_ACK',
              target: dead.id,
              remaining: JSON.parse(remaining.content.toString()).deadLetterId,
              held: held.length,
            }),
          );
          held.push(remaining);
        }
        assert.equal(remaining === false, true, 'CLI must acknowledge the replayed DLQ entry');
      } finally {
        for (const delivery of held) broker.channel.nack(delivery, false, true);
      }
    } finally {
      await broker.connection.close();
    }
  } finally {
    await db.$disconnect();
  }
});
