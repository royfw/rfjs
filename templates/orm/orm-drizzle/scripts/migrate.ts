import * as dotenv from 'dotenv';
import { migrateToLatest } from '@/scripts';

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }

  await migrateToLatest({
    connectionString,
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Migration failed!');
    console.error(err);
    process.exit(1);
  });
}
