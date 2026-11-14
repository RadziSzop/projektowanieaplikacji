import { Hono } from 'hono';
import { z, configSchema, createConfigSchema, jobSchema, verifySchema } from '@app/contracts';
import { addConfigVersion, createConfig, getJob, listConfigs, listLicenses, requestJob, revokeLicense, verifyKey } from '../services/licensing.js';
import { requireAdmin, requireUser } from './auth.js';
import type { ApiEnv, ApiOptions } from '../types.js';

export function registerLicensing(app: Hono<ApiEnv>, options: ApiOptions) {
  const { db, secret } = options;
  app.get('/api/configs', async (c) => { requireUser(c); return c.json(await listConfigs(db)); });
  app.post('/api/admin/configs', async (c) => {
    const user = requireAdmin(c);
    return c.json(await createConfig(db, user.id, createConfigSchema.parse(await c.req.json())), 201);
  });
  app.post('/api/admin/configs/:id/versions', async (c) => {
    requireAdmin(c);
    const id = z.uuid().parse(c.req.param('id'));
    return c.json(await addConfigVersion(db, id, configSchema.parse(await c.req.json())), 201);
  });
  app.post('/api/jobs', async (c) => {
    const user = requireUser(c);
    return c.json(await requestJob(db, user, jobSchema.parse(await c.req.json())), 202);
  });
  app.get('/api/jobs/:id', async (c) => c.json(await getJob(db, requireUser(c), z.uuid().parse(c.req.param('id')))));
  app.get('/api/licenses', async (c) => c.json(await listLicenses(db, secret, requireUser(c).id)));
  app.post('/api/admin/licenses/:id/revoke', async (c) => {
    requireAdmin(c);
    await revokeLicense(db, z.uuid().parse(c.req.param('id')));
    return c.json({ message: 'Licencja unieważniona.' });
  });
  app.post('/api/licenses/verify', async (c) => c.json(await verifyKey(options.verifyUrl, verifySchema.parse(await c.req.json()))));
}
