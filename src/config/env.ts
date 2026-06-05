import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  KAFKA_CLIENT_ID: z.string().min(1, 'KAFKA_CLIENT_ID is required'),
  KAFKA_BROKERS: z.string().min(1, 'KAFKA_BROKERS is required'),
  KAFKA_TOPIC: z.string().min(1).default('order-events'),
  KAFKA_CONSUMER_GROUP: z.string().min(1).default('order-events-local'),
  PROCESSING_MAX_RETRIES: z.coerce.number().int().nonnegative().default(3),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined>): AppEnv {
  return envSchema.parse(input);
}

export function getEnv(
  input: Record<string, string | undefined> = process.env,
): AppEnv {
  return parseEnv(input);
}
