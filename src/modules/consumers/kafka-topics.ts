import type { Admin } from 'kafkajs';

type TopicAdmin = Pick<Admin, 'connect' | 'disconnect' | 'createTopics'>;

export async function ensureKafkaTopic(
  admin: TopicAdmin,
  topic: string,
): Promise<void> {
  await admin.connect();

  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: [
        {
          topic,
          numPartitions: 1,
          replicationFactor: 1,
        },
      ],
    });
  } finally {
    await admin.disconnect();
  }
}
