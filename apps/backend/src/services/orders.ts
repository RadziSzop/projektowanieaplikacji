import type { OrderDto, z, orderSchema } from '@app/contracts';
import type { Database } from '@app/database';
import { decryptKey } from '@app/license-core';
import { ServiceError } from './errors.js';
import { createJob } from './licensing.js';

export type OrderStatus = { dto: OrderDto; done: boolean; jobs: object[] };

export const listProducts = (db: Database) =>
  db.product.findMany({ where: { active: true, configVersion: { config: { enabled: true } } }, orderBy: { id: 'asc' }, select: { id: true, name: true, description: true, price: true, features: true } });

export async function readOrder(db: Database, secret: string, id: number, userId: string, admin: boolean): Promise<OrderStatus | null> {
  const order = await db.order.findFirst({ where: { id, ...(admin ? {} : { userId }) }, include: { items: { orderBy: { id: 'asc' }, include: { jobs: { orderBy: { unitIndex: 'asc' }, include: { license: { include: { deliveries: true } } } } } } } });
  if (!order) return null;
  const jobs = order.items.flatMap((i) => i.jobs);
  return {
    dto: { id: order.id, total: order.total, items: order.items.map((i) => ({ name: i.name, keys: i.jobs.flatMap((j) => j.license ? [decryptKey(j.license.keyCiphertext, secret)] : []) })) },
    done: jobs.every((j) => j.status === 'COMPLETED' || j.status === 'FAILED'),
    jobs: jobs.map((j) => ({ jobId: j.id, status: j.status, errorCode: j.errorCode, deliveries: j.license?.deliveries.map((d) => ({ kind: d.kind, status: d.status, errorCode: d.errorCode })) ?? [] })),
  };
}

export async function placeOrder(db: Database, userId: string, input: z.infer<typeof orderSchema>): Promise<OrderDto> {
  const { items, ...billing } = input;
  return db.$transaction(async (tx): Promise<OrderDto> => {
    const products = await tx.product.findMany({ where: { id: { in: items.map((i) => i.id) }, active: true, configVersion: { config: { enabled: true } } } });
    if (products.length !== items.length) throw new ServiceError(400, 'Produkt jest niedostępny.');
    const total = items.reduce((sum, item) => sum + products.find((p) => p.id === item.id)!.price * item.quantity, 0);
    if (!Number.isSafeInteger(total) || total > 2147483647) throw new ServiceError(400, 'Wartość zamówienia jest zbyt duża.');
    const order = await tx.order.create({ data: { userId, ...billing, total } });
    for (const line of items) {
      const product = products.find((p) => p.id === line.id)!;
      const item = await tx.orderItem.create({ data: { orderId: order.id, productId: product.id, name: product.name, price: product.price, quantity: line.quantity, configVersionId: product.configVersionId } });
      for (let unitIndex = 0; unitIndex < line.quantity; unitIndex++) await createJob(tx, { requestedById: userId, ownerId: userId, recipientEmail: billing.email, configVersionId: product.configVersionId, orderItemId: item.id, unitIndex });
    }
    return { id: order.id, total: order.total, items: items.map((line) => ({ name: products.find((p) => p.id === line.id)!.name, keys: [] })) };
  }, { timeout: 15000 });
}

// Polls a just-committed order until all jobs finish or waitMs elapses; returns the freshest snapshot.
export async function waitForOrder(db: Database, secret: string, accepted: OrderDto, userId: string, waitMs: number): Promise<OrderDto> {
  let result = accepted;
  if (waitMs <= 0) return result;
  const deadline = Date.now() + waitMs;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => { stopped = true; resolve(); }, waitMs);
  });
  const poll = (async () => {
    try {
      while (!stopped && Date.now() < deadline) {
        const current = await readOrder(db, secret, accepted.id, userId, false);
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
  return result;
}
