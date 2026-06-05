import { describe, expect, it } from 'vitest';

import { createEventIdempotencyKey } from '../../src/modules/idempotency';

describe('createEventIdempotencyKey', () => {
  it('creates a stable dedupe key from the event envelope', () => {
    expect(
      createEventIdempotencyKey({
        eventId: 'evt_1',
        orderId: 'ord_1',
        type: 'order.created',
      }),
    ).toBe('evt_1:ord_1:order.created');
  });
});
