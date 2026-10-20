import { randomUUID } from 'node:crypto';
import { queues } from '@app/contracts';
import type { Transaction } from '@app/database';
import { enqueue, newMessage } from '@app/messaging';

export async function createJob(tx: Transaction, data: { ownerId: string; requestedById: string; recipientEmail: string; configVersionId: string; orderItemId?: string; unitIndex?: number }) {
  const job = await tx.generationJob.create({ data: { id: randomUUID(), ...data } });
  await enqueue(tx, queues.generation, newMessage('license.generation.requested', job.id));
  return { jobId: job.id, status: job.status };
}
