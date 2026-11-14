import '../helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '@app/database';
import { decryptKey } from '@app/license-core';
import { newMessage } from '@app/messaging';

test('concurrent generation issues exactly one license and verification respects expiry and revocation', async () => {
  const service = await import('../../apps/license-service/src/service.js').catch(() => null);
  assert.ok(service, 'License service must exist');
  const db = createDatabase();
  try {
    const user = await db.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const format = await db.configVersion.findFirstOrThrow();
    const job = await db.generationJob.create({
      data: {
        requestedById: user.id,
        ownerId: user.id,
        recipientEmail: user.email,
        configVersionId: format.id,
      },
    });
    const message = newMessage('license.generation.requested', job.id);
    await Promise.all([
      service.generateLicense(db, process.env.KEY_ENCRYPTION_KEY!, message),
      service.generateLicense(db, process.env.KEY_ENCRYPTION_KEY!, message),
    ]);
    assert.equal(await db.license.count({ where: { generationJobId: job.id } }), 1);
    const license = await db.license.findUniqueOrThrow({ where: { generationJobId: job.id } });
    const key = decryptKey(license.keyCiphertext, process.env.KEY_ENCRYPTION_KEY!);
    assert.equal(await service.verifyLicense(db, ` ${key.toLowerCase()} `), 'VALID');
    assert.equal(
      await service.verifyLicense(db, key.slice(0, -1) + (key.endsWith('A') ? 'B' : 'A')),
      'INVALID',
    );
    assert.equal(
      await db.outbox.count({
        where: {
          queue: { in: ['notification.email', 'notification.metrics'] },
          payload: { path: ['entityId'], equals: license.id },
        },
      }),
      2,
    );
    await assert.rejects(
      db.configVersion.update({ where: { id: format.id }, data: { prefix: 'CHANGED' } }),
    );
    await db.license.update({ where: { id: license.id }, data: { expiresAt: new Date(0) } });
    assert.equal(await service.verifyLicense(db, key), 'EXPIRED');
    await db.license.update({ where: { id: license.id }, data: { revokedAt: new Date() } });
    assert.equal(await service.verifyLicense(db, key), 'REVOKED');
  } finally {
    await db.$disconnect();
  }
});

test('mail and metrics finish independently and successful delivery is not repeated', async () => {
  const service = await import('../../apps/notification-worker/src/service.js').catch(() => null);
  const adapters = await import('../../apps/notification-worker/src/adapters.js').catch(() => null);
  assert.ok(service && adapters, 'Notification worker must exist');
  const db = createDatabase();
  const { queues } = await import('@app/contracts');
  try {
    const license = await db.license.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
    const transport = adapters.createMailer({
      host: '127.0.0.1',
      port: 1025,
      from: 'licenses@nova.local',
    });
    const email = newMessage('license.generated', license.id);
    await service.deliver(db, process.env.KEY_ENCRYPTION_KEY!, queues.email, email, transport.send);
    const delivered = await db.delivery.findUniqueOrThrow({
      where: { licenseId_kind: { licenseId: license.id, kind: 'EMAIL' } },
    });
    assert.equal(delivered.status, 'SENT');
    await service.deliver(
      db,
      process.env.KEY_ENCRYPTION_KEY!,
      queues.email,
      newMessage('license.generated', license.id),
      async () => {
        throw new Error('Completed email must never be sent again');
      },
    );
    const metric = newMessage('license.generated', license.id);
    const broken = (context: Parameters<typeof adapters.writeMetric>[1]) =>
      adapters.writeMetric(
        { url: 'http://127.0.0.1:1', token: 'unused', org: 'licensing', bucket: 'events' },
        context,
      );
    let failure: unknown;
    try {
      await service.deliver(db, process.env.KEY_ENCRYPTION_KEY!, queues.metrics, metric, broken);
    } catch (error) {
      failure = error;
    }
    assert.ok(failure);
    const { recordFailure } = await import('@app/messaging');
    await recordFailure(db, queues.metrics, metric, failure);
    assert.equal(
      (await db.delivery.findUniqueOrThrow({ where: { id: delivered.id } })).status,
      'SENT',
    );
    const retry = await db.outbox.findFirstOrThrow({
      where: { eventId: metric.eventId, queue: queues.metrics },
      orderBy: { createdAt: 'desc' },
    });
    await service.deliver(
      db,
      process.env.KEY_ENCRYPTION_KEY!,
      queues.metrics,
      retry.payload as never,
      (context) =>
        adapters.writeMetric(
          {
            url: 'http://127.0.0.1:8086',
            token: process.env.INFLUXDB_TOKEN!,
            org: 'licensing',
            bucket: 'events',
          },
          context,
        ),
    );
    assert.equal(
      (
        await db.delivery.findUniqueOrThrow({
          where: { licenseId_kind: { licenseId: license.id, kind: 'METRICS' } },
        })
      ).status,
      'WRITTEN',
    );
    transport.close();
  } finally {
    await db.$disconnect();
  }
});

test('an SMTP outage retries the existing key without regenerating it or repeating completed metrics', async () => {
  const { generateLicense } = await import('../../apps/license-service/src/service.js');
  const { deliver } = await import('../../apps/notification-worker/src/service.js');
  const { createMailer, writeMetric } =
    await import('../../apps/notification-worker/src/adapters.js');
  const { recordFailure } = await import('@app/messaging');
  const { queues, envelopeSchema } = await import('@app/contracts');
  const db = createDatabase();
  const bad = createMailer({ host: '127.0.0.1', port: 1, from: 'licenses@nova.local' });
  const good = createMailer({ host: '127.0.0.1', port: 1025, from: 'licenses@nova.local' });
  try {
    const user = await db.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const version = await db.configVersion.findFirstOrThrow();
    const job = await db.generationJob.create({
      data: {
        ownerId: user.id,
        requestedById: user.id,
        recipientEmail: user.email,
        configVersionId: version.id,
      },
    });
    await generateLicense(
      db,
      process.env.KEY_ENCRYPTION_KEY!,
      newMessage('license.generation.requested', job.id),
    );
    const license = await db.license.findUniqueOrThrow({ where: { generationJobId: job.id } });
    await deliver(
      db,
      process.env.KEY_ENCRYPTION_KEY!,
      queues.metrics,
      newMessage('license.generated', license.id),
      (context) =>
        writeMetric(
          {
            url: 'http://127.0.0.1:8086',
            token: process.env.INFLUXDB_TOKEN!,
            org: 'licensing',
            bucket: 'events',
          },
          context,
        ),
    );
    const metrics = await db.delivery.findUniqueOrThrow({
      where: { licenseId_kind: { licenseId: license.id, kind: 'METRICS' } },
    });
    const email = newMessage('license.generated', license.id);
    let failure: unknown;
    try {
      await deliver(db, process.env.KEY_ENCRYPTION_KEY!, queues.email, email, bad.send);
    } catch (error) {
      failure = error;
    }
    assert.ok(failure);
    await recordFailure(db, queues.email, email, failure);
    await generateLicense(
      db,
      process.env.KEY_ENCRYPTION_KEY!,
      newMessage('license.generation.requested', job.id),
    );
    const retry = await db.outbox.findFirstOrThrow({
      where: { eventId: email.eventId, queue: queues.email },
      orderBy: { createdAt: 'desc' },
    });
    await deliver(
      db,
      process.env.KEY_ENCRYPTION_KEY!,
      queues.email,
      envelopeSchema.parse(retry.payload),
      good.send,
    );
    assert.equal(
      (
        await db.delivery.findUniqueOrThrow({
          where: { licenseId_kind: { licenseId: license.id, kind: 'EMAIL' } },
        })
      ).status,
      'SENT',
    );
    assert.equal(await db.license.count({ where: { generationJobId: job.id } }), 1);
    assert.equal(
      (await db.license.findUniqueOrThrow({ where: { id: license.id } })).keyHash,
      license.keyHash,
    );
    assert.equal(
      (await db.delivery.findUniqueOrThrow({ where: { id: metrics.id } })).finishedAt?.getTime(),
      metrics.finishedAt?.getTime(),
    );
  } finally {
    bad.close();
    good.close();
    await db.$disconnect();
  }
});
