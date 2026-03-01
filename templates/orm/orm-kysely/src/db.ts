import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './database';
import { getConnectionStringInfo } from './utils';

export function createDb(
  connectionString: string,
  targetSchema?: string,
): {
  client: Pool;
  db: Kysely<Database>;
  hasSearchPath: boolean;
} {
  const { finalConnectionString, hasSearchPath } = getConnectionStringInfo(
    connectionString,
    targetSchema,
  );
  const pool = new Pool({
    connectionString: finalConnectionString,
  });

  const dialect = new PostgresDialect({
    pool,
  });

  const db = new Kysely<Database>({ dialect });
  return {
    client: pool,
    db,
    hasSearchPath,
  };
}
