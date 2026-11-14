import { queues, type Queue } from '@app/contracts';
import { type Transaction, type GenerationJob, type Delivery } from '@app/database';

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
