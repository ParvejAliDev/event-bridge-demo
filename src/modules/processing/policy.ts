import type { OrderEvent } from '../contracts/order-event.schema';
import { getRetryDecision } from '../retries';

export type ProcessingOutcome =
  | { status: 'processed' }
  | { status: 'retry'; reason: string }
  | { status: 'dead_letter'; reason: string };

export function determineProcessingOutcome(input: {
  event: OrderEvent;
  attemptNumber: number;
  maxRetries: number;
}): ProcessingOutcome {
  const failuresBeforeSuccess = Number(
    input.event.payload.failuresBeforeSuccess ?? 0,
  );

  if (!Number.isFinite(failuresBeforeSuccess) || failuresBeforeSuccess <= 0) {
    return { status: 'processed' };
  }

  if (input.attemptNumber <= failuresBeforeSuccess) {
    const retryDecision = getRetryDecision({
      attemptNumber: input.attemptNumber,
      maxRetries: input.maxRetries,
    });

    if (retryDecision.shouldRetry) {
      return {
        status: 'retry',
        reason: `Simulated transient failure ${input.attemptNumber}/${failuresBeforeSuccess}`,
      };
    }

    return {
      status: 'dead_letter',
      reason: `Retry budget exhausted after ${input.attemptNumber} attempts`,
    };
  }

  return { status: 'processed' };
}
