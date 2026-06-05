import type { OrderEvent } from '../contracts/order-event.schema';

export function createEventIdempotencyKey(
  event: Pick<OrderEvent, 'eventId' | 'orderId' | 'type'>,
): string {
  return `${event.eventId}:${event.orderId}:${event.type}`;
}
