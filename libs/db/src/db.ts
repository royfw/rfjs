import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Client, Pool } from 'pg';
import * as schema from './schema';
import { getConnectionStringInfo } from './utils';

export type Schema = typeof schema;
export type Db = NodePgDatabase<Schema>;

export function createDb(
  connectionString: string,
  targetSchema?: string,
  useClient = false,
): { pool: Pool; client: Client; db: Db; hasSearchPath: boolean } {
  const { finalConnectionString, hasSearchPath } = getConnectionStringInfo(
    connectionString,
    targetSchema,
  );
  const pool = new Pool({ connectionString: finalConnectionString });
  const client = new Client({ connectionString: finalConnectionString });
  const db = drizzle(useClient ? client : pool, { schema });
  return { pool, client, db, hasSearchPath };
}

export function createDbByClient(
  connectionString: string,
  targetSchema?: string,
): { client: Client; db: Db; hasSearchPath: boolean } {
  const { finalConnectionString, hasSearchPath } = getConnectionStringInfo(
    connectionString,
    targetSchema,
  );
  const client = new Client({ connectionString: finalConnectionString });
  const db = drizzle(client, { schema });
  return { client, db, hasSearchPath };
}
