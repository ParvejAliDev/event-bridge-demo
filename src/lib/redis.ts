import { createClient, type RedisClientType } from 'redis';

import { getEnv } from '../config/env';

const globalForRedis = globalThis as typeof globalThis & {
  __eventBridgeRedis?: RedisClientType;
};

function createRedisClient() {
  return createClient({
    url: getEnv(process.env).REDIS_URL,
  });
}

export function getRedisClient() {
  if (!globalForRedis.__eventBridgeRedis) {
    globalForRedis.__eventBridgeRedis = createRedisClient();
  }

  return globalForRedis.__eventBridgeRedis;
}

export async function ensureRedisConnection() {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

export async function closeRedisClient() {
  if (globalForRedis.__eventBridgeRedis?.isOpen) {
    await globalForRedis.__eventBridgeRedis.quit();
  }

  globalForRedis.__eventBridgeRedis = undefined;
}
