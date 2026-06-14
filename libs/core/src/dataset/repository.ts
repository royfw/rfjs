import { eq } from 'drizzle-orm';
import { buildJsonbQuery, type JsonbFilterGroup } from '@rfjs/jsonb-query';
import { type Db, datasetsTable } from '@rfjs/db';
import type { Dataset, CreateDatasetInput } from './schema';

export interface DatasetRepository {
  list(): Promise<Dataset[]>;
  getById(id: string): Promise<Dataset | undefined>;
  create(input: CreateDatasetInput): Promise<Dataset>;
  search(filter: JsonbFilterGroup): Promise<Dataset[]>;
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
  async search(filter) {
    const { where, values } = buildJsonbQuery('data', filter, { dialect: 'jsonpath' });
    const { rows } = await db.$client.query(
      `SELECT dataset_id AS id, name, description, data,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM datasets WHERE ${where}`,
      values,
    );
    return (rows as (typeof datasetsTable.$inferSelect)[]).map(toDataset);
  },
});
