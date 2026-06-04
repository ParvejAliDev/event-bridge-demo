import { Module } from '@nestjs/common';

import { HealthController } from './modules/health/health.controller';
import { IngestController } from './modules/ingest/ingest.controller';
import { ProcessingService } from './modules/processing/processing.service';

@Module({
  controllers: [HealthController, IngestController],
  providers: [ProcessingService],
})
export class AppModule {}
