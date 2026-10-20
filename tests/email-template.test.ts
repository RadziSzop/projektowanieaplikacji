import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLicenseEmail } from '../apps/notification-worker/src/email-template.js';

test('license email includes HTML and plain text and escapes configurable key characters', () => {
  const key = 'NOVA-<A&B>"\'';
  const message = renderLicenseEmail(key, 'license-123');
  assert.ok(message.text.includes(key));
  assert.ok(message.text.includes('license-123'));
  assert.match(message.html, /<html lang="pl">/);
  assert.ok(message.html.includes('NOVA-&lt;A&amp;B&gt;&quot;&#39;'));
  assert.ok(!message.html.includes(key));
  assert.ok(message.html.includes('license-123'));
});
