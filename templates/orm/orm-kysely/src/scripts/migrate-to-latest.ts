import { Migrator } from 'kysely';
import { createDb } from '@/db';
import { migrations } from '@/migrations';
import { MigrateToLatestParams } from '@/type';
import { SCHEMA } from '@/consts';
import { checkAndCreateDB, checkAndCreateSchema } from '@/scripts';
import { getConnectionStringInfo } from '@/utils';

export async function migrateToLatest(params: MigrateToLatestParams): Promise<void> {
  const { connectionString, schema = SCHEMA, migrationsSchema } = params;
  const { finalConnectionString, finalSchema, optionsSchemas } = getConnectionStringInfo(
    connectionString,
    schema,
  );
  // Use pg-connection-string for more robust parsing and to generate admin connection string
  // Default fallback
  const schemas: Set<string> = new Set();
  // -csearch_path=

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
  await runMigrations(finalConnectionString, finalMigrationSchema);
}

async function runMigrations(
  connectionString: string,
  finalMigrationSchema: string,
): Promise<void> {
  const { db } = createDb(connectionString);

  try {
    const migrator = new Migrator({
      db,
      migrationTableSchema: finalMigrationSchema,
      migrationLockTableName: '__kysely_migrations_lock',
      migrationTableName: '__kysely_migrations',
      provider: {
        // eslint-disable-next-line @typescript-eslint/require-await
        async getMigrations() {
          return migrations;
        },
      },
    });

    const { error, results } = await migrator.migrateToLatest();

    results?.forEach((it) => {
      if (it.status === 'Success') {
        console.log(`migration "${it.migrationName}" was executed successfully`);
      } else if (it.status === 'Error') {
        console.error(`failed to execute migration "${it.migrationName}"`);
      }
    });

    if (error) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw error;
    }
  } catch (e) {
    console.error('failed to migrate');
    console.error(e);
    throw e;
  } finally {
    await db.destroy();
  }
}
