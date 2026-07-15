import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDb, migrateToLatest } from '@rfjs/db';
import type { Pool } from 'pg';
import { makeDatasetRepository } from './repository';

const CONN =
  process.env.TEST_DATABASE_URL ??
  'postgresql://user:password@localhost:5433/workbench?options=-csearch_path=workbench';

// process.cwd() is libs/core when running `pnpm --filter @rfjs/core vitest:e2e:run`
const MIGRATIONS_FOLDER = path.resolve(process.cwd(), '../db/drizzle');

describe('makeDatasetRepository (real PG)', () => {
  let pool: Pool;
  let repo: ReturnType<typeof makeDatasetRepository>;

  beforeAll(async () => {
    await migrateToLatest({ connectionString: CONN, migrationsFolder: MIGRATIONS_FOLDER });
    const created = createDb(CONN);
    pool = created.pool;
    repo = makeDatasetRepository(created.db);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('creates a dataset and reads it back by id', async () => {
    const created = await repo.create({ name: 'IT', data: { a: 1 } });
    expect(created.id).toBeTypeOf('string');
    const found = await repo.getById(created.id);
    expect(found?.name).toBe('IT');
    expect(found?.data).toEqual({ a: 1 });
  });

  it('lists datasets', async () => {
    await repo.create({ name: 'L1', data: {} });
    const all = await repo.list();
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it('queries with mixed column + jsonb filter, sort, pagination, and total', async () => {
    await repo.create({ name: 'APAC-1', data: { region: 'apac', score: 90 } });
    await repo.create({ name: 'APAC-2', data: { region: 'apac', score: 10 } });
    await repo.create({ name: 'EMEA-1', data: { region: 'emea', score: 99 } });

    const { items, total } = await repo.query({
      filter: {
        logic: 'and',
        filters: [
          { target: 'column', column: 'name', operator: 'startswith', value: 'APAC' },
          { target: 'jsonb', field: 'region', dataType: 'string', operator: 'eq', value: 'apac' },
        ],
      },
      sort: [{ target: 'jsonb', field: 'score', dataType: 'numeric', direction: 'desc' }],
      page: 1,
      pageSize: 1,
    });

    expect(total).toBeGreaterThanOrEqual(2); // at least the two APAC rows match the WHERE
    expect(items).toHaveLength(1); // pageSize 1
    expect(items[0].name).toBe('APAC-1'); // score 90 sorts before 10
    expect(items.every((d) => d.data.region === 'apac')).toBe(true);
  });
});
