import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';
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
): {
  pool: Pool;
  db: PrismaClient;
  hasSearchPath: boolean;
} {
  const { finalConnectionString, hasSearchPath, finalSchema } = getConnectionStringInfo(
    connectionString,
    targetSchema,
  );

  const pool = new Pool({ connectionString: finalConnectionString });

  const adapter = new PrismaPg(pool, { schema: finalSchema });
  const db = new PrismaClient({ adapter });
  return {
    pool,
    db,
    hasSearchPath,
  };
}
