import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema.js';

export function createDatabase(databaseUrl: string) {
  const sslEnabled = databaseUrl.includes('sslmode=require') || databaseUrl.includes('sslmode=verify-full') || databaseUrl.includes('sslmode=verify-ca') || databaseUrl.includes('sslmode=prefer');
  const pool = new Pool({
    connectionString: databaseUrl,
    ...(sslEnabled && { ssl: { rejectUnauthorized: false } }),
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return {
    db: createDatabaseFromPool(pool),
    pool,
  };
}

export function createDatabaseFromPool(pool: Pool) {
  return drizzle(pool, { schema });
}

export type Database = ReturnType<typeof createDatabase>['db'];
export type DatabasePool = ReturnType<typeof createDatabase>['pool'];
