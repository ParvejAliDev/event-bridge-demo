import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('demo client markup helpers', () => {
  it('renders a dead-letter scenario with replay available and collapsed detail panels', async () => {
    const demoClient = await import(
      resolve(process.cwd(), 'src/public/demo.js')
    );

    const outcome = demoClient.normalizeOutcome(
      'dead_letter_then_replay',
      {
        attempts: 4,
        deadLetterRecord: {
          createdAt: '2026-06-06T00:00:03.000Z',
          eventId: 'evt_dead',
          payload: {
            eventId: 'evt_dead',
            occurredAt: '2026-06-06T00:00:00.000Z',
            orderId: 'ord_dead',
            payload: { failuresBeforeSuccess: 4 },
            type: 'order.cancelled',
          },
          reason: 'Retry budget exhausted after 4 attempts',
        },
        event: {
          eventId: 'evt_dead',
          occurredAt: '2026-06-06T00:00:00.000Z',
          orderId: 'ord_dead',
          payload: { failuresBeforeSuccess: 4 },
          type: 'order.cancelled',
        },
        finalStatus: 'dead_letter',
        replayAvailable: true,
        timeline: [
          {
            detail: 'The demo endpoint accepted the event payload.',
            key: 'accepted',
            label: 'Request accepted',
            tone: 'accent',
          },
          {
            detail: 'Retry budget exhausted after 4 attempts',
            key: 'dead-letter-4',
            label: 'Moved to dead-letter queue',
            tone: 'danger',
          },
        ],
      },
      'scenario',
      null,
    );

    const markup = demoClient.createOutcomeMarkup(outcome);

    expect(markup).toContain('Held in the dead-letter queue for review');
    expect(markup).toContain('Replay from dead-letter queue');
    expect(markup).not.toContain('Send duplicate event');
    expect(markup).toContain('Moved to dead-letter queue');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain(
      'id="result-event-details" class="detail-panel" hidden',
    );
    expect(markup).toContain(
      'id="result-response-details" class="detail-panel" hidden',
    );
  });

  it('renders a processed scenario with duplicate available and overview details collapsed by default', async () => {
    const demoClient = await import(
      resolve(process.cwd(), 'src/public/demo.js')
    );

    const outcome = demoClient.normalizeOutcome(
      'happy_path',
      {
        attempts: 1,
        event: {
          eventId: 'evt_processed',
          occurredAt: '2026-06-06T00:00:00.000Z',
          orderId: 'ord_processed',
          payload: {},
          type: 'order.created',
        },
        finalStatus: 'processed',
        duplicateAvailable: true,
        replayAvailable: false,
        timeline: [
          {
            detail: 'The event completed on attempt 1.',
            key: 'processed-1',
            label: 'Processed successfully',
            tone: 'success',
          },
        ],
      },
      'scenario',
      null,
    );

    const outcomeMarkup = demoClient.createOutcomeMarkup(outcome);
    const overviewMarkup = demoClient.createOverviewMarkup({
      health: { status: 'ok' },
      metrics: {
        deadLetterQueue: 0,
        deadLettered: 0,
        processed: 4,
        retrying: 0,
      },
      readiness: { status: 'ready' },
      recentDeadLetters: [],
    });

    expect(outcomeMarkup).toContain('Delivered cleanly through the bridge');
    expect(outcomeMarkup).toContain('Send duplicate event');
    expect(outcomeMarkup).not.toContain('Replay from dead-letter queue');
    expect(outcomeMarkup).toContain('Processed successfully');
    expect(overviewMarkup).toContain('Show technical details');
    expect(overviewMarkup).toContain('aria-expanded="false"');
    expect(overviewMarkup).toContain(
      'id="overview-details" class="detail-panel" hidden',
    );
  });
});
