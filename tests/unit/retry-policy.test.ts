import { describe, expect, it } from 'vitest';

import { getRetryDecision } from '../../src/modules/retries';

describe('getRetryDecision', () => {
  it('retries transient failures while attempts remain', () => {
    expect(getRetryDecision({ attemptNumber: 2, maxRetries: 3 })).toEqual({
      shouldRetry: true,
      moveToDeadLetter: false,
    });
  });

  it('moves the event to the dead-letter flow once retries are exhausted', () => {
    expect(getRetryDecision({ attemptNumber: 4, maxRetries: 3 })).toEqual({
      shouldRetry: false,
      moveToDeadLetter: true,
    });
  });
});
