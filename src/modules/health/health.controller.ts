import { Controller, Get } from '@nestjs/common';

import { getEnv } from '../../config/env';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    const env = getEnv(process.env);

    return {
      status: 'ok',
      service: 'event-bridge-demo',
      kafkaClientId: env.KAFKA_CLIENT_ID,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  ready() {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }
}
