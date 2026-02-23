import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { seedToLatest } from '@/scripts';

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }

  await seedToLatest(connectionString);
}

main().catch((err) => {
  console.error('Seed failed!');
  console.error(err);
  process.exit(1);
});
