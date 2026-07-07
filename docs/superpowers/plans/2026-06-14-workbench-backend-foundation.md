# Workbench Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a copyable, production-grade backend foundation for `apps/workbench`, proven end-to-end by a `datasets` CRUD vertical slice (DB → repository → usecase → API → frontend).

**Architecture:** Runtime-agnostic business logic in `libs/` (light-functional: factory functions + explicit dependency injection); `apps/api` is a thin Fastify shell that calls usecases; `apps/workbench` is a pure frontend calling `apps/api` over HTTP. Two libs: `libs/db` (Drizzle plumbing — connection, schema, migrations, seed) and `libs/core` (per-module `schema` + `repository` + `usecase`).

**Tech Stack:** TypeScript 5.7+, Drizzle ORM (node-postgres), Postgres, zod, Fastify 5, Next.js 16, Vitest, pnpm workspace + Turborepo, tsdown. `@rfjs/*` applied: `pg-toolkit` (db/schema bootstrap), `jsonb-query` (filter the `data` jsonb column), `retry` (later).

**Spec:** `docs/superpowers/specs/2026-06-14-workbench-backend-foundation-design.md`

---

## Scaffolding note (read before Task 1)

The spec says "scaffold `libs/db` from the start-ts-by `orm-drizzle` template, leaving the demo `libs/orm-drizzle` untouched." The `start-ts-by` CLI produces a **standalone** project (own `pnpm-workspace.yaml`, lockfile, `dist/`, `docs/`) — not a workspace-native lib. The existing `libs/orm-drizzle` **is** that exact template already adapted into a workspace lib. Therefore this plan creates `libs/db` by **following the `libs/orm-drizzle` structure** (the workspace-native form of the template) and changing only names/identifiers. This honours the intent (same template lineage) without dragging standalone-project cruft into the monorepo. `libs/orm-drizzle` is never modified.

## File Structure

**`libs/db/`** (new — Drizzle plumbing)
- `package.json` — `@rfjs/db`, deps: `drizzle-orm`, `pg`, `pg-connection-string`, `tslib`; devDeps: `drizzle-kit`, `tsdown`, `vitest`, `typescript`, `tsx`, `dotenv`.
- `tsconfig.json`, `tsdown.config.ts`, `vitest.config.mts`, `vitest.config.e2e.mts`, `drizzle.config.ts`, `.env.example`
- `src/consts.ts` — `DATABASE`, `SCHEMA`
- `src/db.ts` — `createDb` / `createDbByClient` (+ exported `Db` type)
- `src/type.ts` — `MigrateToLatestParams`
- `src/utils/` — `get-connection-string-info.ts`, `get-options-schemas.ts`, `index.ts`
- `src/schema/index.ts` — barrel
- `src/schema/datasets/table.ts` — `datasetsTable`
- `src/schema/datasets/index.ts` — barrel
- `src/scripts/` — `check-and-create-db.ts`, `check-and-create-schema.ts`, `migrate-to-latest.ts`, `seed-datasets.ts`, `index.ts`
- `src/index.ts` — package barrel
- `drizzle/` — generated migration SQL + meta

**`libs/core/`** (new — repository + usecase)
- `package.json` — `@rfjs/core`, deps: `@rfjs/db` (workspace:\*), `@rfjs/jsonb-query` (workspace:\*), `zod`, `tslib`; devDeps: `tsdown`, `vitest`, `typescript`.
- `tsconfig.json`, `tsdown.config.ts`, `vitest.config.mts`, `vitest.config.e2e.mts`
- `src/dataset/schema.ts` — zod contracts + inferred types
- `src/dataset/repository.ts` — `makeDatasetRepository(db)` + `DatasetRepository` interface
- `src/dataset/repository.e2e.spec.ts` — real-PG integration test
- `src/dataset/usecase/create-dataset.ts` + `.spec.ts`
- `src/dataset/usecase/list-datasets.ts` + `.spec.ts`
- `src/dataset/usecase/get-dataset.ts` + `.spec.ts`
- `src/dataset/usecase/index.ts` — barrel
- `src/dataset/index.ts` — module barrel
- `src/index.ts` — package barrel

**`apps/api/`** (modify — add dataset module + composition root)
- `src/configs.ts` — add `databaseUrl`
- `src/infrastructures/datasource/index.ts` (new) — composition root: build `db` + `datasetRepository` + dataset usecases once
- `src/delivery/http/dataset/routes.ts`, `handlers/dataset.handler.ts`, `handlers/index.ts`, `module.ts`, `index.ts` (new)
- `src/delivery/http/index.ts` — export the new module (auto-registered)
- `package.json` — add `@rfjs/core`, `@rfjs/db` deps
- `src/delivery/http/dataset/dataset.route.spec.ts` (new) — `app.inject()` route test

**`apps/workbench/`** (modify — datasets page)
- `src/app/[locale]/(shell)/datasets/page.tsx` — fetch list from API
- `.env.example` — `API_BASE_URL`

**Root** (modify)
- `docker-compose.test.yml` (new) — Postgres for the integration tier

---

## Phase A — `libs/db` (Drizzle plumbing + datasets table)

### Task 1: Create `libs/db` package skeleton

**Files:**
- Create: `libs/db/package.json`, `libs/db/tsconfig.json`, `libs/db/tsdown.config.ts`, `libs/db/vitest.config.mts`, `libs/db/.env.example`
- Create: `libs/db/src/consts.ts`, `libs/db/src/db.ts`, `libs/db/src/type.ts`, `libs/db/src/index.ts`
- Create: `libs/db/src/utils/get-connection-string-info.ts`, `libs/db/src/utils/get-options-schemas.ts`, `libs/db/src/utils/index.ts`
- Create: `libs/db/src/schema/index.ts`

- [ ] **Step 1: Copy structural files from `libs/orm-drizzle`**

These files are identical in intent; copy verbatim, then we only change identifiers in later steps:

```bash
mkdir -p libs/db/src/utils libs/db/src/schema libs/db/src/scripts
cp libs/orm-drizzle/tsconfig.json libs/db/tsconfig.json
cp libs/orm-drizzle/tsdown.config.ts libs/db/tsdown.config.ts
cp libs/orm-drizzle/vitest.config.mts libs/db/vitest.config.mts
cp libs/orm-drizzle/src/type.ts libs/db/src/type.ts
cp libs/orm-drizzle/src/utils/get-connection-string-info.ts libs/db/src/utils/get-connection-string-info.ts
cp libs/orm-drizzle/src/utils/get-options-schemas.ts libs/db/src/utils/get-options-schemas.ts
cp libs/orm-drizzle/src/utils/index.ts libs/db/src/utils/index.ts
```

- [ ] **Step 2: Write `libs/db/package.json`**

Mirror `libs/orm-drizzle/package.json`'s top fields exactly (no `"type"`, no `"exports"` — its proven tsdown dual-output shape):

```json
{
  "name": "@rfjs/db",
  "version": "0.0.0",
  "description": "Workbench Drizzle plumbing: connection, schema, migrations, seed",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "private": true,
  "scripts": {
    "clean": "pnpm exec rimraf ./dist ./types",
    "build": "pnpm run clean && tsdown --config-loader unrun",
    "typecheck": "tsc --noEmit",
    "generate": "pnpm exec drizzle-kit generate",
    "migrate": "pnpm exec tsx src/scripts/run-migrate.ts",
    "seed": "pnpm exec tsx src/scripts/run-seed.ts",
    "lint": "eslint \"src/**/*.ts\"",
    "test": "vitest --passWithNoTests --run",
    "vitest:run": "vitest --passWithNoTests --run",
    "vitest:e2e:run": "vitest --config vitest.config.e2e.mts --passWithNoTests --run"
  },
  "dependencies": {
    "drizzle-orm": "^0.45.1",
    "pg": "^8.16.3",
    "pg-connection-string": "^2.7.0",
    "tslib": "^2.8.1"
  },
  "devDependencies": {
    "@types/pg": "^8.16.0",
    "dotenv": "^17.2.3",
    "drizzle-kit": "^0.31.8",
    "rimraf": "^6.0.1",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3",
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 3: Write `libs/db/src/consts.ts`** (workbench identifiers, not the demo's)

```ts
export const SCHEMA = 'workbench';
export const DATABASE = 'workbench';
```

- [ ] **Step 4: Write `libs/db/src/db.ts`** (same as orm-drizzle, plus an exported `Db` type the repository will use)

```ts
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Client, Pool } from 'pg';
import * as schema from './schema';
import { getConnectionStringInfo } from './utils';

export type Schema = typeof schema;
export type Db = NodePgDatabase<Schema>;

export function createDb(
  connectionString: string,
  targetSchema?: string,
  useClient = false,
): { pool: Pool; client: Client; db: Db; hasSearchPath: boolean } {
  const { finalConnectionString, hasSearchPath } = getConnectionStringInfo(
    connectionString,
    targetSchema,
  );
  const pool = new Pool({ connectionString: finalConnectionString });
  const client = new Client({ connectionString: finalConnectionString });
  const db = drizzle(useClient ? client : pool, { schema });
  return { pool, client, db, hasSearchPath };
}

export function createDbByClient(
  connectionString: string,
  targetSchema?: string,
): { client: Client; db: Db; hasSearchPath: boolean } {
  const { finalConnectionString, hasSearchPath } = getConnectionStringInfo(
    connectionString,
    targetSchema,
  );
  const client = new Client({ connectionString: finalConnectionString });
  const db = drizzle(client, { schema });
  return { client, db, hasSearchPath };
}
```

- [ ] **Step 5: Write `libs/db/src/schema/index.ts`** (datasets added in Task 2)

```ts
export * from './datasets';
```

- [ ] **Step 6: Write `libs/db/src/index.ts`**

```ts
export * from './db';
export * from './schema';
export * from './consts';
export * from './type';
export * from './scripts';
```

- [ ] **Step 7: Write `libs/db/.env.example`**

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/workbench?options=-csearch_path=workbench"
```

- [ ] **Step 8: Install and typecheck** (schema/datasets + scripts referenced by barrels are created in Tasks 2–3; until then this step will fail on missing `./datasets` and `./scripts` — that is expected and resolved by Task 3. To verify Task 1 in isolation, temporarily comment the `./datasets` and `./scripts` re-exports, run the check, then restore.)

Run: `pnpm install && pnpm --filter @rfjs/db typecheck`
Expected: PASS once Tasks 2–3 complete; in isolation, PASS with the two barrel lines temporarily commented.

- [ ] **Step 9: Commit**

```bash
git add libs/db pnpm-lock.yaml
git commit -m "feat(db): scaffold @rfjs/db package skeleton (drizzle plumbing)"
```

---

### Task 2: `datasets` table schema

**Files:**
- Create: `libs/db/src/schema/datasets/table.ts`
- Create: `libs/db/src/schema/datasets/index.ts`
- Test: `libs/db/src/schema/datasets/table.spec.ts`

- [ ] **Step 1: Write the failing test**

`libs/db/src/schema/datasets/table.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { datasetsTable } from './table';

describe('datasetsTable', () => {
  it('maps to the "datasets" table with the expected columns', () => {
    const config = getTableConfig(datasetsTable);
    expect(config.name).toBe('datasets');
    const columns = config.columns.map((c) => c.name).sort();
    expect(columns).toEqual(
      ['created_at', 'data', 'dataset_id', 'description', 'name', 'updated_at'].sort(),
    );
  });

  it('makes name NOT NULL and id the primary key', () => {
    const config = getTableConfig(datasetsTable);
    const name = config.columns.find((c) => c.name === 'name');
    const id = config.columns.find((c) => c.name === 'dataset_id');
    expect(name?.notNull).toBe(true);
    expect(id?.primary).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rfjs/db vitest:run`
Expected: FAIL — `Cannot find module './table'`.

- [ ] **Step 3: Write `libs/db/src/schema/datasets/table.ts`**

```ts
import { pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';

export const datasetsTable = pgTable('datasets', {
  id: uuid('dataset_id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type DatasetRow = typeof datasetsTable.$inferSelect;
export type NewDatasetRow = typeof datasetsTable.$inferInsert;
```

- [ ] **Step 4: Write `libs/db/src/schema/datasets/index.ts`**

```ts
export * from './table';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @rfjs/db vitest:run`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add libs/db/src/schema/datasets
git commit -m "feat(db): add datasets table schema"
```

---

### Task 3: drizzle.config, migration, scripts, seed

**Files:**
- Create: `libs/db/drizzle.config.ts`
- Create: `libs/db/src/scripts/check-and-create-db.ts`, `check-and-create-schema.ts`, `migrate-to-latest.ts`, `seed-datasets.ts`, `run-migrate.ts`, `run-seed.ts`, `index.ts`
- Generate: `libs/db/drizzle/*` (migration SQL + meta)

- [ ] **Step 1: Copy the two bootstrap scripts from `libs/orm-drizzle`** (`@rfjs/pg-toolkit` covers DB/schema admin; these scripts are the proven inline form and stay self-contained for the lib)

```bash
cp libs/orm-drizzle/src/scripts/check-and-create-db.ts libs/db/src/scripts/check-and-create-db.ts
cp libs/orm-drizzle/src/scripts/check-and-create-schema.ts libs/db/src/scripts/check-and-create-schema.ts
```

Then edit `libs/db/src/scripts/check-and-create-db.ts`: change the fallback `const targetDb = database ?? 'orm';` to `const targetDb = database ?? 'workbench';`.

- [ ] **Step 2: Write `libs/db/src/scripts/migrate-to-latest.ts`**

```ts
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDbByClient } from '../db';
import { checkAndCreateDB } from './check-and-create-db';
import { checkAndCreateSchema } from './check-and-create-schema';
import { SCHEMA } from '../consts';
import { getConnectionStringInfo } from '../utils';
import { MigrateToLatestParams } from '../type';

export async function migrateToLatest(params: MigrateToLatestParams): Promise<void> {
  const { connectionString, schema = SCHEMA, migrationsFolder = 'drizzle' } = params;
  const { finalConnectionString, finalSchema } = getConnectionStringInfo(
    connectionString,
    schema,
  );

  await checkAndCreateDB(finalConnectionString);
  await checkAndCreateSchema(finalConnectionString, [finalSchema]);

  const { client, db } = createDbByClient(finalConnectionString);
  let connected = false;
  try {
    await client.connect();
    connected = true;
    await migrate(db, { migrationsFolder, migrationsSchema: finalSchema });
  } finally {
    if (connected) await client.end();
  }
}
```

- [ ] **Step 3: Write `libs/db/src/scripts/seed-datasets.ts`**

```ts
import { createDb, type Db } from '../db';
import { datasetsTable } from '../schema';

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
```

- [ ] **Step 4: Write the two CLI entrypoints**

`libs/db/src/scripts/run-migrate.ts`:

```ts
import 'dotenv/config';
import { migrateToLatest } from './migrate-to-latest';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

migrateToLatest({ connectionString })
  .then(() => console.log('Migrations completed.'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

`libs/db/src/scripts/run-seed.ts`:

```ts
import 'dotenv/config';
import { runSeedDatasets } from './seed-datasets';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

runSeedDatasets(connectionString).catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 5: Write `libs/db/src/scripts/index.ts`**

```ts
export * from './check-and-create-db';
export * from './check-and-create-schema';
export * from './migrate-to-latest';
export * from './seed-datasets';
```

- [ ] **Step 6: Write `libs/db/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';
import { SCHEMA } from './src/consts';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: [SCHEMA],
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 7: Generate the migration**

Run: `pnpm --filter @rfjs/db generate`
Expected: creates `libs/db/drizzle/0000_*.sql` containing `CREATE TABLE "workbench"."datasets"` and `libs/db/drizzle/meta/*`.

- [ ] **Step 8: Restore barrels and typecheck the whole package**

Ensure `src/index.ts` re-exports `./scripts` and `src/schema/index.ts` re-exports `./datasets` (uncomment if Task 1 Step 8 commented them).

Run: `pnpm --filter @rfjs/db typecheck && pnpm --filter @rfjs/db vitest:run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add libs/db
git commit -m "feat(db): migrations, bootstrap scripts, and datasets seed"
```

---

## Phase B — `libs/core` (repository + usecase)

### Task 4: Create `libs/core` package skeleton

**Files:**
- Create: `libs/core/package.json`, `libs/core/tsconfig.json`, `libs/core/tsdown.config.ts`, `libs/core/vitest.config.mts`, `libs/core/vitest.config.e2e.mts`
- Create: `libs/core/src/index.ts`

- [ ] **Step 1: Copy config files from `libs/db`**

```bash
mkdir -p libs/core/src/dataset/usecase
cp libs/db/tsconfig.json libs/core/tsconfig.json
cp libs/db/tsdown.config.ts libs/core/tsdown.config.ts
cp libs/db/vitest.config.mts libs/core/vitest.config.mts
```

- [ ] **Step 2: Write `libs/core/package.json`**

```json
{
  "name": "@rfjs/core",
  "version": "0.0.0",
  "description": "Workbench business logic: per-module schema, repository, usecase",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "private": true,
  "scripts": {
    "clean": "pnpm exec rimraf ./dist ./types",
    "build": "pnpm run clean && tsdown --config-loader unrun",
    "typecheck": "tsc --noEmit",
    "lint": "eslint \"src/**/*.ts\"",
    "test": "vitest --passWithNoTests --run",
    "vitest:run": "vitest --passWithNoTests --run",
    "vitest:e2e:run": "vitest --config vitest.config.e2e.mts --passWithNoTests --run"
  },
  "dependencies": {
    "@rfjs/db": "workspace:*",
    "@rfjs/jsonb-query": "workspace:*",
    "tslib": "^2.8.1",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "rimraf": "^6.0.1",
    "typescript": "^5.7.3",
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 3: Write `libs/core/vitest.config.e2e.mts`** (integration tier — only `*.e2e.spec.ts`)

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    include: ['src/**/*.e2e.spec.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
```

Also edit `libs/core/vitest.config.mts` `test.include` to **exclude** e2e: set `include: ['src/**/*.spec.ts']` and add `exclude: ['src/**/*.e2e.spec.ts', '**/node_modules/**']`.

- [ ] **Step 4: Write `libs/core/src/index.ts`**

```ts
export * from './dataset';
```

(The `./dataset` barrel is created in Task 9; comment this line until then, or accept a failing barrel resolution until Task 9.)

- [ ] **Step 5: Install**

Run: `pnpm install`
Expected: links `@rfjs/db` and `@rfjs/jsonb-query` into `@rfjs/core`.

- [ ] **Step 6: Commit**

```bash
git add libs/core pnpm-lock.yaml
git commit -m "feat(core): scaffold @rfjs/core package skeleton"
```

---

### Task 5: dataset zod schema (the contract / initial domain)

**Files:**
- Create: `libs/core/src/dataset/schema.ts`
- Test: `libs/core/src/dataset/schema.spec.ts`

- [ ] **Step 1: Write the failing test**

`libs/core/src/dataset/schema.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CreateDatasetInputSchema } from './schema';

describe('CreateDatasetInputSchema', () => {
  it('accepts a valid input and defaults data to {}', () => {
    const parsed = CreateDatasetInputSchema.parse({ name: 'X' });
    expect(parsed).toEqual({ name: 'X', description: undefined, data: {} });
  });

  it('rejects an empty name', () => {
    expect(() => CreateDatasetInputSchema.parse({ name: '' })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rfjs/core vitest:run`
Expected: FAIL — `Cannot find module './schema'`.

- [ ] **Step 3: Write `libs/core/src/dataset/schema.ts`**

```ts
import { z } from 'zod';

// NOTE: this repo is on zod v4 — z.record requires explicit key + value schemas.
export const DatasetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  data: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Dataset = z.infer<typeof DatasetSchema>;

export const CreateDatasetInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});
export type CreateDatasetInput = z.infer<typeof CreateDatasetInputSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rfjs/core vitest:run`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/core/src/dataset/schema.ts libs/core/src/dataset/schema.spec.ts
git commit -m "feat(core): dataset zod schema (contract)"
```

---

### Task 6: dataset repository (over `@rfjs/db`) + real-PG integration test

**Files:**
- Create: `libs/core/src/dataset/repository.ts`
- Create: `docker-compose.test.yml` (repo root)
- Test: `libs/core/src/dataset/repository.e2e.spec.ts`

- [ ] **Step 1: Write `docker-compose.test.yml`** (repo root)

```yaml
services:
  postgres-test:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: postgres
    ports:
      - '5433:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U user']
      interval: 2s
      timeout: 5s
      retries: 10
```

- [ ] **Step 2: Write the failing integration test**

`libs/core/src/dataset/repository.e2e.spec.ts`:

```ts
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDb, migrateToLatest } from '@rfjs/db';
import type { Pool } from 'pg';
import { makeDatasetRepository } from './repository';

const CONN =
  process.env.TEST_DATABASE_URL ??
  'postgresql://user:password@localhost:5433/workbench?options=-csearch_path=workbench';

// libs/core/src/dataset -> ../../../db/drizzle === libs/db/drizzle
const MIGRATIONS_FOLDER = path.resolve(__dirname, '../../../db/drizzle');

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
    const created = await repo.create({ name: 'IT', description: null, data: { a: 1 } });
    expect(created.id).toBeTypeOf('string');
    const found = await repo.getById(created.id);
    expect(found?.name).toBe('IT');
    expect(found?.data).toEqual({ a: 1 });
  });

  it('lists datasets', async () => {
    await repo.create({ name: 'L1', description: null, data: {} });
    const all = await repo.list();
    expect(all.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @rfjs/core vitest:e2e:run`
Expected: FAIL — `Cannot find module './repository'`.

- [ ] **Step 4: Write `libs/core/src/dataset/repository.ts`**

```ts
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
```

- [ ] **Step 5: Build `@rfjs/db` (the e2e test imports it as a built dep), then run the integration test with Postgres up**

```bash
pnpm --filter @rfjs/db build
docker compose -f docker-compose.test.yml up -d
pnpm --filter @rfjs/core vitest:e2e:run
docker compose -f docker-compose.test.yml down
```

Expected: PASS (2 tests). (Document: requires Docker; not part of the default `pnpm test` unit tier. `@rfjs/db` is consumed via its built `dist/`, so it must be built first — the usecase unit tests in Tasks 7–8 only `import type` from it and need no build.)

- [ ] **Step 6: Commit**

```bash
git add libs/core/src/dataset/repository.ts libs/core/src/dataset/repository.e2e.spec.ts docker-compose.test.yml
git commit -m "feat(core): dataset repository over @rfjs/db (+ real-PG integration test)"
```

---

### Task 7: `create-dataset` usecase (fake-repo unit test)

**Files:**
- Create: `libs/core/src/dataset/usecase/create-dataset.ts`
- Test: `libs/core/src/dataset/usecase/create-dataset.spec.ts`

- [ ] **Step 1: Write the failing test**

`libs/core/src/dataset/usecase/create-dataset.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeCreateDataset } from './create-dataset';
import type { DatasetRepository } from '../repository';
import type { Dataset } from '../schema';

const fakeDataset: Dataset = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'X',
  description: null,
  data: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('makeCreateDataset', () => {
  it('validates input then delegates to repository.create', async () => {
    const repo: DatasetRepository = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn().mockResolvedValue(fakeDataset),
    };
    const createDataset = makeCreateDataset({ repo });
    const result = await createDataset({ name: 'X' });
    expect(repo.create).toHaveBeenCalledWith({ name: 'X', description: undefined, data: {} });
    expect(result).toBe(fakeDataset);
  });

  it('throws on invalid input without calling the repository', async () => {
    const repo: DatasetRepository = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
    };
    const createDataset = makeCreateDataset({ repo });
    await expect(createDataset({ name: '' })).rejects.toThrow();
    expect(repo.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rfjs/core vitest:run`
Expected: FAIL — `Cannot find module './create-dataset'`.

- [ ] **Step 3: Write `libs/core/src/dataset/usecase/create-dataset.ts`**

```ts
import { CreateDatasetInputSchema, type Dataset } from '../schema';
import type { DatasetRepository } from '../repository';

export const makeCreateDataset =
  (deps: { repo: DatasetRepository }) =>
  async (input: unknown): Promise<Dataset> => {
    const parsed = CreateDatasetInputSchema.parse(input);
    return deps.repo.create(parsed);
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rfjs/core vitest:run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/core/src/dataset/usecase/create-dataset.ts libs/core/src/dataset/usecase/create-dataset.spec.ts
git commit -m "feat(core): create-dataset usecase"
```

---

### Task 8: `list-datasets` + `get-dataset` usecases

**Files:**
- Create: `libs/core/src/dataset/usecase/list-datasets.ts`, `get-dataset.ts`
- Test: `libs/core/src/dataset/usecase/list-datasets.spec.ts`, `get-dataset.spec.ts`

- [ ] **Step 1: Write the failing tests**

`libs/core/src/dataset/usecase/list-datasets.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeListDatasets } from './list-datasets';
import type { DatasetRepository } from '../repository';

describe('makeListDatasets', () => {
  it('returns whatever the repository lists', async () => {
    const repo = { list: vi.fn().mockResolvedValue([]), getById: vi.fn(), create: vi.fn() } satisfies DatasetRepository;
    const listDatasets = makeListDatasets({ repo });
    expect(await listDatasets()).toEqual([]);
    expect(repo.list).toHaveBeenCalledOnce();
  });
});
```

`libs/core/src/dataset/usecase/get-dataset.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeGetDataset } from './get-dataset';
import type { DatasetRepository } from '../repository';

describe('makeGetDataset', () => {
  it('delegates to repository.getById', async () => {
    const repo = { list: vi.fn(), getById: vi.fn().mockResolvedValue(undefined), create: vi.fn() } satisfies DatasetRepository;
    const getDataset = makeGetDataset({ repo });
    expect(await getDataset('abc')).toBeUndefined();
    expect(repo.getById).toHaveBeenCalledWith('abc');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rfjs/core vitest:run`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the implementations**

`libs/core/src/dataset/usecase/list-datasets.ts`:

```ts
import type { Dataset } from '../schema';
import type { DatasetRepository } from '../repository';

export const makeListDatasets =
  (deps: { repo: DatasetRepository }) =>
  (): Promise<Dataset[]> =>
    deps.repo.list();
```

`libs/core/src/dataset/usecase/get-dataset.ts`:

```ts
import type { Dataset } from '../schema';
import type { DatasetRepository } from '../repository';

export const makeGetDataset =
  (deps: { repo: DatasetRepository }) =>
  (id: string): Promise<Dataset | undefined> =>
    deps.repo.getById(id);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @rfjs/core vitest:run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/core/src/dataset/usecase/list-datasets.ts libs/core/src/dataset/usecase/list-datasets.spec.ts libs/core/src/dataset/usecase/get-dataset.ts libs/core/src/dataset/usecase/get-dataset.spec.ts
git commit -m "feat(core): list-datasets and get-dataset usecases"
```

---

### Task 9: dataset module + package barrels

**Files:**
- Create: `libs/core/src/dataset/usecase/index.ts`, `libs/core/src/dataset/index.ts`
- Modify: `libs/core/src/index.ts` (uncomment `./dataset` if commented in Task 4)

- [ ] **Step 1: Write `libs/core/src/dataset/usecase/index.ts`**

```ts
export * from './create-dataset';
export * from './list-datasets';
export * from './get-dataset';
```

- [ ] **Step 2: Write `libs/core/src/dataset/index.ts`**

```ts
export * from './schema';
export * from './repository';
export * from './usecase';
```

- [ ] **Step 3: Ensure `libs/core/src/index.ts` exports the module**

```ts
export * from './dataset';
```

- [ ] **Step 4: Typecheck, build, and run the unit tier**

Run: `pnpm --filter @rfjs/core typecheck && pnpm --filter @rfjs/core build && pnpm --filter @rfjs/core vitest:run`
Expected: PASS (all unit specs; e2e excluded).

- [ ] **Step 5: Commit**

```bash
git add libs/core/src
git commit -m "feat(core): dataset module barrels and package export"
```

---

## Phase C — `apps/api` dataset module

### Task 10: composition root + configs

**Files:**
- Modify: `apps/api/src/configs.ts`
- Create: `apps/api/src/infrastructures/datasource/index.ts`
- Modify: `apps/api/package.json` (add deps), `apps/api/.env.example` (add `DATABASE_URL`)

- [ ] **Step 1: Add deps to `apps/api/package.json`**

Add to `dependencies`: `"@rfjs/core": "workspace:*"`, `"@rfjs/db": "workspace:*"`. Then:

Run: `pnpm install`
Expected: links both libs into `apps/api`.

- [ ] **Step 2: Add `databaseUrl` to `apps/api/src/configs.ts`**

Add to the `AppConfig` interface: `databaseUrl: string;`
Add to the `configs` object:

```ts
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://user:password@localhost:5432/workbench?options=-csearch_path=workbench',
```

Add to `apps/api/.env.example`:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/workbench?options=-csearch_path=workbench"
```

- [ ] **Step 3: Write the composition root** `apps/api/src/infrastructures/datasource/index.ts`

```ts
import { createDb } from '@rfjs/db';
import {
  makeDatasetRepository,
  makeListDatasets,
  makeGetDataset,
  makeCreateDataset,
} from '@rfjs/core';
import { configs } from '@/configs';

const { db } = createDb(configs.databaseUrl);
const datasetRepository = makeDatasetRepository(db);

export const datasetUsecases = {
  list: makeListDatasets({ repo: datasetRepository }),
  get: makeGetDataset({ repo: datasetRepository }),
  create: makeCreateDataset({ repo: datasetRepository }),
};
```

- [ ] **Step 4: Build the libs (api consumes their built `dist/` types), then typecheck**

`apps/api` resolves `@rfjs/core` / `@rfjs/db` via their `dist/*.d.ts`, so build them first. The api typecheck script is `typecheck` (not `check-types`).

Run: `pnpm --filter @rfjs/db build && pnpm --filter @rfjs/core build && pnpm --filter api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/src/configs.ts apps/api/src/infrastructures/datasource apps/api/.env.example pnpm-lock.yaml
git commit -m "feat(api): wire @rfjs/core dataset usecases (composition root + db config)"
```

---

### Task 11: dataset HTTP module + route test

**Files:**
- Create: `apps/api/src/delivery/http/dataset/handlers/dataset.handler.ts`, `handlers/index.ts`, `routes.ts`, `module.ts`, `index.ts`
- Modify: `apps/api/src/delivery/http/index.ts`
- Test: `apps/api/src/delivery/http/dataset/dataset.route.spec.ts`

- [ ] **Step 1: Write the failing route test** (uses `app.inject()`; stubs the composition-root usecases via `vi.mock`)

`apps/api/src/delivery/http/dataset/dataset.route.spec.ts`:

```ts
import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('@/infrastructures/datasource', () => ({
  datasetUsecases: {
    list: vi.fn().mockResolvedValue([{ id: '1', name: 'A', description: null, data: {}, createdAt: new Date(), updatedAt: new Date() }]),
    get: vi.fn(),
    create: vi.fn().mockImplementation((input) => Promise.resolve({ id: '2', description: null, data: {}, createdAt: new Date(), updatedAt: new Date(), ...input })),
  },
}));

describe('dataset routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { initializeFastifyApp } = await import('@/infrastructures');
    const { datasetHttpRouteModule } = await import('./module');
    app = await initializeFastifyApp({
      httpRouteModules: [datasetHttpRouteModule],
      isApiDocEnabled: false,
    });
    await app.ready();
  });

  it('GET /datasets returns the list', async () => {
    const res = await app.inject({ method: 'GET', url: '/datasets' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('POST /datasets creates and returns 201', async () => {
    const res = await app.inject({ method: 'POST', url: '/datasets', payload: { name: 'New' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('New');
  });
});
```

`apps/api` already has `vitest.config.mts` (with the `@` → `./src` alias and `src/**/*.spec.(ts|js)` include) and a `vitest:run` script — no config changes needed.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api vitest:run`
Expected: FAIL — `Cannot find module './module'`.

- [ ] **Step 3: Write the handlers** `apps/api/src/delivery/http/dataset/handlers/dataset.handler.ts`

```ts
import { RouteHandlerMethod } from 'fastify/types/route';
import { datasetUsecases } from '@/infrastructures/datasource';

export const listDatasetsHandler: RouteHandlerMethod = async (_req, reply) => {
  reply.send(await datasetUsecases.list());
};

export const getDatasetHandler: RouteHandlerMethod = async (req, reply) => {
  const { id } = req.params as { id: string };
  const found = await datasetUsecases.get(id);
  if (!found) return reply.notFound(`dataset ${id} not found`);
  reply.send(found);
};

export const createDatasetHandler: RouteHandlerMethod = async (req, reply) => {
  const created = await datasetUsecases.create(req.body);
  reply.code(201).send(created);
};
```

`apps/api/src/delivery/http/dataset/handlers/index.ts`:

```ts
export * from './dataset.handler';
```

- [ ] **Step 4: Write the routes** `apps/api/src/delivery/http/dataset/routes.ts`

```ts
import { RouteOptions } from 'fastify';
import { listDatasetsHandler, getDatasetHandler, createDatasetHandler } from './handlers';

export const datasetRoutes: RouteOptions[] = [
  { method: 'GET', url: '/datasets', schema: { tags: ['dataset'] }, handler: listDatasetsHandler },
  { method: 'GET', url: '/datasets/:id', schema: { tags: ['dataset'] }, handler: getDatasetHandler },
  { method: 'POST', url: '/datasets', schema: { tags: ['dataset'] }, handler: createDatasetHandler },
];
```

- [ ] **Step 5: Write the module** `apps/api/src/delivery/http/dataset/module.ts`

```ts
import { FastifyPluginAsync } from 'fastify';
import { datasetRoutes } from './routes';
import { HttpRouteModule } from '@/infrastructures';
import { createPluginFromRoutes } from '@/helpers';

const plugin: FastifyPluginAsync = createPluginFromRoutes(datasetRoutes);

export const datasetHttpRouteModule: HttpRouteModule = {
  type: 'http',
  prefix: '/',
  plugin,
};
```

`apps/api/src/delivery/http/dataset/index.ts`:

```ts
export * from './module';
```

- [ ] **Step 6: Register the module** — add to `apps/api/src/delivery/http/index.ts`:

```ts
export * from './dataset';
```

(`main.ts` discovers modules via `Object.values(import * as ...'@/delivery/http')`, so this export auto-registers the routes.)

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter api vitest:run`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/delivery/http/dataset apps/api/src/delivery/http/index.ts
git commit -m "feat(api): datasets HTTP module (list/get/create)"
```

---

## Phase D — `apps/workbench` datasets page

### Task 12: datasets page fetches from the API

**Files:**
- Modify: `apps/workbench/src/app/[locale]/(shell)/datasets/page.tsx`
- Modify: `apps/workbench/.env.example` (add `API_BASE_URL`)

- [ ] **Step 1: Add `API_BASE_URL` to `apps/workbench/.env.example`**

```bash
API_BASE_URL="http://localhost:3000"
```

- [ ] **Step 2: Rewrite the datasets page to fetch the list**

`apps/workbench/src/app/[locale]/(shell)/datasets/page.tsx`:

```tsx
import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Dataset = { id: string; name: string; description: string | null };

async function fetchDatasets(): Promise<Dataset[]> {
  const base = process.env.API_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base}/datasets`, { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as Dataset[];
  } catch {
    return [];
  }
}

export default async function DatasetsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  const datasets = await fetchDatasets();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("datasetsTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("datasetsDescription")}</p>
      <Panel>
        {datasets.length === 0 ? (
          <span className="text-sm text-muted-foreground">No datasets yet.</span>
        ) : (
          <ul className="flex flex-col gap-2">
            {datasets.map((d) => (
              <li key={d.id} className="text-sm">
                <span className="font-medium">{d.name}</span>
                {d.description ? (
                  <span className="text-muted-foreground"> — {d.description}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint the workbench**

Run: `pnpm --filter workbench check-types && pnpm --filter workbench lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/workbench/src/app/[locale]/(shell)/datasets/page.tsx" apps/workbench/.env.example
git commit -m "feat(workbench): datasets page fetches list from api"
```

---

## Phase E — End-to-end verification

### Task 13: create → list round-trip (manual + documented)

**Files:**
- Create: `docs/superpowers/notes/2026-06-14-workbench-backend-e2e.md` (run log)

- [ ] **Step 1: Bring up Postgres, migrate, seed**

```bash
docker compose -f docker-compose.test.yml up -d
DATABASE_URL='postgresql://user:password@localhost:5433/workbench?options=-csearch_path=workbench' pnpm --filter @rfjs/db migrate
DATABASE_URL='postgresql://user:password@localhost:5433/workbench?options=-csearch_path=workbench' pnpm --filter @rfjs/db seed
```

Expected: "Migrations completed." then "Seeded 2 datasets."

- [ ] **Step 2: Start the API against that DB**

```bash
DATABASE_URL='postgresql://user:password@localhost:5433/workbench?options=-csearch_path=workbench' pnpm --filter api dev
```

- [ ] **Step 3: Exercise create → list**

```bash
curl -s -X POST localhost:3000/datasets -H 'content-type: application/json' -d '{"name":"E2E","data":{"k":1}}'
curl -s localhost:3000/datasets
```

Expected: POST returns a 201 body with `"name":"E2E"`; GET returns a list including the seeded rows + `E2E`.

- [ ] **Step 4: Start workbench and confirm the page renders the list**

```bash
API_BASE_URL=http://localhost:3000 pnpm --filter workbench dev
# open http://localhost:3001/en/datasets — the seeded + E2E datasets appear
```

- [ ] **Step 5: Record the run log and tear down**

Write the observed outputs into `docs/superpowers/notes/2026-06-14-workbench-backend-e2e.md`, then:

```bash
docker compose -f docker-compose.test.yml down
git add docs/superpowers/notes/2026-06-14-workbench-backend-e2e.md
git commit -m "docs(workbench): record datasets backend e2e run log"
```

---

## Final verification

- [ ] **Unit tier (no Docker):** `pnpm --filter @rfjs/db vitest:run && pnpm --filter @rfjs/core vitest:run && pnpm --filter api vitest:run` — all PASS.
- [ ] **Integration tier (Docker):** Postgres up → `pnpm --filter @rfjs/core vitest:e2e:run` — PASS.
- [ ] **Builds:** `pnpm --filter @rfjs/db build && pnpm --filter @rfjs/core build` — PASS.
- [ ] **Typecheck** (run after the builds above, so apps see the libs' `dist` types): `pnpm --filter @rfjs/db typecheck && pnpm --filter @rfjs/core typecheck && pnpm --filter api typecheck && pnpm --filter workbench check-types` — PASS. (`api` uses the `typecheck` script; `workbench` uses `check-types`.)

---

## Notes / deferred (from spec)

- **`@rfjs/pg-toolkit` deviation:** the spec lists pg-toolkit for `libs/db` DB/schema bootstrap, but its published surface is `pure` only (the side-effecting "admin" helpers aren't in the default export). Rather than invent an import path, this plan uses the **proven inline** `check-and-create-db/schema` scripts (copied from `libs/orm-drizzle`). Swapping them to `@rfjs/pg-toolkit` admin helpers is a follow-up once that package exposes them. Flag for the user at review.
- `@rfjs/jsonb-query` is wired as a `@rfjs/core` dependency now; its first real use is filtering the `data` jsonb column — added when list-datasets gains query params (next iteration), to keep this slice focused on the layer wiring.
- `@rfjs/retry` (db connect / outbound), auth (`@rfjs/jwt`, Phase 6), `apps/serverless`, and the workflow/story module are out of scope (see spec).
