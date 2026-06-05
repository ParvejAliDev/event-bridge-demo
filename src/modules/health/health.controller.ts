import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { getEnv } from '../../config/env';
import { getSql } from '../../lib/db';
import { ensureRedisConnection } from '../../lib/redis';

@Controller()
export class HealthController {
  @Get('health')
  async health() {
    const env = getEnv(process.env);

    try {
      await Promise.all([
        getSql()`select 1`,
        ensureRedisConnection().then((client) => client.ping()),
      ]);

      return {
        status: 'ok',
        service: 'event-bridge-demo',
        kafkaClientId: env.KAFKA_CLIENT_ID,
        kafkaTopic: env.KAFKA_TOPIC,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        status: 'degraded',
        service: 'event-bridge-demo',
        timestamp: new Date().toISOString(),
        error:
          error instanceof Error ? error.message : 'Unknown dependency error',
      });
    }
  }

  @Get('ready')
  async ready() {
    const env = getEnv(process.env);

    try {
      await Promise.all([
        getSql()`select 1`,
        ensureRedisConnection().then((client) => client.ping()),
      ]);

      return {
        status: 'ready',
        kafkaTopic: env.KAFKA_TOPIC,
        consumerGroup: env.KAFKA_CONSUMER_GROUP,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error:
          error instanceof Error ? error.message : 'Unknown dependency error',
      });
    }
  }
}
