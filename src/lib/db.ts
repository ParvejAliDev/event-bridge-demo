import postgres from 'postgres';

import { getEnv } from '../config/env';

const globalForDb = globalThis as typeof globalThis & {
  __eventBridgeSql?: ReturnType<typeof postgres>;
};

function createSql() {
  return postgres(getEnv(process.env).DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
  });
}

export function getSql() {
  if (!globalForDb.__eventBridgeSql) {
    globalForDb.__eventBridgeSql = createSql();
  }

  return globalForDb.__eventBridgeSql;
}

export async function endSql() {
  if (globalForDb.__eventBridgeSql) {
    await globalForDb.__eventBridgeSql.end();
    globalForDb.__eventBridgeSql = undefined;
  }
}
