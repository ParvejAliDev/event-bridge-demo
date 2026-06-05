export function getRetryDecision(input: {
  attemptNumber: number;
  maxRetries: number;
}): {
  shouldRetry: boolean;
  moveToDeadLetter: boolean;
} {
  return {
    shouldRetry: input.attemptNumber <= input.maxRetries,
    moveToDeadLetter: input.attemptNumber > input.maxRetries,
  };
}
