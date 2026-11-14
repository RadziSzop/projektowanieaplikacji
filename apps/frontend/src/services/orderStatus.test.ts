import { describe, expect, it } from 'vitest';
import type { OrderJob } from '../types';
import { orderProgress } from './orderStatus';

function job(
  status: OrderJob['status'],
  email?: OrderJob['deliveries'][number]['status'],
): OrderJob {
  return {
    jobId: crypto.randomUUID(),
    status,
    errorCode: null,
    deliveries: email ? [{ kind: 'EMAIL', status: email, errorCode: null }] : [],
  };
}

describe('orderProgress', () => {
  it('liczy wygenerowane klucze i wysłane e-maile', () => {
    const progress = orderProgress([job('COMPLETED', 'SENT'), job('COMPLETED', 'SENT')]);
    expect(progress).toEqual({ total: 2, generated: 2, failed: 0, emailsSent: 2, pending: false });
  });

  it('oznacza zamówienie jako w trakcie, dopóki trwa generowanie lub wysyłka', () => {
    expect(orderProgress([job('PROCESSING')]).pending).toBe(true);
    expect(orderProgress([job('COMPLETED', 'PENDING')]).pending).toBe(true);
    expect(orderProgress([job('FAILED')])).toMatchObject({ failed: 1, pending: false });
  });
});
