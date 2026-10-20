import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

test('format validation rejects ambiguous or insecure configurations and forged cart prices', async () => {
  const m = await import('../packages/contracts/src/index.js').catch(() => null);
  assert.ok(m, 'Shared boundary schemas must exist');
  assert.equal(m.configSchema.safeParse({ alphabet: 'AAA' }).success, false);
  assert.equal(m.configSchema.safeParse({ segmentCount: 1, segmentLength: 1 }).success, false);
  assert.equal(
    m.orderSchema.safeParse({
      name: 'Jan',
      email: 'a@b.pl',
      address: 'X',
      postcode: '00-001',
      city: 'Warszawa',
      items: [{ id: 1, quantity: 1 }],
      total: 1,
    }).success,
    false,
  );
  assert.equal(
    m.cartSchema.safeParse([
      { id: 1, quantity: 1 },
      { id: 1, quantity: 2 },
    ]).success,
    false,
  );
  assert.equal(m.cartSchema.safeParse([{ id: 1, quantity: 11 }]).success, false);
});

test('generated keys obey immutable format and checksum rejects changed characters', async () => {
  const contracts = await import('../packages/contracts/src/index.js').catch(() => null);
  const core = await import('../packages/license-core/src/index.js').catch(() => null);
  assert.ok(core && contracts, 'Key generation must exist');
  const format = contracts.configSchema.parse({});
  const key = core.generateKey(format);
  assert.match(key, /^NOVA(?:-[A-HJ-NP-Z2-9]{5}){4}-[A-F0-9]{8}$/);
  assert.equal(core.matchesFormat(key, format), true);
  assert.equal(
    core.matchesFormat(key.slice(0, -1) + (key.endsWith('A') ? 'B' : 'A'), format),
    false,
  );
  assert.equal(core.keyHash(`  ${key.toLowerCase()}  `), core.keyHash(key));
  assert.notEqual(core.generateKey(format), key);
  assert.equal(core.licenseState({ revokedAt: null, expiresAt: new Date(0) }), 'EXPIRED');
  assert.equal(core.licenseState({ revokedAt: new Date(), expiresAt: null }), 'REVOKED');
});

test('encryption authenticates the ciphertext and password checks reject the wrong secret', async () => {
  const core = await import('../packages/license-core/src/index.js').catch(() => null);
  const security = await import('../packages/database/src/password.js').catch(() => null);
  assert.ok(core && security, 'Encryption and password protection must exist');
  const secret = randomBytes(32).toString('base64');
  const encrypted = core.encryptKey('NOVA-TEST', secret);
  assert.equal(core.decryptKey(encrypted, secret), 'NOVA-TEST');
  const tampered = Buffer.from(encrypted);
  tampered[15] ^= 1;
  assert.throws(() => core.decryptKey(tampered, secret));
  assert.throws(() => core.encryptKey('key', 'bad'));
  const hash = await security.hashPassword('correct password');
  assert.equal(await security.verifyPassword('correct password', hash), true);
  assert.equal(await security.verifyPassword('wrong password', hash), false);
  assert.notEqual(await security.hashPassword('correct password'), hash);
});
