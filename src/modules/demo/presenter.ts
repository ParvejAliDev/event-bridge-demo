export type DemoAttempt = {
  attemptNumber: number;
  createdAt: string;
  errorMessage: string | null;
  status: 'processed' | 'retry' | 'dead_letter';
};

export type DemoTimelineStep = {
  key: string;
  label: string;
  detail: string;
  tone: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
};

export function buildDemoTimeline(input: {
  attempts: DemoAttempt[];
  deadLetterReason: string | null;
  duplicate: boolean;
  replayed: boolean;
  transport: 'direct' | 'kafka';
}): DemoTimelineStep[] {
  const steps: DemoTimelineStep[] = [
    {
      key: 'accepted',
      label: 'Request accepted',
      detail: 'The demo endpoint accepted the event payload.',
      tone: 'accent',
    },
  ];

  if (input.transport === 'kafka') {
    steps.push({
      key: 'published',
      label: 'Published to Kafka',
      detail: 'The event was written to the configured topic.',
      tone: 'accent',
    });
    steps.push({
      key: 'consumed',
      label: 'Consumer received event',
      detail: 'The background consumer picked up the message for processing.',
      tone: 'accent',
    });
  }

  if (input.duplicate) {
    return steps.concat({
      key: 'duplicate',
      label: 'Duplicate blocked',
      detail: 'Idempotency stopped the event from being processed twice.',
      tone: 'neutral',
    });
  }

  const orderedAttempts = [...input.attempts].sort(
    (left, right) => left.attemptNumber - right.attemptNumber,
  );

  for (const attempt of orderedAttempts) {
    if (attempt.status === 'retry') {
      steps.push({
        key: `retry-${attempt.attemptNumber}`,
        label: `Retry attempt ${attempt.attemptNumber}`,
        detail: attempt.errorMessage ?? 'Retry scheduled',
        tone: 'warning',
      });
      continue;
    }

    if (attempt.status === 'processed') {
      steps.push({
        key: `processed-${attempt.attemptNumber}`,
        label: input.replayed
          ? 'Replayed successfully'
          : 'Processed successfully',
        detail: `The event completed on attempt ${attempt.attemptNumber}.`,
        tone: 'success',
      });
      continue;
    }

    steps.push({
      key: `dead-letter-${attempt.attemptNumber}`,
      label: 'Moved to dead-letter queue',
      detail:
        input.deadLetterReason ??
        attempt.errorMessage ??
        'Retry budget exhausted',
      tone: 'danger',
    });
  }

  return steps;
}
