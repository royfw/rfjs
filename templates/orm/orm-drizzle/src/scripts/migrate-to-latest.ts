import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDbByClient } from '@/db';
import { checkAndCreateDB } from './check-and-create-db';
import { checkAndCreateSchema } from './check-and-create-schema';
import { SCHEMA } from '@/consts';
import { getConnectionStringInfo } from '@/utils';
import { MigrateToLatestParams } from '@/type';

export async function migrateToLatest(params: MigrateToLatestParams): Promise<void> {
  const {
    connectionString,
    schema = SCHEMA,
    migrationsSchema,
    migrationsFolder,
  } = params;
  const { finalConnectionString, finalSchema, optionsSchemas } = getConnectionStringInfo(
    connectionString,
    schema,
  );
  const schemas: Set<string> = new Set();

  schemas.add(finalSchema);
  optionsSchemas.forEach((i) => schemas.add(i));
  console.log('Get schemas: ', Array.from(schemas.values()));

  await checkAndCreateDB(finalConnectionString);
  await checkAndCreateSchema(finalConnectionString, Array.from(schemas.values()));
  if (migrationsSchema) {
    await checkAndCreateSchema(finalConnectionString, [migrationsSchema]);
  }

  const finalMigrationSchema = migrationsSchema || finalSchema;
  console.log('finalMigrationSchema: ', finalMigrationSchema);
  await runMigrations(finalConnectionString, finalMigrationSchema, migrationsFolder);
}

async function runMigrations(
  connectionString: string,
  migrationsSchema: string,
  migrationsFolder = 'drizzle',
): Promise<void> {
  const { client, db } = createDbByClient(connectionString);
  let isConnected = false;
  try {
    await client.connect();
    isConnected = true;

    console.log('Running migrations...');
    console.log('migrationsSchema: ', migrationsSchema);
    await migrate(db, {
      migrationsFolder,
      migrationsSchema,
    });
    console.log('Migrations completed successfully.');
  } catch (e) {
    console.error('Migration failed!');
    console.error(e);
    throw e;
  } finally {
    if (isConnected) {
      await client.end();
    }
  }
}
