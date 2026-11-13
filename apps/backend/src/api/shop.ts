import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z, orderSchema } from '@app/contracts';
import { listProducts, placeOrder, readOrder, waitForOrder } from '../services/orders.js';
import { requireUser } from './auth.js';
import type { ApiEnv, ApiOptions } from '../types.js';

export function registerShop(app: Hono<ApiEnv>, options: ApiOptions) {
  const { db, secret } = options;
  app.get('/api/products', async (c) => c.json(await listProducts(db)));
  app.post('/api/orders', async (c) => {
    const user = requireUser(c);
    const accepted = await placeOrder(db, user.id, orderSchema.parse(await c.req.json()));
    const waitMs = Math.max(0, Math.min(20_000, options.orderWaitMs ?? 20_000));
    return c.json(await waitForOrder(db, secret, accepted, user.id, waitMs), 201);
  });
  app.get('/api/orders/:id', async (c) => {
    const user = requireUser(c);
    const id = z.coerce.number().int().min(1).max(2147483647).parse(c.req.param('id'));
    const result = await readOrder(db, secret, id, user.id, user.role === 'ADMIN');
    if (!result) throw new HTTPException(404, { message: 'Nie znaleziono zamówienia.' });
    return c.json({ ...result.dto, jobs: result.jobs });
  });
}
