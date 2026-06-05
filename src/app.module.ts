import { Module } from '@nestjs/common';

import { KafkaConsumerService } from './modules/consumers/kafka.consumer';
import { HealthController } from './modules/health/health.controller';
import { IngestController } from './modules/ingest/ingest.controller';
import { MetricsController } from './modules/metrics/metrics.controller';
import { ProcessingService } from './modules/processing/processing.service';
import { KafkaPublisherService } from './modules/publishers/kafka.publisher';
import { ReplayController } from './modules/replay/replay.controller';

@Module({
  controllers: [
    HealthController,
    IngestController,
    MetricsController,
    ReplayController,
  ],
  providers: [KafkaConsumerService, KafkaPublisherService, ProcessingService],
})
export class AppModule {}
