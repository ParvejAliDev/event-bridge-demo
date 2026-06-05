import { describe, expect, it, vi } from 'vitest';

import { ensureKafkaTopic } from '../../src/modules/consumers/kafka-topics';

describe('ensureKafkaTopic', () => {
  it('creates the topic and waits for leaders', async () => {
    const calls: string[] = [];
    const admin = {
      connect: vi.fn(async () => {
        calls.push('connect');
      }),
      createTopics: vi.fn(async (input: unknown) => {
        calls.push('createTopics');
        expect(input).toEqual({
          waitForLeaders: true,
          topics: [
            {
              topic: 'order-events',
              numPartitions: 1,
              replicationFactor: 1,
            },
          ],
        });
      }),
      disconnect: vi.fn(async () => {
        calls.push('disconnect');
      }),
    };

    await ensureKafkaTopic(admin as never, 'order-events');

    expect(calls).toEqual(['connect', 'createTopics', 'disconnect']);
  });

  it('disconnects even when topic creation fails', async () => {
    const admin = {
      connect: vi.fn(async () => undefined),
      createTopics: vi.fn(async () => {
        throw new Error('boom');
      }),
      disconnect: vi.fn(async () => undefined),
    };

    await expect(
      ensureKafkaTopic(admin as never, 'order-events'),
    ).rejects.toThrow('boom');
    expect(admin.disconnect).toHaveBeenCalledTimes(1);
  });
});
