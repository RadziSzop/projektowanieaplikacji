import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z, configSchema, createConfigSchema, jobSchema, verifySchema } from '@app/contracts';
import { decryptKey } from '@app/license-core';
import { requireAdmin, requireUser } from './auth.js';
import { createJob } from './jobs.js';
import type { ApiEnv, ApiOptions } from './types.js';

export function registerLicensing(app: Hono<ApiEnv>, options: ApiOptions) {
  const { db } = options;
  app.get('/api/configs', async (c) => { requireUser(c); return c.json(await db.config.findMany({ where: { enabled: true }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } }, take: 100 })); });
  app.post('/api/admin/configs', async (c) => {
    const user = requireAdmin(c);
    const { format, ...data } = createConfigSchema.parse(await c.req.json());
    const config = await db.config.create({ data: { ...data, createdById: user.id, versions: { create: { version: 1, ...format } } }, include: { versions: true } });
    return c.json(config, 201);
  });
  app.post('/api/admin/configs/:id/versions', async (c) => {
    requireAdmin(c);
    const id = z.uuid().parse(c.req.param('id'));
    const format = configSchema.parse(await c.req.json());
    const version = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM licensing."Config" WHERE id = ${id}::uuid FOR UPDATE`;
      await tx.config.findUniqueOrThrow({ where: { id } });
      const latest = await tx.configVersion.findFirst({ where: { configId: id }, orderBy: { version: 'desc' } });
      const created = await tx.configVersion.create({ data: { configId: id, version: (latest?.version ?? 0) + 1, ...format } });
      await tx.product.updateMany({ where: { configVersion: { configId: id } }, data: { configVersionId: created.id } });
      return created;
    });
    return c.json(version, 201);
  });
  app.post('/api/jobs', async (c) => {
    const user = requireUser(c);
    const data = jobSchema.parse(await c.req.json());
    if (data.ownerId && data.ownerId !== user.id && user.role !== 'ADMIN') throw new HTTPException(403, { message: 'Brak uprawnień.' });
    const owner = await db.user.findFirst({ where: { id: data.ownerId ?? user.id, disabledAt: null } });
    if (!owner) throw new HTTPException(404, { message: 'Nie znaleziono użytkownika.' });
    const job = await db.$transaction(async (tx) => {
      const config = await tx.configVersion.findFirst({ where: { id: data.configVersionId, config: { enabled: true } } });
      if (!config) throw new HTTPException(404, { message: 'Konfiguracja jest niedostępna.' });
      return createJob(tx, { ownerId: owner.id, requestedById: user.id, recipientEmail: data.recipientEmail ?? owner.email, configVersionId: config.id });
    });
    return c.json(job, 202);
  });
  app.get('/api/jobs/:id', async (c) => {
    const user = requireUser(c);
    const id = z.uuid().parse(c.req.param('id'));
    const job = await db.generationJob.findFirst({ where: { id, ...(user.role === 'ADMIN' ? {} : { ownerId: user.id }) }, include: { license: { include: { deliveries: true } } } });
    if (!job) throw new HTTPException(404, { message: 'Nie znaleziono zadania.' });
    return c.json({ jobId: job.id, status: job.status, attempts: job.attempts, errorCode: job.errorCode, licenseId: job.license?.id ?? null, deliveries: job.license?.deliveries.map((d) => ({ kind: d.kind, status: d.status, attempts: d.attempts, errorCode: d.errorCode })) ?? [] });
  });
  app.get('/api/licenses', async (c) => {
    const user = requireUser(c);
    const licenses = await db.license.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return c.json(licenses.map((l) => ({ id: l.id, key: decryptKey(l.keyCiphertext, options.secret), expiresAt: l.expiresAt, revokedAt: l.revokedAt })));
  });
  app.post('/api/admin/licenses/:id/revoke', async (c) => {
    requireAdmin(c);
    const id = z.uuid().parse(c.req.param('id'));
    await db.license.update({ where: { id }, data: { revokedAt: new Date() } });
    return c.json({ message: 'Licencja unieważniona.' });
  });
  app.post('/api/licenses/verify', async (c) => {
    const body = verifySchema.parse(await c.req.json());
    try {
      const response = await fetch(`${options.verifyUrl}/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(3000) });
      const result = await response.json() as { status?: string };
      if (!response.ok || !['VALID', 'INVALID', 'EXPIRED', 'REVOKED'].includes(result.status ?? '')) throw new Error('INVALID_UPSTREAM');
      return c.json({ status: result.status });
    } catch { throw new HTTPException(503, { message: 'Weryfikacja jest chwilowo niedostępna.' }); }
  });
}
