import 'dotenv/config';
import { runSeedDatasets } from '@/scripts/seed-datasets';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

runSeedDatasets(connectionString).catch((e) => {
  console.error(e);
  process.exit(1);
});
