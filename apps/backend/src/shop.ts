import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z, orderSchema, type OrderDto } from '@app/contracts';
import { decryptKey } from '@app/license-core';
import { requireUser } from './auth.js';
import { createJob } from './jobs.js';
import type { ApiEnv, ApiOptions } from './types.js';

export function registerShop(app: Hono<ApiEnv>, options: ApiOptions) {
  const { db, secret } = options;
  app.get('/api/products', async (c) => c.json(await db.product.findMany({ where: { active: true, configVersion: { config: { enabled: true } } }, orderBy: { id: 'asc' }, select: { id: true, name: true, description: true, price: true, features: true } })));
  async function readOrder(id: number, userId: string, admin: boolean): Promise<{ dto: OrderDto; done: boolean; jobs: object[] } | null> {
    const order = await db.order.findFirst({ where: { id, ...(admin ? {} : { userId }) }, include: { items: { orderBy: { id: 'asc' }, include: { jobs: { orderBy: { unitIndex: 'asc' }, include: { license: { include: { deliveries: true } } } } } } } });
    if (!order) return null;
    const jobs = order.items.flatMap((i) => i.jobs);
    return {
      dto: { id: order.id, total: order.total, items: order.items.map((i) => ({ name: i.name, keys: i.jobs.flatMap((j) => j.license ? [decryptKey(j.license.keyCiphertext, secret)] : []) })) },
      done: jobs.every((j) => j.status === 'COMPLETED' || j.status === 'FAILED'),
      jobs: jobs.map((j) => ({ jobId: j.id, status: j.status, errorCode: j.errorCode, deliveries: j.license?.deliveries.map((d) => ({ kind: d.kind, status: d.status, errorCode: d.errorCode })) ?? [] })),
    };
  }
  app.post('/api/orders', async (c) => {
    const user = requireUser(c);
    const { items, ...billing } = orderSchema.parse(await c.req.json());
    const accepted = await db.$transaction(async (tx): Promise<OrderDto> => {
      const products = await tx.product.findMany({ where: { id: { in: items.map((i) => i.id) }, active: true, configVersion: { config: { enabled: true } } } });
      if (products.length !== items.length) throw new HTTPException(400, { message: 'Produkt jest niedostępny.' });
      const total = items.reduce((sum, item) => sum + products.find((p) => p.id === item.id)!.price * item.quantity, 0);
      if (!Number.isSafeInteger(total) || total > 2147483647) throw new HTTPException(400, { message: 'Wartość zamówienia jest zbyt duża.' });
      const order = await tx.order.create({ data: { userId: user.id, ...billing, total } });
      for (const line of items) {
        const product = products.find((p) => p.id === line.id)!;
        const item = await tx.orderItem.create({ data: { orderId: order.id, productId: product.id, name: product.name, price: product.price, quantity: line.quantity, configVersionId: product.configVersionId } });
        for (let unitIndex = 0; unitIndex < line.quantity; unitIndex++) await createJob(tx, { requestedById: user.id, ownerId: user.id, recipientEmail: billing.email, configVersionId: product.configVersionId, orderItemId: item.id, unitIndex });
      }
      return { id: order.id, total: order.total, items: items.map((line) => ({ name: products.find((p) => p.id === line.id)!.name, keys: [] })) };
    }, { timeout: 15000 });
    let result = accepted;
    const waitMs = Math.max(0, Math.min(20_000, options.orderWaitMs ?? 20_000));
    if (waitMs > 0) {
      const deadline = Date.now() + waitMs;
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(() => { stopped = true; resolve(); }, waitMs);
      });
      const poll = (async () => {
        try {
          while (!stopped && Date.now() < deadline) {
            const current = await readOrder(accepted.id, user.id, false);
            if (stopped || !current || Date.now() >= deadline) return;
            result = current.dto;
            if (current.done) return;
            await new Promise((resolve) => setTimeout(resolve, Math.min(100, Math.max(1, deadline - Date.now()))));
          }
        } catch {
          // The order is already committed; optional result reads cannot turn acceptance into a failure.
          if (!stopped) console.error(JSON.stringify({ code: 'ORDER_STATUS_UNAVAILABLE', orderId: accepted.id }));
        }
      })();
      try { await Promise.race([timeout, poll]); }
      finally { stopped = true; clearTimeout(timer); }
    }
    return c.json(result, 201);
  });
  app.get('/api/orders/:id', async (c) => {
    const user = requireUser(c);
    const id = z.coerce.number().int().min(1).max(2147483647).parse(c.req.param('id'));
    const result = await readOrder(id, user.id, user.role === 'ADMIN');
    if (!result) throw new HTTPException(404, { message: 'Nie znaleziono zamówienia.' });
    return c.json({ ...result.dto, jobs: result.jobs });
  });
}
