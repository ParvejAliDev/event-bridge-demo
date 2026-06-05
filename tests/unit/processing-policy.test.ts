import { describe, expect, it } from 'vitest';

import { determineProcessingOutcome } from '../../src/modules/processing/policy';

describe('determineProcessingOutcome', () => {
  it('processes immediately when no simulated failures are requested', () => {
    expect(
      determineProcessingOutcome({
        attemptNumber: 1,
        event: {
          eventId: 'evt_1',
          orderId: 'ord_1',
          type: 'order.created',
          occurredAt: '2026-06-05T00:00:00.000Z',
          payload: {},
        },
        maxRetries: 3,
      }),
    ).toMatchObject({ status: 'processed' });
  });

  it('retries until the simulated failure budget is cleared', () => {
    expect(
      determineProcessingOutcome({
        attemptNumber: 1,
        event: {
          eventId: 'evt_1',
          orderId: 'ord_1',
          type: 'order.created',
          occurredAt: '2026-06-05T00:00:00.000Z',
          payload: { failuresBeforeSuccess: 2 },
        },
        maxRetries: 3,
      }),
    ).toMatchObject({ status: 'retry' });
  });

  it('dead-letters after the retry budget is exhausted', () => {
    expect(
      determineProcessingOutcome({
        attemptNumber: 4,
        event: {
          eventId: 'evt_1',
          orderId: 'ord_1',
          type: 'order.created',
          occurredAt: '2026-06-05T00:00:00.000Z',
          payload: { failuresBeforeSuccess: 5 },
        },
        maxRetries: 3,
      }),
    ).toMatchObject({ status: 'dead_letter' });
  });
});
