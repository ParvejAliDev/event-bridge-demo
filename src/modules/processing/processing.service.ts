import { Injectable } from '@nestjs/common';

import type { OrderEvent } from '../contracts/order-event.schema';

@Injectable()
export class ProcessingService {
  accept(event: OrderEvent) {
    return {
      accepted: true,
      idempotencyKey: `${event.orderId}:${event.type}`,
      eventId: event.eventId,
    };
  }
}
