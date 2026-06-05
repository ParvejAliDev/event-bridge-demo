import { Body, Controller, Post, Query } from '@nestjs/common';

import { orderEventSchema } from '../contracts/order-event.schema';
import type { ProcessingService } from '../processing/processing.service';

@Controller('events')
export class IngestController {
  constructor(private readonly processingService: ProcessingService) {}

  @Post('ingest')
  ingest(
    @Body() body: unknown,
    @Query('transport') transport: 'direct' | 'kafka' = 'kafka',
  ) {
    const event = orderEventSchema.parse(body);

    return this.processingService.accept(
      event,
      transport === 'direct' ? 'direct' : 'kafka',
    );
  }
}
