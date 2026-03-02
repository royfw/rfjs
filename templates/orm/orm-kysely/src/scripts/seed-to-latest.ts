import { SCHEMA } from '@/consts';
import { createDb } from '@/db';
import { getConnectionStringInfo } from '@/utils';
import { checkAndCreateDB } from './check-and-create-db';
import { checkAndCreateSchema } from './check-and-create-schema';
import {
  checkSeedExecuted,
  ensureSeedHistoryTable,
  recordSeedExecution,
} from './seed-history';
import { seedRecords } from '@/seeds';

export async function seedToLatest(
  connectionString: string,
  defaultSchema = SCHEMA,
): Promise<void> {
  const { finalConnectionString, finalSchema, optionsSchemas } = getConnectionStringInfo(
    connectionString,
    defaultSchema,
  );
  // Use pg-connection-string for more robust parsing and to generate admin connection string
  // Default fallback
  const schemas: Set<string> = new Set();
  schemas.add(finalSchema);
  optionsSchemas.forEach((i) => schemas.add(i));
  console.log('Get schemas: ', Array.from(schemas.values()));

  await checkAndCreateDB(finalConnectionString);
  await checkAndCreateSchema(finalConnectionString, Array.from(schemas.values()));

  await runSeeds(finalConnectionString);
}

async function runSeeds(connectionString: string) {
  let isInitialized = false;
  const { db, client } = createDb(connectionString);
  try {
    isInitialized = true;
    await ensureSeedHistoryTable(client);

    console.log('Running seeds...');

    for (const [key, seed] of Object.entries(seedRecords)) {
      if (await checkSeedExecuted(client, key)) {
        console.log(`Seed ${key} already executed. Skipping...`);
        continue;
      }

      console.log(`Seeding ${key}...`);
      await seed(db);
      await recordSeedExecution(client, key);
    }

    console.log('Seeds completed successfully.');
  } catch (e) {
    console.error('Seeding failed!');
    console.error(e);
    throw e;
  } finally {
    if (isInitialized) {
      await db.destroy();
    }
  }
}
