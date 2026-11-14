import { type Database, Prisma } from '@app/database';
import { type Envelope, queues, type Verification } from '@app/contracts';
import { generateKey, encryptKey, keyHash, matchesFormat, licenseState } from '@app/license-core';
import {
  enqueue,
  newMessage,
  processed,
  markProcessed,
  lockEntity,
  WorkError,
} from '@app/messaging';

export async function generateLicense(
  db: Database,
  secret: string,
  message: Envelope,
): Promise<void> {
  for (let collision = 0; collision < 3; collision++) {
    try {
      await db.$transaction(async (tx) => {
        await lockEntity(tx, queues.generation, message.entityId);
        if (await processed(tx, queues.generation, message.messageId)) return;
        const job = await tx.generationJob.findUnique({
          where: { id: message.entityId },
          include: { configVersion: true, license: true },
        });
        if (!job) throw new WorkError('JOB_NOT_FOUND', true);
        if (job.license || job.status === 'COMPLETED' || job.status === 'FAILED') {
          await markProcessed(tx, queues.generation, message.messageId);
          return;
        }
        await tx.generationJob.update({ where: { id: job.id }, data: { status: 'PROCESSING' } });
        const key = generateKey(job.configVersion);
        const now = new Date();
        const license = await tx.license.create({
          data: {
            generationJobId: job.id,
            ownerId: job.ownerId,
            configVersionId: job.configVersionId,
            keyHash: keyHash(key),
            keyCiphertext: new Uint8Array(encryptKey(key, secret)),
            expiresAt:
              job.configVersion.validityDays === null
                ? null
                : new Date(now.getTime() + job.configVersion.validityDays * 86400_000),
            deliveries: { create: [{ kind: 'EMAIL' }, { kind: 'METRICS' }] },
          },
        });
        await tx.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            attempts: { increment: 1 },
            errorCode: null,
            finishedAt: now,
          },
        });
        const event = newMessage('license.generated', license.id);
        await enqueue(tx, queues.email, event);
        await enqueue(
          tx,
          queues.metrics,
          newMessage('license.generated', license.id, event.eventId),
        );
        await markProcessed(tx, queues.generation, message.messageId);
      });
      return;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
      throw error;
    }
  }
  throw new WorkError('KEY_COLLISION_LIMIT');
}
export async function verifyLicense(db: Database, key: string): Promise<Verification> {
  const license = await db.license.findUnique({
    where: { keyHash: keyHash(key) },
    include: { configVersion: true },
  });
  if (!license || !matchesFormat(key, license.configVersion)) return 'INVALID';
  return licenseState(license);
}
