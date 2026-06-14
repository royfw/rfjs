import { createDb, type Db } from '@/db';
import { datasetsTable } from '@/schema';

export const DEMO_DATASETS = [
  { name: 'Sales — Q1', description: 'Demo seed', data: { region: 'apac', rows: 120 } },
  { name: 'Signups', description: 'Demo seed', data: { region: 'emea', rows: 42 } },
] satisfies { name: string; description: string; data: Record<string, unknown> }[];

export async function seedDatasets(db: Db): Promise<number> {
  const inserted = await db.insert(datasetsTable).values(DEMO_DATASETS).returning();
  return inserted.length;
}

export async function runSeedDatasets(connectionString: string): Promise<void> {
  const { pool, db } = createDb(connectionString);
  try {
    const n = await seedDatasets(db);
    console.log(`Seeded ${n} datasets.`);
  } finally {
    await pool.end();
  }
}
