import { Module } from '@nestjs/common';

import { KafkaConsumerService } from './modules/consumers/kafka.consumer';
import { DemoController } from './modules/demo/demo.controller';
import { DemoService } from './modules/demo/demo.service';
import { HealthController } from './modules/health/health.controller';
import { IngestController } from './modules/ingest/ingest.controller';
import { MetricsController } from './modules/metrics/metrics.controller';
import { ProcessingService } from './modules/processing/processing.service';
import { KafkaPublisherService } from './modules/publishers/kafka.publisher';
import { ReplayController } from './modules/replay/replay.controller';

@Module({
  controllers: [
    DemoController,
    HealthController,
    IngestController,
    MetricsController,
    ReplayController,
  ],
  providers: [
    DemoService,
    KafkaConsumerService,
    KafkaPublisherService,
    ProcessingService,
  ],
})
export class AppModule {}
