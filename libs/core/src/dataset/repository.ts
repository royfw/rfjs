import { eq } from 'drizzle-orm';
import { buildPgFilter, type PgFilterConfig, type PgFilterInput } from '@rfjs/pg-filter';
import { type Db, datasetsTable } from '@rfjs/db';
import type { Dataset, CreateDatasetInput } from './schema';

export interface DatasetRepository {
  list(): Promise<Dataset[]>;
  getById(id: string): Promise<Dataset | undefined>;
  create(input: CreateDatasetInput): Promise<Dataset>;
  query(input: PgFilterInput): Promise<{ items: Dataset[]; total: number }>;
}

const datasetPgConfig: PgFilterConfig = {
  columns: {
    id: { column: 'dataset_id', type: 'uuid' },
    name: { column: 'name', type: 'text' },
    description: { column: 'description', type: 'text' },
    createdAt: { column: 'created_at', type: 'timestamp' },
    updatedAt: { column: 'updated_at', type: 'timestamp' },
  },
  jsonb: { column: 'data', dialect: 'jsonpath' },
};

// Stable tiebreaker → deterministic LIMIT/OFFSET; also the default order.
const TIEBREAKER: PgFilterInput['sort'] = [
  { target: 'column', column: 'createdAt', direction: 'desc' },
  { target: 'column', column: 'id', direction: 'asc' },
];

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
  async query(input) {
    const effective: PgFilterInput = {
      filter: input.filter,
      sort: [...(input.sort ?? []), ...TIEBREAKER],
      page: input.page,
      pageSize: input.pageSize,
    };
    const { where, orderBy, limit, offset, values, countValues } = buildPgFilter(datasetPgConfig, effective);
    const orderByClause = orderBy ? ` ORDER BY ${orderBy}` : '';
    const limitClause = limit !== undefined ? ` LIMIT ${limit}` : '';
    const offsetClause = offset !== undefined ? ` OFFSET ${offset}` : '';

    const { rows } = await db.$client.query(
      `SELECT dataset_id AS id, name, description, data,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM datasets WHERE ${where}${orderByClause}${limitClause}${offsetClause}`,
      values,
    );
    const countResult = await db.$client.query(
      `SELECT COUNT(*)::int AS total FROM datasets WHERE ${where}`,
      countValues,
    );
    const total = (countResult.rows[0] as { total: number }).total;
    return { items: (rows as (typeof datasetsTable.$inferSelect)[]).map(toDataset), total };
  },
});
