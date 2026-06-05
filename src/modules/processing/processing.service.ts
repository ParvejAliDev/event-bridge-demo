import { Inject, Injectable, Logger } from '@nestjs/common';

import { getEnv } from '../../config/env';
import { ensureRedisConnection } from '../../lib/redis';
import type { OrderEvent } from '../contracts/order-event.schema';
import { createDeadLetterRecord } from '../dlq';
import { createEventIdempotencyKey } from '../idempotency';
import { KafkaPublisherService } from '../publishers/kafka.publisher';
import { determineProcessingOutcome } from './policy';
import {
  addDeadLetterEvent,
  addRetrySchedule,
  findProcessedEvent,
  recordEventAttempt,
  upsertProcessedEvent,
} from './repository';

type AcceptedEventResult = {
  accepted: true;
  eventId: string;
  idempotencyKey: string;
  transport: 'direct' | 'kafka';
  status: 'published' | 'processed' | 'retry' | 'dead_letter' | 'duplicate';
  attempts: number;
  reason?: string;
};

type HandleConsumedEventOptions = {
  replay?: boolean;
};

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    @Inject(KafkaPublisherService)
    private readonly kafkaPublisher: KafkaPublisherService,
  ) {}

  async accept(
    event: OrderEvent,
    transport: 'direct' | 'kafka' = 'kafka',
  ): Promise<AcceptedEventResult> {
    const idempotencyKey = createEventIdempotencyKey(event);

    if (transport === 'kafka') {
      await this.kafkaPublisher.publish(event);
      return {
        accepted: true,
        eventId: event.eventId,
        idempotencyKey,
        transport,
        status: 'published',
        attempts: 0,
      };
    }

    return this.handleConsumedEvent(event);
  }

  async replayDeadLetterEvent(event: OrderEvent): Promise<AcceptedEventResult> {
    return this.handleConsumedEvent(event, { replay: true });
  }

  async handleConsumedEvent(
    event: OrderEvent,
    options: HandleConsumedEventOptions = {},
  ): Promise<AcceptedEventResult> {
    const env = getEnv(process.env);
    const idempotencyKey = createEventIdempotencyKey(event);
    const redisClient = await ensureRedisConnection();
    const redisKey = `event-bridge:idempotency:${idempotencyKey}`;
    const existingRecord = await findProcessedEvent(event.eventId);

    if (existingRecord?.status === 'processed') {
      return {
        accepted: true,
        eventId: event.eventId,
        idempotencyKey,
        transport: 'direct',
        status: 'duplicate',
        attempts: existingRecord.attemptCount,
      };
    }

    const reserved = await redisClient.set(redisKey, '1', {
      EX: env.IDEMPOTENCY_TTL_SECONDS,
      NX: true,
    });

    if (reserved !== 'OK' && existingRecord) {
      return {
        accepted: true,
        eventId: event.eventId,
        idempotencyKey,
        transport: 'direct',
        status: 'duplicate',
        attempts: existingRecord.attemptCount,
      };
    }

    let attemptNumber = Math.max(1, (existingRecord?.attemptCount ?? 0) + 1);
    const maxAttemptNumber =
      options.replay && existingRecord?.status === 'dead_lettered'
        ? attemptNumber
        : env.PROCESSING_MAX_RETRIES + 1;

    while (attemptNumber <= maxAttemptNumber) {
      const outcome = determineProcessingOutcome({
        event,
        attemptNumber,
        maxRetries: env.PROCESSING_MAX_RETRIES,
      });

      if (outcome.status === 'processed') {
        await recordEventAttempt({
          eventId: event.eventId,
          attemptNumber,
          status: 'processed',
        });
        await upsertProcessedEvent({
          event,
          status: 'processed',
          attemptCount: attemptNumber,
        });

        this.logger.log(
          `Processed event ${event.eventId} in ${attemptNumber} attempts`,
        );
        return {
          accepted: true,
          eventId: event.eventId,
          idempotencyKey,
          transport: 'direct',
          status: 'processed',
          attempts: attemptNumber,
        };
      }

      if (outcome.status === 'retry') {
        await recordEventAttempt({
          eventId: event.eventId,
          attemptNumber,
          status: 'retry',
          errorMessage: outcome.reason,
        });
        await upsertProcessedEvent({
          event,
          status: 'retrying',
          attemptCount: attemptNumber,
          lastError: outcome.reason,
        });
        await addRetrySchedule({
          eventId: event.eventId,
          nextAttemptAt: new Date(Date.now() + attemptNumber * 1000),
          reason: outcome.reason,
        });

        attemptNumber += 1;
        continue;
      }

      const deadLetterRecord = createDeadLetterRecord(event, outcome.reason);
      await recordEventAttempt({
        eventId: event.eventId,
        attemptNumber,
        status: 'dead_letter',
        errorMessage: outcome.reason,
      });
      await upsertProcessedEvent({
        event,
        status: 'dead_lettered',
        attemptCount: attemptNumber,
        lastError: outcome.reason,
      });
      await addDeadLetterEvent(deadLetterRecord);

      this.logger.warn(
        `Dead-lettered event ${event.eventId}: ${outcome.reason}`,
      );
      return {
        accepted: true,
        eventId: event.eventId,
        idempotencyKey,
        transport: 'direct',
        status: 'dead_letter',
        attempts: attemptNumber,
        reason: outcome.reason,
      };
    }

    return {
      accepted: true,
      eventId: event.eventId,
      idempotencyKey,
      transport: 'direct',
      status: 'dead_letter',
      attempts: attemptNumber,
      reason: 'Retry budget exhausted unexpectedly',
    };
  }
}
