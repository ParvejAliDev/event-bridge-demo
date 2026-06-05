import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';

import { ensureRedisConnection } from '../../lib/redis';
import { orderEventSchema } from '../contracts/order-event.schema';
import { createEventIdempotencyKey } from '../idempotency';
import { ProcessingService } from '../processing/processing.service';
import {
  listDeadLetterEvents,
  removeDeadLetterEvent,
} from '../processing/repository';

@Controller('events')
export class ReplayController {
  constructor(
    @Inject(ProcessingService)
    private readonly processingService: ProcessingService,
  ) {}

  @Get('dead-letter')
  async deadLetter() {
    return listDeadLetterEvents();
  }

  @Post('replay/:eventId')
  async replay(@Param('eventId') eventId: string) {
    const deadLetterEvents = await listDeadLetterEvents(100);
    const eventRecord = deadLetterEvents.find(
      (item) => item.eventId === eventId,
    );

    if (!eventRecord) {
      throw new NotFoundException(`No dead-letter event found for ${eventId}`);
    }

    const event = orderEventSchema.parse(eventRecord.payload);
    const redisClient = await ensureRedisConnection();
    await redisClient.del(
      `event-bridge:idempotency:${createEventIdempotencyKey(event)}`,
    );

    const replayResult =
      await this.processingService.replayDeadLetterEvent(event);

    if (replayResult.status !== 'dead_letter') {
      await removeDeadLetterEvent(eventId);
    }

    return {
      replayed: replayResult.status !== 'dead_letter',
      eventId,
      reason: eventRecord.reason,
      outcome: replayResult.status,
      attempts: replayResult.attempts,
    };
  }
}
