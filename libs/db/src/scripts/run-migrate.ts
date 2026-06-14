import 'dotenv/config';
import { migrateToLatest } from '@/scripts/migrate-to-latest';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

migrateToLatest({ connectionString })
  .then(() => console.log('Migrations completed.'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
