import { Body, Controller, Post } from '@nestjs/common';

import { orderEventSchema } from '../contracts/order-event.schema';
// Nest uses the class token here for runtime injection metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ProcessingService } from '../processing/processing.service';

@Controller('events')
export class IngestController {
  constructor(private readonly processingService: ProcessingService) {}

  @Post('ingest')
  ingest(@Body() body: unknown) {
    const event = orderEventSchema.parse(body);

    return this.processingService.accept(event);
  }
}
