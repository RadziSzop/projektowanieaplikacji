import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ConfirmChannel } = require('amqplib/lib/channel_model.js');
// Simulate process loss at the external ACK boundary, after the real database transaction.
ConfirmChannel.prototype.ack = function () {
  process.exit(91);
};
await import('../../apps/backend/src/dlq.ts');
