import { Inject, Injectable } from '@nestjs/common';

import { getSql } from '../../lib/db';
import { ensureRedisConnection } from '../../lib/redis';
import { createEventIdempotencyKey } from '../idempotency';
import {
  countProcessingMetrics,
  findDeadLetterEvent,
  findProcessedEvent,
  listDeadLetterEvents,
  listEventAttempts,
  removeDeadLetterEvent,
} from '../processing/repository';
import { ProcessingService } from '../processing/processing.service';
import { buildDemoTimeline } from './presenter';
import { buildScenarioEvent, type DemoScenarioId } from './scenarios';

type SettledScenarioState = {
  finalStatus: 'processed' | 'dead_letter';
  processedEvent: NonNullable<Awaited<ReturnType<typeof findProcessedEvent>>>;
  deadLetterRecord: Awaited<ReturnType<typeof findDeadLetterEvent>>;
};

@Injectable()
export class DemoService {
  constructor(
    @Inject(ProcessingService)
    private readonly processingService: ProcessingService,
  ) {}

  async getOverview() {
    try {
      await Promise.all([
        getSql()`select 1`,
        ensureRedisConnection().then((client) => client.ping()),
      ]);

      const [metrics, recentDeadLetters] = await Promise.all([
        countProcessingMetrics(),
        listDeadLetterEvents(5),
      ]);

      return {
        health: { status: 'ok' as const },
        readiness: { status: 'ready' as const },
        metrics,
        recentDeadLetters,
      };
    } catch (error) {
      return {
        health: {
          status: 'degraded' as const,
          error:
            error instanceof Error ? error.message : 'Unknown dependency error',
        },
        readiness: { status: 'not_ready' as const },
        metrics: {
          processed: 0,
          retrying: 0,
          deadLettered: 0,
          deadLetterQueue: 0,
        },
        recentDeadLetters: [],
      };
    }
  }

  async runScenario(scenarioId: DemoScenarioId) {
    const event = buildScenarioEvent(scenarioId);
    await this.processingService.accept(event, 'kafka');

    const settledState = await this.waitForSettledEvent(event.eventId);
    const attempts = await listEventAttempts(event.eventId);

    return {
      event,
      attempts: settledState.processedEvent.attemptCount,
      finalStatus: settledState.finalStatus,
      deadLetterRecord: settledState.deadLetterRecord,
      replayAvailable: Boolean(settledState.deadLetterRecord),
      duplicateAvailable: settledState.finalStatus === 'processed',
      timeline: buildDemoTimeline({
        attempts,
        deadLetterReason: settledState.deadLetterRecord?.reason ?? null,
        duplicate: false,
        replayed: false,
        transport: 'kafka',
      }),
    };
  }

  async replayScenario(scenarioId: DemoScenarioId, eventId: string) {
    const deadLetterRecord = await findDeadLetterEvent(eventId);

    if (!deadLetterRecord) {
      throw new Error(`No dead-letter event found for ${eventId}`);
    }

    const redisClient = await ensureRedisConnection();
    await redisClient.del(
      `event-bridge:idempotency:${createEventIdempotencyKey(deadLetterRecord.payload)}`,
    );

    const replayResult = await this.processingService.replayDeadLetterEvent(
      deadLetterRecord.payload,
    );
    const replayed = replayResult.status === 'processed';

    if (replayed) {
      await removeDeadLetterEvent(eventId);
    }

    const attempts = await listEventAttempts(eventId);

    return {
      attempts: replayResult.attempts,
      event: deadLetterRecord.payload,
      finalStatus: replayResult.status,
      replayed,
      scenarioId,
      timeline: buildDemoTimeline({
        attempts,
        deadLetterReason:
          replayResult.status === 'dead_letter'
            ? (replayResult.reason ?? deadLetterRecord.reason)
            : null,
        duplicate: replayResult.status === 'duplicate',
        replayed,
        transport: 'direct',
      }),
    };
  }

  async sendDuplicate(
    scenarioId: DemoScenarioId,
    event: ReturnType<typeof buildScenarioEvent>,
  ) {
    const result = await this.processingService.accept(event, 'direct');

    if (result.status !== 'duplicate') {
      throw new Error(
        `Expected duplicate result but received ${result.status}`,
      );
    }

    return {
      attempts: result.attempts,
      event,
      finalStatus: result.status,
      scenarioId,
      timeline: buildDemoTimeline({
        attempts: [],
        deadLetterReason: null,
        duplicate: true,
        replayed: false,
        transport: 'direct',
      }),
    };
  }

  async waitForSettledEvent(eventId: string): Promise<SettledScenarioState> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const processedEvent = await findProcessedEvent(eventId);

      if (processedEvent?.status === 'processed') {
        return {
          finalStatus: 'processed',
          processedEvent,
          deadLetterRecord: null,
        };
      }

      if (processedEvent?.status === 'dead_lettered') {
        const deadLetterRecord = await findDeadLetterEvent(eventId);

        if (deadLetterRecord) {
          return {
            finalStatus: 'dead_letter',
            processedEvent,
            deadLetterRecord,
          };
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timed out waiting for settled demo state for ${eventId}`);
  }
}
