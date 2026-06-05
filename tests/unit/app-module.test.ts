import { NestFactory } from '@nestjs/core';
import { afterEach, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('AppModule', () => {
  it('creates an application context in test mode', async () => {
    process.env.NODE_ENV = 'test';

    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });

    expect(app).toBeDefined();
    await app.close();
  });
});
