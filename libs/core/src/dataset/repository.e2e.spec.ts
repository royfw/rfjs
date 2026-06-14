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

  it('filters by a data jsonb field via jsonb-query', async () => {
    await repo.create({ name: 'APAC', data: { region: 'apac' } });
    await repo.create({ name: 'EMEA', data: { region: 'emea' } });
    const results = await repo.search({
      logic: 'and',
      filters: [{ field: 'region', dataType: 'string', operator: 'eq', value: 'apac' }],
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((d) => d.data.region === 'apac')).toBe(true);
    expect(results.some((d) => d.data.region === 'emea')).toBe(false);
  });
});
