import { HTTPException } from 'hono/http-exception';
import { z } from '@app/contracts';
import { Prisma } from '@app/database';
import { encryptionKey } from '@app/license-core';
import { createApp } from './app.js';
import { installSecurity, registerAuth } from './auth.js';
import { registerShop } from './shop.js';
import { registerLicensing } from './licensing.js';
import type { ApiEnv, ApiOptions } from './types.js';

export function createApi(options: ApiOptions) {
  encryptionKey(options.secret);
  const app = createApp<ApiEnv>();
  installSecurity(app, options);
  app.get('/api/ready', async (c) => {
    try { await options.db.$queryRaw`SELECT 1`; return c.json({ status: 'ready' }); }
    catch { return c.json({ error: 'Baza jest niedostępna.' }, 503); }
  });
  registerAuth(app, options);
  registerShop(app, options);
  registerLicensing(app, options);
  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return c.json({ error: 'Nieprawidłowe dane wejściowe.' }, 400);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return c.json({ error: 'Zasób już istnieje.' }, 409);
      if (error.code === 'P2025') return c.json({ error: 'Nie znaleziono zasobu.' }, 404);
    }
    console.error(JSON.stringify({ code: 'API_UNAVAILABLE', name: error.name }));
    return c.json({ error: 'Operacja jest chwilowo niedostępna.' }, 503);
  });
  return app;
}
