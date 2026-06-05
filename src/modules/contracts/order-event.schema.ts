import { z } from 'zod';

export const orderEventSchema = z.object({
  eventId: z.string().min(1),
  orderId: z.string().min(1),
  type: z.enum([
    'order.created',
    'order.updated',
    'order.cancelled',
    'order.status.changed',
  ]),
  occurredAt: z.string().datetime(),
  payload: z.record(z.string(), z.json()).default({}),
});

export type OrderEvent = z.infer<typeof orderEventSchema>;
