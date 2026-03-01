import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Client, Pool } from 'pg';
import * as schema from './schema';
import { getConnectionStringInfo } from '@/utils';

/**
 * initializes a new database connection using the provided connection string and returns both the client and the database instance
 *
 * @param connectionString - The connection string for the database
 * @returns An object containing the client and the database instance
 */
export function createDb(
  connectionString: string,
  targetSchema?: string,
  useClient = false,
): {
  pool: Pool;
  client: Client;
  db: NodePgDatabase<typeof schema>;
  hasSearchPath: boolean;
} {
  const { finalConnectionString, hasSearchPath } = getConnectionStringInfo(
    connectionString,
    targetSchema,
  );
  // We need to connect the client.
  const pool = new Pool({
    connectionString: finalConnectionString,
  });
  const client = new Client({
    connectionString: finalConnectionString,
  });
  const db = drizzle(useClient ? client : pool, { schema });
  return {
    pool,
    client,
    db,
    hasSearchPath,
  };
}

export function createDbByClient(
  connectionString: string,
  targetSchema?: string,
): {
  client: Client;
  db: NodePgDatabase<typeof schema>;
  hasSearchPath: boolean;
} {
  const { finalConnectionString, hasSearchPath } = getConnectionStringInfo(
    connectionString,
    targetSchema,
  );
  // We need to connect the client.
  const client = new Client({
    connectionString: finalConnectionString,
  });
  const db = drizzle(client, { schema });
  return {
    client,
    db,
    hasSearchPath,
  };
}
