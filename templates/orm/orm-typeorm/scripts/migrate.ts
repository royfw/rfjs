import 'reflect-metadata';
import 'dotenv/config';
import { migrateToLatest } from '@/scripts/migrate-to-latest';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }

  await migrateToLatest({
    connectionString,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
