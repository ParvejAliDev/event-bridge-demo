import { describe, expect, it } from 'vitest';

import { orderEventSchema } from '../../src/modules/contracts/order-event.schema';

describe('orderEventSchema', () => {
  it('rejects an event without an orderId', () => {
    expect(() =>
      orderEventSchema.parse({
        eventId: 'evt_1',
        type: 'order.created',
        occurredAt: '2026-06-04T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('accepts a valid event payload', () => {
    const result = orderEventSchema.parse({
      eventId: 'evt_1',
      orderId: 'ord_1',
      type: 'order.created',
      occurredAt: '2026-06-04T00:00:00.000Z',
      payload: { source: 'local-seed' },
    });

    expect(result.orderId).toBe('ord_1');
  });
});
