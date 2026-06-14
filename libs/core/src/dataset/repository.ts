import { eq } from 'drizzle-orm';
import { type Db, datasetsTable } from '@rfjs/db';
import type { Dataset, CreateDatasetInput } from './schema';

export interface DatasetRepository {
  list(): Promise<Dataset[]>;
  getById(id: string): Promise<Dataset | undefined>;
  create(input: CreateDatasetInput): Promise<Dataset>;
}

const toDataset = (row: typeof datasetsTable.$inferSelect): Dataset => ({
  id: row.id,
  name: row.name,
  description: row.description,
  data: row.data,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const makeDatasetRepository = (db: Db): DatasetRepository => ({
  async list() {
    const rows = await db.select().from(datasetsTable);
    return rows.map(toDataset);
  },
  async getById(id) {
    const rows = await db.select().from(datasetsTable).where(eq(datasetsTable.id, id));
    return rows[0] ? toDataset(rows[0]) : undefined;
  },
  async create(input) {
    const [row] = await db
      .insert(datasetsTable)
      .values({
        name: input.name,
        description: input.description ?? null,
        data: input.data,
      })
      .returning();
    return toDataset(row);
  },
});
