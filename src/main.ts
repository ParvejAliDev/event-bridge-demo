import 'reflect-metadata';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { getEnv } from './config/env';

async function bootstrap() {
  const env = getEnv(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  await app.listen(env.PORT);
}

bootstrap();
