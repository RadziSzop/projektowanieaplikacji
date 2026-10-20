import { loadEnvFile } from 'node:process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
try {
  loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const base = process.env.API_URL ?? 'http://localhost:8080';
const origin = process.env.PUBLIC_ORIGIN ?? new URL(base).origin;
async function call(path, body, cookie = '') {
  return fetch(new URL(`/api/${path}`, base), {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      origin,
      cookie,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30_000),
  });
}
async function waitFor(read, done) {
  const deadline = Date.now() + 30_000;
  while (true) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() > deadline) throw new Error('Timed out waiting for complete licensing flow');
    await new Promise((r) => setTimeout(r, 200));
  }
}
async function account() {
  const email = `smoke-${randomUUID()}@example.test`;
  assert.equal(
    (await call('register', { name: 'Smoke Test', email, password: 'smoke-test-password' })).status,
    201,
  );
  const response = await call('login', { email, password: 'smoke-test-password' });
  assert.equal(response.status, 200);
  return { email, cookie: response.headers.get('set-cookie').split(';')[0] };
}
const user = await account();
const products = await (await call('products')).json();
assert.ok(products.length >= 3);
const response = await call(
  'orders',
  {
    name: 'Smoke Test',
    email: user.email,
    address: 'Testowa 1',
    postcode: '00-001',
    city: 'Warszawa',
    items: [{ id: products[0].id, quantity: 2 }],
  },
  user.cookie,
);
assert.equal(response.status, 201);
const accepted = await response.json();
assert.equal(accepted.total, products[0].price * 2);
const order = await waitFor(
  async () => (await call(`orders/${accepted.id}`, undefined, user.cookie)).json(),
  (value) =>
    value.items[0].keys.length === 2 &&
    value.jobs.every(
      (job) =>
        job.deliveries.some((d) => d.kind === 'EMAIL' && d.status === 'SENT') &&
        job.deliveries.some((d) => d.kind === 'METRICS' && d.status === 'WRITTEN'),
    ),
);
const keys = order.items[0].keys;
assert.ok(keys[0] !== keys[1], 'Each unit must receive a distinct key');
assert.equal(order.jobs.length, 2);
assert.equal((await (await call('licenses/verify', { key: keys[0] })).json()).status, 'VALID');
const cli = spawn(process.execPath, ['scripts/verify.mjs', keys[0], base], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
cli.stdout.on('data', (data) => {
  output += data;
});
const [exitCode] = await once(cli, 'exit');
assert.equal(exitCode, 0);
assert.equal(output.trim(), 'VALID');
for (const [index, job] of order.jobs.entries()) {
  const details = await (await call(`jobs/${job.jobId}`, undefined, user.cookie)).json();
  const mailbox = await (await fetch('http://127.0.0.1:8025/api/v1/messages?limit=1000')).json();
  const mail = mailbox.messages.find(
    (item) => item.Subject === `Licencja Nova ${details.licenseId}`,
  );
  assert.ok(mail, 'Mailpit must contain the issued license');
  const message = await (await fetch(`http://127.0.0.1:8025/api/v1/message/${mail.ID}`)).json();
  assert.ok(message.Text.includes(keys[index]), 'SMTP must deliver the same key');
  assert.ok(message.HTML.includes(keys[index]), 'SMTP must include the key in the HTML email');
  assert.ok(message.HTML.includes('<html lang="pl">'), 'SMTP must deliver the HTML template');
  const metric = await fetch('http://127.0.0.1:8086/api/v2/query?org=licensing', {
    method: 'POST',
    headers: {
      authorization: `Token ${process.env.INFLUXDB_TOKEN}`,
      'content-type': 'application/vnd.flux',
      accept: 'application/csv',
    },
    body: `from(bucket:"events") |> range(start:-1h) |> filter(fn:(r)=>r._measurement=="license_generated" and r.license_id=="${details.licenseId}")`,
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(metric.status, 200);
  const csv = await metric.text();
  assert.ok(csv.includes(details.licenseId));
  assert.ok(!csv.includes(keys[index]));
}
const other = await account();
assert.equal((await call(`orders/${order.id}`, undefined, other.cookie)).status, 404);
assert.equal((await call(`jobs/${order.jobs[0].jobId}`, undefined, other.cookie)).status, 404);
const loginAdmin = await call('login', {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});
assert.equal(loginAdmin.status, 200);
const adminCookie = loginAdmin.headers.get('set-cookie').split(';')[0];
const first = await (await call(`jobs/${order.jobs[0].jobId}`, undefined, user.cookie)).json();
assert.equal((await call(`admin/licenses/${first.licenseId}/revoke`, {}, adminCookie)).status, 200);
assert.equal((await (await call('licenses/verify', { key: keys[0] })).json()).status, 'REVOKED');
await call('logout', {}, user.cookie);
await call('logout', {}, other.cookie);
await call('logout', {}, adminCookie);
assert.equal(await (await call('me', undefined, user.cookie)).json(), null);
console.log(
  'PASS: registration, sessions, checkout, 2 unique licenses, Mailpit, InfluxDB, verification CLI, ownership and revocation through Docker/Nginx.',
);
