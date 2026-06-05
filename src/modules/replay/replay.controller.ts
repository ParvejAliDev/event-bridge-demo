import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';

import { ensureRedisConnection } from '../../lib/redis';
import { orderEventSchema } from '../contracts/order-event.schema';
import { createEventIdempotencyKey } from '../idempotency';
import type { KafkaPublisherService } from '../publishers/kafka.publisher';
import {
  listDeadLetterEvents,
  removeDeadLetterEvent,
} from '../processing/repository';

@Controller('events')
export class ReplayController {
  constructor(private readonly kafkaPublisher: KafkaPublisherService) {}

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
    await this.kafkaPublisher.publish(event);
    await removeDeadLetterEvent(eventId);

    return {
      replayed: true,
      eventId,
      reason: eventRecord.reason,
    };
  }
}
