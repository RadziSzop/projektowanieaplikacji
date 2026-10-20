import '../helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '@app/database';

test('migrations install all business schemas and enforce license uniqueness', async () => {
  const db = createDatabase();
  try {
    const rows = await db.$queryRaw<
      Array<{ name: string | null }>
    >`SELECT to_regclass('auth."User"')::text AS name UNION ALL SELECT to_regclass('licensing."License"')::text UNION ALL SELECT to_regclass('messaging."Outbox"')::text`;
    assert.equal(rows.filter((r) => r.name !== null).length, 3);
    const indexes = await db.$queryRaw<
      Array<{ indexdef: string }>
    >`SELECT indexdef FROM pg_indexes WHERE schemaname = 'licensing' AND tablename = 'License'`;
    assert.ok(
      indexes.some((r) => r.indexdef.includes('UNIQUE') && r.indexdef.includes('generationJobId')),
    );
    assert.ok(indexes.some((r) => r.indexdef.includes('UNIQUE') && r.indexdef.includes('keyHash')));
  } finally {
    await db.$disconnect();
  }
});
