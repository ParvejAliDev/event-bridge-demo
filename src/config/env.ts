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
