import type { OrderEvent } from '../contracts/order-event.schema';

export const demoScenarioIds = [
  'happy_path',
  'retries_then_success',
  'dead_letter_then_replay',
] as const;

export type DemoScenarioId = (typeof demoScenarioIds)[number];

type DemoScenarioDefinition = {
  id: DemoScenarioId;
  title: string;
  summary: string;
  transportLabel: 'Kafka pipeline';
  type: OrderEvent['type'];
  failuresBeforeSuccess: number;
};

const demoScenarioDefinitions: Record<DemoScenarioId, DemoScenarioDefinition> = {
  happy_path: {
    id: 'happy_path',
    title: 'Happy path',
    summary: 'A normal order event moves straight through the bridge.',
    transportLabel: 'Kafka pipeline',
    type: 'order.created',
    failuresBeforeSuccess: 0,
  },
  retries_then_success: {
    id: 'retries_then_success',
    title: 'Retries then success',
    summary: 'A transient failure retries twice before the event succeeds.',
    transportLabel: 'Kafka pipeline',
    type: 'order.updated',
    failuresBeforeSuccess: 2,
  },
  dead_letter_then_replay: {
    id: 'dead_letter_then_replay',
    title: 'Dead-letter then replay',
    summary:
      'The retry budget is exhausted, then the event is replayed successfully.',
    transportLabel: 'Kafka pipeline',
    type: 'order.cancelled',
    failuresBeforeSuccess: 4,
  },
};

export function listDemoScenarios(): DemoScenarioDefinition[] {
  return demoScenarioIds.map((id) => demoScenarioDefinitions[id]);
}

export function buildScenarioEvent(id: DemoScenarioId): OrderEvent {
  const scenario = demoScenarioDefinitions[id];
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  return {
    eventId: `demo-${id}-${nonce}`,
    orderId: `ord-${id}-${nonce}`,
    occurredAt: new Date().toISOString(),
    type: scenario.type,
    payload:
      scenario.failuresBeforeSuccess > 0
        ? { failuresBeforeSuccess: scenario.failuresBeforeSuccess }
        : {},
  };
}
