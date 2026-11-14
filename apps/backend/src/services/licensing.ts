import { randomUUID } from 'node:crypto';
import { queues, type z, type configSchema, type createConfigSchema, type jobSchema, type verifySchema } from '@app/contracts';
import type { Database, Transaction, User } from '@app/database';
import { decryptKey } from '@app/license-core';
import { enqueue, newMessage } from '@app/messaging';
import { ServiceError } from './errors.js';

type JobInput = { ownerId: string; requestedById: string; recipientEmail: string; configVersionId: string; orderItemId?: string; unitIndex?: number };

// Creates a generation job and its outbox message in the caller's transaction.
export async function createJob(tx: Transaction, data: JobInput) {
  const job = await tx.generationJob.create({ data: { id: randomUUID(), ...data } });
  await enqueue(tx, queues.generation, newMessage('license.generation.requested', job.id));
  return { jobId: job.id, status: job.status };
}

export const listConfigs = (db: Database) =>
  db.config.findMany({ where: { enabled: true }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } }, take: 100 });

export function createConfig(db: Database, adminId: string, input: z.infer<typeof createConfigSchema>) {
  const { format, ...data } = input;
  return db.config.create({ data: { ...data, createdById: adminId, versions: { create: { version: 1, ...format } } }, include: { versions: true } });
}

// New version becomes current for every product that used any version of this config.
export function addConfigVersion(db: Database, configId: string, format: z.infer<typeof configSchema>) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM licensing."Config" WHERE id = ${configId}::uuid FOR UPDATE`;
    await tx.config.findUniqueOrThrow({ where: { id: configId } });
    const latest = await tx.configVersion.findFirst({ where: { configId }, orderBy: { version: 'desc' } });
    const created = await tx.configVersion.create({ data: { configId, version: (latest?.version ?? 0) + 1, ...format } });
    await tx.product.updateMany({ where: { configVersion: { configId } }, data: { configVersionId: created.id } });
    return created;
  });
}

export async function requestJob(db: Database, user: User, data: z.infer<typeof jobSchema>) {
  if (data.ownerId && data.ownerId !== user.id && user.role !== 'ADMIN') throw new ServiceError(403, 'Brak uprawnień.');
  const owner = await db.user.findFirst({ where: { id: data.ownerId ?? user.id, disabledAt: null } });
  if (!owner) throw new ServiceError(404, 'Nie znaleziono użytkownika.');
  return db.$transaction(async (tx) => {
    const config = await tx.configVersion.findFirst({ where: { id: data.configVersionId, config: { enabled: true } } });
    if (!config) throw new ServiceError(404, 'Konfiguracja jest niedostępna.');
    return createJob(tx, { ownerId: owner.id, requestedById: user.id, recipientEmail: data.recipientEmail ?? owner.email, configVersionId: config.id });
  });
}

export async function getJob(db: Database, user: User, id: string) {
  const job = await db.generationJob.findFirst({ where: { id, ...(user.role === 'ADMIN' ? {} : { ownerId: user.id }) }, include: { license: { include: { deliveries: true } } } });
  if (!job) throw new ServiceError(404, 'Nie znaleziono zadania.');
  return { jobId: job.id, status: job.status, attempts: job.attempts, errorCode: job.errorCode, licenseId: job.license?.id ?? null, deliveries: job.license?.deliveries.map((d) => ({ kind: d.kind, status: d.status, attempts: d.attempts, errorCode: d.errorCode })) ?? [] };
}

export async function listLicenses(db: Database, secret: string, ownerId: string) {
  const licenses = await db.license.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' }, take: 100 });
  return licenses.map((l) => ({ id: l.id, key: decryptKey(l.keyCiphertext, secret), expiresAt: l.expiresAt, revokedAt: l.revokedAt }));
}

export const revokeLicense = (db: Database, id: string) => db.license.update({ where: { id }, data: { revokedAt: new Date() } });

// Proxies to license-service; any upstream problem is reported as 503, never as a verdict.
export async function verifyKey(verifyUrl: string, body: z.infer<typeof verifySchema>) {
  try {
    const response = await fetch(`${verifyUrl}/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(3000) });
    const result = await response.json() as { status?: string };
    if (!response.ok || !['VALID', 'INVALID', 'EXPIRED', 'REVOKED'].includes(result.status ?? '')) throw new Error('INVALID_UPSTREAM');
    return { status: result.status };
  } catch { throw new ServiceError(503, 'Weryfikacja jest chwilowo niedostępna.'); }
}
