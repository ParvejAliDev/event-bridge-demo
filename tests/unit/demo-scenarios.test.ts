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

    expect(listDemoScenarios()).toMatchObject([
      {
        id: 'happy_path',
        title: 'Happy path',
        transportLabel: 'Kafka pipeline',
      },
      {
        id: 'retries_then_success',
        title: 'Retries then success',
        transportLabel: 'Kafka pipeline',
      },
      {
        id: 'dead_letter_then_replay',
        title: 'Dead-letter then replay',
        transportLabel: 'Kafka pipeline',
      },
    ]);
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
