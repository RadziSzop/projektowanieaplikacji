// Public API of @app/messaging. Internal helpers (background, quarantine, failInTransaction) stay unexported.
export { WorkError, LeaseBusy } from './errors.js';
export { processed, markProcessed, lockEntity } from './idempotency.js';
export { newMessage, enqueue, publishOutboxBatch, startOutboxPublisher } from './outbox.js';
export { retryDelays, recordFailure, redrive } from './failure.js';
export { connectBroker, type Runner } from './broker.js';
export { startConsumer } from './consumer.js';
