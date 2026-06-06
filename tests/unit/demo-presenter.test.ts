import { describe, expect, it } from 'vitest';

import { buildDemoTimeline } from '../../src/modules/demo/presenter';

describe('buildDemoTimeline', () => {
  it('renders retries before the final processed outcome', () => {
    const timeline = buildDemoTimeline({
      attempts: [
        {
          attemptNumber: 2,
          createdAt: '2026-06-06T00:00:01.000Z',
          errorMessage: 'Simulated transient failure 2/2',
          status: 'retry',
        },
        {
          attemptNumber: 3,
          createdAt: '2026-06-06T00:00:02.000Z',
          errorMessage: null,
          status: 'processed',
        },
        {
          attemptNumber: 1,
          createdAt: '2026-06-06T00:00:00.000Z',
          errorMessage: 'Simulated transient failure 1/2',
          status: 'retry',
        },
      ],
      deadLetterReason: null,
      duplicate: false,
      replayed: false,
      transport: 'kafka',
    });

    expect(timeline.map((step) => step.label)).toEqual([
      'Request accepted',
      'Published to Kafka',
      'Consumer received event',
      'Retry attempt 1',
      'Retry attempt 2',
      'Processed successfully',
    ]);
  });

  it('marks dead-letter and duplicate outcomes explicitly', () => {
    expect(
      buildDemoTimeline({
        attempts: [
          {
            attemptNumber: 4,
            createdAt: '2026-06-06T00:00:02.000Z',
            errorMessage: 'Retry budget exhausted after 4 attempts',
            status: 'dead_letter',
          },
        ],
        deadLetterReason: 'Retry budget exhausted after 4 attempts',
        duplicate: false,
        replayed: false,
        transport: 'kafka',
      }).at(-1),
    ).toMatchObject({
      label: 'Moved to dead-letter queue',
      tone: 'danger',
    });

    expect(
      buildDemoTimeline({
        attempts: [],
        deadLetterReason: null,
        duplicate: true,
        replayed: false,
        transport: 'direct',
      }).at(-1),
    ).toMatchObject({
      label: 'Duplicate blocked',
      tone: 'neutral',
    });
  });
});
