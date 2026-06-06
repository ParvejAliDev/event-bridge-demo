import { describe, expect, it } from 'vitest';

import {
  buildScenarioEvent,
  demoScenarioIds,
  listDemoScenarios,
} from '../../src/modules/demo/scenarios';

describe('demo scenarios', () => {
  it('exposes the three recruiter-facing scenarios in a stable order', () => {
    expect(demoScenarioIds).toEqual([
      'happy_path',
      'retries_then_success',
      'dead_letter_then_replay',
    ]);

    expect(listDemoScenarios()).toEqual([
      {
        id: 'happy_path',
        title: 'Happy path',
        summary: 'A normal order event moves straight through the bridge.',
        transportLabel: 'Kafka pipeline',
      },
      {
        id: 'retries_then_success',
        title: 'Retries then success',
        summary: 'A transient failure retries twice before the event succeeds.',
        transportLabel: 'Kafka pipeline',
      },
      {
        id: 'dead_letter_then_replay',
        title: 'Dead-letter then replay',
        summary:
          'The retry budget is exhausted, then the event is replayed successfully.',
        transportLabel: 'Kafka pipeline',
      },
    ]);
  });

  it('returns fresh public metadata objects on each call', () => {
    const scenarios = listDemoScenarios();

    scenarios[0]!.title = 'Mutated title';

    expect(listDemoScenarios()[0]).toEqual({
      id: 'happy_path',
      title: 'Happy path',
      summary: 'A normal order event moves straight through the bridge.',
      transportLabel: 'Kafka pipeline',
    });
  });

  it('builds deterministic payload shapes for each guided scenario', () => {
    expect(buildScenarioEvent('happy_path')).toMatchObject({
      payload: {},
      type: 'order.created',
    });

    expect(buildScenarioEvent('retries_then_success')).toMatchObject({
      payload: { failuresBeforeSuccess: 2 },
      type: 'order.updated',
    });

    expect(buildScenarioEvent('dead_letter_then_replay')).toMatchObject({
      payload: { failuresBeforeSuccess: 4 },
      type: 'order.cancelled',
    });
  });
});
