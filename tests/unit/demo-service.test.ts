import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  acceptMock,
  countProcessingMetricsMock,
  delMock,
  ensureRedisConnectionMock,
  findDeadLetterEventMock,
  findProcessedEventMock,
  listDeadLetterEventsMock,
  listEventAttemptsMock,
  removeDeadLetterEventMock,
  replayDeadLetterEventMock,
} = vi.hoisted(() => {
  const pingMock = vi.fn(async () => 'PONG');
  const delMock = vi.fn(async () => 1);

  return {
    acceptMock: vi.fn(),
    countProcessingMetricsMock: vi.fn(),
    delMock,
    ensureRedisConnectionMock: vi.fn(async () => ({
      ping: pingMock,
      del: delMock,
    })),
    findDeadLetterEventMock: vi.fn(),
    findProcessedEventMock: vi.fn(),
    listDeadLetterEventsMock: vi.fn(),
    listEventAttemptsMock: vi.fn(),
    removeDeadLetterEventMock: vi.fn(),
    replayDeadLetterEventMock: vi.fn(),
  };
});

vi.mock('../../src/lib/db', () => ({
  getSql: vi.fn(() => vi.fn(async () => [{ '?column?': 1 }])),
}));

vi.mock('../../src/lib/redis', () => ({
  ensureRedisConnection: ensureRedisConnectionMock,
}));

vi.mock('../../src/modules/processing/repository', () => ({
  countProcessingMetrics: countProcessingMetricsMock,
  findDeadLetterEvent: findDeadLetterEventMock,
  findProcessedEvent: findProcessedEventMock,
  listDeadLetterEvents: listDeadLetterEventsMock,
  listEventAttempts: listEventAttemptsMock,
  removeDeadLetterEvent: removeDeadLetterEventMock,
}));

import { DemoService } from '../../src/modules/demo/demo.service';

describe('DemoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.KAFKA_CLIENT_ID = 'event-bridge-demo';
    process.env.KAFKA_BROKERS = 'localhost:9092';
    process.env.KAFKA_TOPIC = 'order-events';
    process.env.KAFKA_CONSUMER_GROUP = 'order-events-local';
    process.env.PROCESSING_MAX_RETRIES = '3';
    process.env.IDEMPOTENCY_TTL_SECONDS = '300';
  });

  it('builds an overview with dependency status, metrics, and recent dead-letter items', async () => {
    countProcessingMetricsMock.mockResolvedValue({
      deadLetterQueue: 1,
      deadLettered: 1,
      processed: 4,
      retrying: 0,
    });
    listDeadLetterEventsMock.mockResolvedValue([
      {
        createdAt: '2026-06-06T00:00:00.000Z',
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
    ]);

    const service = new DemoService({
      accept: acceptMock,
      replayDeadLetterEvent: replayDeadLetterEventMock,
    } as never);

    const overview = await service.getOverview();

    expect(overview.health.status).toBe('ok');
    expect(overview.metrics.processed).toBe(4);
    expect(overview.recentDeadLetters).toHaveLength(1);
  });

  it('uses the kafka path, polls through retrying state, and returns only after a settled processed result', async () => {
    acceptMock.mockResolvedValue({
      accepted: true,
      attempts: 0,
      eventId: 'evt_retry',
      idempotencyKey: 'idempo-retry',
      status: 'published',
      transport: 'kafka',
    });
    findProcessedEventMock
      .mockResolvedValueOnce({
        attemptCount: 2,
        eventId: 'evt_retry',
        eventType: 'order.updated',
        lastError: 'Simulated transient failure 2/2',
        orderId: 'ord_retry',
        payload: { failuresBeforeSuccess: 2 },
        processedAt: '2026-06-06T00:00:01.000Z',
        status: 'retrying',
      })
      .mockResolvedValueOnce({
        attemptCount: 3,
        eventId: 'evt_retry',
        eventType: 'order.updated',
        lastError: null,
        orderId: 'ord_retry',
        payload: { failuresBeforeSuccess: 2 },
        processedAt: '2026-06-06T00:00:02.000Z',
        status: 'processed',
      });
    listEventAttemptsMock.mockResolvedValue([
      {
        attemptNumber: 1,
        createdAt: '2026-06-06T00:00:00.000Z',
        errorMessage: 'Simulated transient failure 1/2',
        status: 'retry',
      },
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
    ]);
    findDeadLetterEventMock.mockResolvedValue(null);

    const service = new DemoService({
      accept: acceptMock,
      replayDeadLetterEvent: replayDeadLetterEventMock,
    } as never);

    const result = await service.runScenario('retries_then_success');

    expect(acceptMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.updated' }),
      'kafka',
    );
    expect(result.finalStatus).toBe('processed');
    expect(result.attempts).toBe(3);
    expect(findProcessedEventMock).toHaveBeenCalledTimes(2);
    expect(result.timeline.at(-1)?.label).toBe('Processed successfully');
  });

  it('waits for the matching dead-letter record before returning a dead-letter kafka result', async () => {
    acceptMock.mockResolvedValue({
      accepted: true,
      attempts: 0,
      eventId: 'evt_dead',
      idempotencyKey: 'idempo-dead',
      status: 'published',
      transport: 'kafka',
    });
    findProcessedEventMock
      .mockResolvedValueOnce({
        attemptCount: 4,
        eventId: 'evt_dead',
        eventType: 'order.cancelled',
        lastError: 'Retry budget exhausted after 4 attempts',
        orderId: 'ord_dead',
        payload: { failuresBeforeSuccess: 4 },
        processedAt: '2026-06-06T00:00:03.000Z',
        status: 'dead_lettered',
      })
      .mockResolvedValueOnce({
        attemptCount: 4,
        eventId: 'evt_dead',
        eventType: 'order.cancelled',
        lastError: 'Retry budget exhausted after 4 attempts',
        orderId: 'ord_dead',
        payload: { failuresBeforeSuccess: 4 },
        processedAt: '2026-06-06T00:00:03.000Z',
        status: 'dead_lettered',
      });
    findDeadLetterEventMock.mockResolvedValueOnce(null).mockResolvedValueOnce({
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
    });
    listEventAttemptsMock.mockResolvedValue([
      {
        attemptNumber: 1,
        createdAt: '2026-06-06T00:00:00.000Z',
        errorMessage: 'Simulated transient failure 1/4',
        status: 'retry',
      },
      {
        attemptNumber: 2,
        createdAt: '2026-06-06T00:00:01.000Z',
        errorMessage: 'Simulated transient failure 2/4',
        status: 'retry',
      },
      {
        attemptNumber: 3,
        createdAt: '2026-06-06T00:00:02.000Z',
        errorMessage: 'Simulated transient failure 3/4',
        status: 'retry',
      },
      {
        attemptNumber: 4,
        createdAt: '2026-06-06T00:00:03.000Z',
        errorMessage: 'Retry budget exhausted after 4 attempts',
        status: 'dead_letter',
      },
    ]);

    const service = new DemoService({
      accept: acceptMock,
      replayDeadLetterEvent: replayDeadLetterEventMock,
    } as never);

    const result = await service.runScenario('dead_letter_then_replay');

    expect(result.finalStatus).toBe('dead_letter');
    expect(result.replayAvailable).toBe(true);
    expect(findProcessedEventMock).toHaveBeenCalledTimes(2);
    expect(findDeadLetterEventMock).toHaveBeenCalledTimes(2);
    expect(result.timeline.at(-1)?.label).toBe('Moved to dead-letter queue');
  });

  it('replays a dead-lettered event, clears redis idempotency, and removes the dlq record on success', async () => {
    findDeadLetterEventMock.mockResolvedValue({
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
    });
    replayDeadLetterEventMock.mockResolvedValue({
      accepted: true,
      attempts: 5,
      eventId: 'evt_dead',
      idempotencyKey: 'idempo-dead',
      status: 'processed',
      transport: 'direct',
    });
    listEventAttemptsMock.mockResolvedValue([
      {
        attemptNumber: 5,
        createdAt: '2026-06-06T00:00:04.000Z',
        errorMessage: null,
        status: 'processed',
      },
    ]);

    const service = new DemoService({
      accept: acceptMock,
      replayDeadLetterEvent: replayDeadLetterEventMock,
    } as never);

    const result = await service.replayScenario(
      'dead_letter_then_replay',
      'evt_dead',
    );

    expect(delMock).toHaveBeenCalledWith(
      'event-bridge:idempotency:evt_dead:ord_dead:order.cancelled',
    );
    expect(removeDeadLetterEventMock).toHaveBeenCalledWith('evt_dead');
    expect(result.finalStatus).toBe('processed');
    expect(result.replayed).toBe(true);
    expect(result.timeline.at(-1)?.label).toBe('Replayed successfully');
  });

  it('keeps the dlq record and avoids a success replay outcome when replay does not process', async () => {
    findDeadLetterEventMock.mockResolvedValue({
      createdAt: '2026-06-06T00:00:03.000Z',
      eventId: 'evt_dead_duplicate',
      payload: {
        eventId: 'evt_dead_duplicate',
        occurredAt: '2026-06-06T00:00:00.000Z',
        orderId: 'ord_dead_duplicate',
        payload: { failuresBeforeSuccess: 4 },
        type: 'order.cancelled',
      },
      reason: 'Retry budget exhausted after 4 attempts',
    });
    replayDeadLetterEventMock.mockResolvedValue({
      accepted: true,
      attempts: 4,
      eventId: 'evt_dead_duplicate',
      idempotencyKey: 'idempo-dead-duplicate',
      status: 'duplicate',
      transport: 'direct',
    });
    listEventAttemptsMock.mockResolvedValue([
      {
        attemptNumber: 4,
        createdAt: '2026-06-06T00:00:03.000Z',
        errorMessage: 'Retry budget exhausted after 4 attempts',
        status: 'dead_letter',
      },
    ]);

    const service = new DemoService({
      accept: acceptMock,
      replayDeadLetterEvent: replayDeadLetterEventMock,
    } as never);

    const result = await service.replayScenario(
      'dead_letter_then_replay',
      'evt_dead_duplicate',
    );

    expect(removeDeadLetterEventMock).not.toHaveBeenCalled();
    expect(result.finalStatus).toBe('duplicate');
    expect(result.replayed).toBe(false);
    expect(result.timeline.at(-1)?.label).toBe('Duplicate blocked');
    expect(result.timeline.map((step) => step.label)).not.toContain(
      'Replayed successfully',
    );
  });

  it('uses the direct path and reports the duplicate outcome when the duplicate contract is met', async () => {
    acceptMock.mockResolvedValue({
      accepted: true,
      attempts: 3,
      eventId: 'evt_dup',
      idempotencyKey: 'idempo-dup',
      status: 'duplicate',
      transport: 'direct',
    });

    const service = new DemoService({
      accept: acceptMock,
      replayDeadLetterEvent: replayDeadLetterEventMock,
    } as never);

    const event = {
      eventId: 'evt_dup',
      occurredAt: '2026-06-06T00:00:00.000Z',
      orderId: 'ord_dup',
      payload: {},
      type: 'order.created' as const,
    };

    const result = await service.sendDuplicate('happy_path', event);

    expect(acceptMock).toHaveBeenCalledWith(event, 'direct');
    expect(result.finalStatus).toBe('duplicate');
    expect(result.timeline.at(-1)?.label).toBe('Duplicate blocked');
  });

  it('fails the duplicate path when direct processing does not return duplicate', async () => {
    acceptMock.mockResolvedValue({
      accepted: true,
      attempts: 1,
      eventId: 'evt_unexpected',
      idempotencyKey: 'idempo-unexpected',
      status: 'processed',
      transport: 'direct',
    });

    const service = new DemoService({
      accept: acceptMock,
      replayDeadLetterEvent: replayDeadLetterEventMock,
    } as never);

    await expect(
      service.sendDuplicate('happy_path', {
        eventId: 'evt_unexpected',
        occurredAt: '2026-06-06T00:00:00.000Z',
        orderId: 'ord_unexpected',
        payload: {},
        type: 'order.created',
      }),
    ).rejects.toThrow('Expected duplicate result but received processed');
  });
});
