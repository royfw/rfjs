import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDbByClient } from '@/db';
import { checkAndCreateDB } from './check-and-create-db';
import { checkAndCreateSchema } from './check-and-create-schema';
import { SCHEMA } from '@/consts';
import { getConnectionStringInfo } from '@/utils';
import { MigrateToLatestParams } from '@/type';

export async function migrateToLatest(params: MigrateToLatestParams): Promise<void> {
  const { connectionString, schema = SCHEMA, migrationsFolder = 'drizzle' } = params;
  const { finalConnectionString, finalSchema } = getConnectionStringInfo(
    connectionString,
    schema,
  );

  await checkAndCreateDB(finalConnectionString);
  await checkAndCreateSchema(finalConnectionString, [finalSchema]);

  const { client, db } = createDbByClient(finalConnectionString);
  let connected = false;
  try {
    await client.connect();
    connected = true;
    await migrate(db, { migrationsFolder, migrationsSchema: finalSchema });
  } finally {
    if (connected) await client.end();
  }
}
