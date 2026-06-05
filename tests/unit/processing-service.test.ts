import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  redisSetMock,
  addDeadLetterEventMock,
  addRetryScheduleMock,
  findProcessedEventMock,
  recordEventAttemptMock,
  upsertProcessedEventMock,
} = vi.hoisted(() => ({
  redisSetMock: vi.fn(),
  addDeadLetterEventMock: vi.fn(),
  addRetryScheduleMock: vi.fn(),
  findProcessedEventMock: vi.fn(),
  recordEventAttemptMock: vi.fn(),
  upsertProcessedEventMock: vi.fn(),
}));

vi.mock('../../src/lib/redis', () => ({
  ensureRedisConnection: vi.fn(async () => ({
    set: redisSetMock,
  })),
}));

vi.mock('../../src/modules/processing/repository', () => ({
  addDeadLetterEvent: addDeadLetterEventMock,
  addRetrySchedule: addRetryScheduleMock,
  findProcessedEvent: findProcessedEventMock,
  recordEventAttempt: recordEventAttemptMock,
  upsertProcessedEvent: upsertProcessedEventMock,
}));

import { ProcessingService } from '../../src/modules/processing/processing.service';

describe('ProcessingService.replayDeadLetterEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisSetMock.mockResolvedValue('OK');

    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.KAFKA_CLIENT_ID = 'order-events-service';
    process.env.KAFKA_BROKERS = 'localhost:9092';
    process.env.KAFKA_TOPIC = 'order-events';
    process.env.KAFKA_CONSUMER_GROUP = 'order-events-local';
    process.env.PROCESSING_MAX_RETRIES = '3';
    process.env.IDEMPOTENCY_TTL_SECONDS = '300';
  });

  it('processes a replayed dead-letter event on the next successful attempt', async () => {
    findProcessedEventMock.mockResolvedValue({
      attemptCount: 4,
      eventId: 'evt_replay',
      eventType: 'order.updated',
      lastError: 'Retry budget exhausted after 4 attempts',
      orderId: 'ord_replay',
      payload: { failuresBeforeSuccess: 4 },
      processedAt: '2026-06-05T00:00:00.000Z',
      status: 'dead_lettered',
    });

    const service = new ProcessingService({ publish: vi.fn() } as never);
    const result = await service.replayDeadLetterEvent({
      eventId: 'evt_replay',
      occurredAt: '2026-06-05T00:00:00.000Z',
      orderId: 'ord_replay',
      payload: { failuresBeforeSuccess: 4 },
      type: 'order.updated',
    });

    expect(result).toMatchObject({
      attempts: 5,
      status: 'processed',
    });
    expect(recordEventAttemptMock).toHaveBeenCalledWith({
      attemptNumber: 5,
      eventId: 'evt_replay',
      status: 'processed',
    });
    expect(upsertProcessedEventMock).toHaveBeenCalledWith({
      attemptCount: 5,
      event: {
        eventId: 'evt_replay',
        occurredAt: '2026-06-05T00:00:00.000Z',
        orderId: 'ord_replay',
        payload: { failuresBeforeSuccess: 4 },
        type: 'order.updated',
      },
      status: 'processed',
    });
    expect(addRetryScheduleMock).not.toHaveBeenCalled();
    expect(addDeadLetterEventMock).not.toHaveBeenCalled();
  });
});
