import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { getEnv } from './config/env';

async function bootstrap() {
  const env = getEnv(process.env);
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}

bootstrap();
