import '../helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase, tokenHash, type Database } from '@app/database';

test('existing shop authentication, sessions, validation and ownership work against PostgreSQL', async () => {
  const api = await import('../../apps/backend/src/api.js').catch(() => null);
  assert.ok(api, 'Shop API must exist');
  const db = createDatabase();
  const app = api.createApi({
    db,
    secret: process.env.KEY_ENCRYPTION_KEY!,
    origins: ['http://localhost:8080'],
    verifyUrl: 'http://127.0.0.1:1',
    orderWaitMs: 0,
  });
  const email = `${randomUUID()}@example.test`;
  const post = (path: string, body: object, cookie = '', origin = 'http://localhost:8080') =>
    app.request(`/api/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin, cookie },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(await (await app.request('/api/me')).json(), null);
    assert.equal(
      (
        await post('register', {
          name: 'Test',
          email,
          password: 'long-test-password',
          role: 'ADMIN',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post(
          'register',
          { name: 'Test', email, password: 'long-test-password' },
          '',
          'https://evil.test',
        )
      ).status,
      403,
    );
    assert.equal(
      (await post('register', { name: 'Test', email, password: 'long-test-password' })).status,
      201,
    );
    assert.equal(
      (await post('register', { name: 'Test', email, password: 'long-test-password' })).status,
      409,
    );
    assert.equal((await post('login', { email, password: 'incorrect' })).status, 401);
    const login = await post('login', { email, password: 'long-test-password' });
    assert.deepEqual(await login.json(), { name: 'Test', email });
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    assert.match(login.headers.get('set-cookie')!, /HttpOnly/i);
    assert.equal((await app.request('/api/me', { headers: { cookie } })).status, 200);
    const products = (await (await app.request('/api/products')).json()) as Array<{
      id: number;
      price: number;
    }>;
    assert.ok(products.length >= 3);
    const billing = {
      name: 'Test',
      email,
      address: 'Testowa 1',
      postcode: '00-001',
      city: 'Warszawa',
    };
    assert.equal(
      (await post('orders', { ...billing, items: [{ id: products[0].id, quantity: 11 }] }, cookie))
        .status,
      400,
    );
    const orderResponse = await post(
      'orders',
      { ...billing, items: [{ id: products[0].id, quantity: 2 }] },
      cookie,
    );
    assert.equal(orderResponse.status, 201);
    const order = (await orderResponse.json()) as {
      id: number;
      total: number;
      items: Array<{ keys: string[] }>;
    };
    assert.equal(order.total, products[0].price * 2);
    assert.deepEqual(order.items[0].keys, []);
    assert.equal(await db.generationJob.count({ where: { orderItem: { orderId: order.id } } }), 2);
    assert.equal((await app.request(`/api/orders/${order.id}`)).status, 401);
    assert.equal(
      (await post('admin/configs', { name: 'Forbidden', format: {} }, cookie)).status,
      403,
    );
    assert.equal((await post('licenses/verify', { key: 'NO-SERVICE' })).status, 503);
    await post('logout', {}, cookie);
    assert.equal(await (await app.request('/api/me', { headers: { cookie } })).json(), null);
    const nextLogin = await post('login', { email, password: 'long-test-password' });
    const expiredCookie = nextLogin.headers.get('set-cookie')!.split(';')[0];
    await db.session.update({
      where: { tokenHash: tokenHash(expiredCookie.slice('session='.length)) },
      data: { expiresAt: new Date(0) },
    });
    assert.equal(
      await (await app.request('/api/me', { headers: { cookie: expiredCookie } })).json(),
      null,
    );
    assert.equal(
      (
        await post(
          'orders',
          { ...billing, items: [{ id: products[0].id, quantity: 1 }] },
          expiredCookie,
        )
      ).status,
      401,
    );
  } finally {
    await db.$disconnect();
  }
});

test('a committed order still returns 201 when the optional result read fails or exceeds the deadline', async (t) => {
  const { createApi } = await import('../../apps/backend/src/api.js');
  const db = createDatabase();
  const options = {
    db,
    secret: process.env.KEY_ENCRYPTION_KEY!,
    origins: ['http://localhost:8080'],
    verifyUrl: 'http://127.0.0.1:1',
    orderWaitMs: 20,
  };
  const normal = createApi(options);
  const login = await normal.request('/api/login', {
    method: 'POST',
    headers: { origin: 'http://localhost:8080', 'content-type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  try {
    const product = await db.product.findFirstOrThrow({ where: { active: true } });
    for (const mode of ['error', 'slow'] as const) {
      await t.test(mode, async () => {
        const instrumented = db.$extends({
          query: {
            order: {
              async findFirst({ args, query }) {
                if (mode === 'error') throw new Error('Simulated post-commit database outage');
                await new Promise((resolve) => setTimeout(resolve, 800));
                return query(args);
              },
            },
          },
        });
        const app = createApi({ ...options, db: instrumented as unknown as Database });
        const started = Date.now();
        const response = await app.request('/api/orders', {
          method: 'POST',
          headers: { origin: 'http://localhost:8080', 'content-type': 'application/json', cookie },
          body: JSON.stringify({
            name: 'Accepted order',
            email: 'accepted@example.test',
            address: 'Testowa 1',
            postcode: '00-001',
            city: 'Warszawa',
            items: [{ id: product.id, quantity: 1 }],
          }),
        });
        assert.equal(response.status, 201, 'A persisted order must not be reported as rejected');
        assert.ok(
          Date.now() - started < 500,
          'Optional database reads must not extend the generation wait budget',
        );
        const order = (await response.json()) as {
          id: number;
          total: number;
          items: { name: string; keys: string[] }[];
        };
        assert.deepEqual(order.items, [{ name: product.name, keys: [] }]);
        assert.equal(order.total, product.price);
        assert.equal(
          await db.generationJob.count({ where: { orderItem: { orderId: order.id } } }),
          1,
        );
      });
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 850));
    await db.$disconnect();
  }
});
