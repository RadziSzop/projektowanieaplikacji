import '../helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '@app/database';
import { createApi } from '../../apps/backend/src/api.js';
import { generateLicense, verifyLicense } from '../../apps/license-service/src/service.js';
import { newMessage } from '@app/messaging';
import { decryptKey } from '@app/license-core';

test('administration creates immutable versions and existing keys survive new product formats', async () => {
  const db = createDatabase();
  const secret = process.env.KEY_ENCRYPTION_KEY!;
  const app = createApi({
    db,
    secret,
    origins: ['http://localhost:8080'],
    verifyUrl: 'http://127.0.0.1:1',
  });
  let cookie = '';
  const post = (path: string, body: object) =>
    app.request(`/api/${path}`, {
      method: 'POST',
      headers: { origin: 'http://localhost:8080', 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    });
  try {
    const login = await post('login', {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get('set-cookie')!.split(';')[0];
    const configResponse = await post('admin/configs', {
      name: `Versioned ${randomUUID()}`,
      format: { prefix: 'OLD' },
    });
    assert.equal(configResponse.status, 201);
    const config = (await configResponse.json()) as { id: string; versions: { id: string }[] };
    const product = await db.product.create({
      data: {
        name: `Versioned-${randomUUID()}`,
        description: 'Test',
        price: 1234,
        features: [],
        configVersionId: config.versions[0].id,
      },
    });
    async function issue(versionId: string) {
      const response = await post('jobs', { configVersionId: versionId });
      assert.equal(response.status, 202);
      const result = (await response.json()) as { jobId: string };
      await generateLicense(db, secret, newMessage('license.generation.requested', result.jobId));
      return db.license.findUniqueOrThrow({ where: { generationJobId: result.jobId } });
    }
    const old = await issue(config.versions[0].id);
    const oldKey = decryptKey(old.keyCiphertext, secret);
    const next = await post(`admin/configs/${config.id}/versions`, {
      prefix: 'NEW',
      checksum: false,
      validityDays: null,
    });
    assert.equal(next.status, 201);
    const version = (await next.json()) as { id: string; version: number };
    assert.equal(version.version, 2);
    assert.equal(
      (await db.product.findUniqueOrThrow({ where: { id: product.id } })).configVersionId,
      version.id,
    );
    assert.equal(await verifyLicense(db, oldKey), 'VALID');
    const current = await issue(version.id);
    assert.equal(current.expiresAt, null);
    const newKey = decryptKey(current.keyCiphertext, secret);
    assert.equal(newKey.split('-').length, 5);
    assert.ok(newKey.startsWith('NEW-'));
    assert.equal(await verifyLicense(db, newKey), 'VALID');
    const versions = await Promise.all([
      post(`admin/configs/${config.id}/versions`, {}),
      post(`admin/configs/${config.id}/versions`, {}),
    ]);
    assert.deepEqual(
      (await Promise.all(versions.map((r) => r.json() as Promise<{ version: number }>)))
        .map((v) => v.version)
        .sort(),
      [3, 4],
    );
  } finally {
    await db.$disconnect();
  }
});
