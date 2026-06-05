import type { OrderEvent } from '../contracts/order-event.schema';

export type DeadLetterRecord = {
  event: OrderEvent;
  reason: string;
};

export function createDeadLetterRecord(
  event: OrderEvent,
  reason: string,
): DeadLetterRecord {
  return {
    event,
    reason,
  };
}
