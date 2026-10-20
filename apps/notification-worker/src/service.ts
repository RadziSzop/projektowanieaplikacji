import { randomUUID } from 'node:crypto';
import { type Database } from '@app/database';
import { queues, type Envelope, type Queue } from '@app/contracts';
import { decryptKey } from '@app/license-core';
import { lockEntity, processed, markProcessed, WorkError, LeaseBusy } from '@app/messaging';

export type DeliveryContext = {
  licenseId: string;
  jobId: string;
  recipientEmail: string;
  createdAt: Date;
  key?: string;
};
export async function deliver(
  db: Database,
  secret: string,
  queue: Exclude<Queue, 'license.generate'>,
  message: Envelope,
  action: (context: DeliveryContext) => Promise<void>,
): Promise<void> {
  const kind = queue === queues.email ? 'EMAIL' : 'METRICS';
  const token = randomUUID();
  const claimed = await db.$transaction(async (tx) => {
    await lockEntity(tx, queue, message.entityId);
    if (await processed(tx, queue, message.messageId)) return null;
    const delivery = await tx.delivery.findUnique({
      where: { licenseId_kind: { licenseId: message.entityId, kind } },
      include: { license: { include: { job: true } } },
    });
    if (!delivery) throw new WorkError('DELIVERY_NOT_FOUND', true);
    if (['SENT', 'WRITTEN', 'FAILED'].includes(delivery.status)) {
      await markProcessed(tx, queue, message.messageId);
      return null;
    }
    if (delivery.leaseUntil && delivery.leaseUntil > new Date())
      throw new LeaseBusy(delivery.leaseUntil.getTime() - Date.now());
    await tx.delivery.update({
      where: { id: delivery.id },
      data: { status: 'PROCESSING', leaseToken: token, leaseUntil: new Date(Date.now() + 60_000) },
    });
    return delivery;
  });
  if (!claimed) return;
  try {
    const license = claimed.license;
    const context: DeliveryContext = {
      licenseId: license.id,
      jobId: license.generationJobId,
      recipientEmail: license.job.recipientEmail,
      createdAt: license.createdAt,
    };
    if (kind === 'EMAIL') context.key = decryptKey(license.keyCiphertext, secret);
    await action(context);
    await db.$transaction(async (tx) => {
      const result = await tx.delivery.updateMany({
        where: { id: claimed.id, leaseToken: token },
        data: {
          status: kind === 'EMAIL' ? 'SENT' : 'WRITTEN',
          attempts: { increment: 1 },
          errorCode: null,
          leaseToken: null,
          leaseUntil: null,
          finishedAt: new Date(),
        },
      });
      if (result.count !== 1) throw new WorkError('LOST_LEASE', false, token);
      await markProcessed(tx, queue, message.messageId);
    });
  } catch (error) {
    throw new WorkError(
      error instanceof WorkError ? error.code : `${kind}_UNAVAILABLE`,
      error instanceof WorkError && error.permanent,
      token,
    );
  }
}
