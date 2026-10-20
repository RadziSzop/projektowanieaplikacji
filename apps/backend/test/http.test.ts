import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

test('HTTP health and unknown routes return the API JSON contract', async () => {
    const app = createApp();
    const health = await app.request('/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const missing = await app.request('/api/missing');
    assert.equal(missing.status, 404);
    assert.equal(typeof ((await missing.json()) as { error: string }).error, 'string');
});
