import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../apps/frontend/src/api.js';

test('web verification posts the key in the body, forwards cancellation and returns each status', async (t) => {
  const signal = AbortSignal.timeout(6000);
  let status = 'VALID';
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, '/api/licenses/verify');
    assert.equal(options.method, 'POST');
    assert.equal(options.body, JSON.stringify({ key: 'NOVA-TEST' }));
    assert.equal(options.signal, signal);
    return Response.json({ status });
  });
  for (status of ['VALID', 'INVALID', 'EXPIRED', 'REVOKED']) {
    assert.deepEqual(await api('licenses/verify', { key: 'NOVA-TEST' }, signal), { status });
  }
});

test('web verification rejects service errors instead of returning an invalid license', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: 'Verification unavailable' }, { status: 503 }),
  );
  await assert.rejects(api('licenses/verify', { key: 'NOVA-TEST' }), /Verification unavailable/);
});
