# Datasets jsonb Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `POST /datasets/query` that filters datasets over the `data` jsonb column using `@rfjs/jsonb-query`, end to end.

**Architecture:** A new `repository.search(filter)` runs `buildJsonbQuery('data', filter, { dialect: 'jsonpath' })` and executes the resulting positional SQL on Drizzle's underlying pool (`db.$client.query`), mapping aliased rows back to `Dataset`. A `makeSearchDatasets` usecase zod-validates the `{ filter }` body before calling the repo. `apps/api` exposes `POST /datasets/query` and maps `JsonbQueryError → 400` (alongside the existing `ZodError → 400`).

**Tech Stack:** TypeScript, Drizzle (node-postgres, `db.$client`), `@rfjs/jsonb-query`, zod v4, Fastify 5, Vitest, pnpm/turbo. Real-PG integration via `docker-compose.test.yml` (port 5433).

**Spec:** `docs/superpowers/specs/2026-06-14-datasets-jsonb-filter-design.md`

---

## File Structure

- `libs/core/src/dataset/repository.ts` (modify) — add `search` to the `DatasetRepository` interface + factory.
- `libs/core/src/dataset/repository.e2e.spec.ts` (modify) — add a real-PG search test.
- `libs/core/src/dataset/filter-schema.ts` (new) — recursive zod `FilterGroupSchema` for the `JsonbFilterGroup` shape.
- `libs/core/src/dataset/usecase/search-datasets.ts` (new) — `makeSearchDatasets`.
- `libs/core/src/dataset/usecase/search-datasets.spec.ts` (new) — fake-repo unit tests.
- `libs/core/src/dataset/usecase/index.ts` (modify) — export search-datasets.
- `apps/api/package.json` (modify) — add `@rfjs/jsonb-query`.
- `apps/api/src/infrastructures/datasource/index.ts` (modify) — add `search` to `datasetUsecases`.
- `apps/api/src/delivery/http/dataset/handlers/dataset.handler.ts` (modify) — add `searchDatasetsHandler`.
- `apps/api/src/delivery/http/dataset/routes.ts` (modify) — add `POST /datasets/query`.
- `apps/api/src/infrastructures/fastify/registers/register-error-handler.ts` (modify) — map `JsonbQueryError → 400`.
- `apps/api/src/delivery/http/dataset/dataset.route.spec.ts` (modify) — add `search` to the mock + 200/400 tests.

---

## Task 1: `repository.search` + real-PG integration test

**Files:**
- Modify: `libs/core/src/dataset/repository.ts`
- Test: `libs/core/src/dataset/repository.e2e.spec.ts`

- [ ] **Step 1: Build the workspace deps the e2e test imports**

`repository.ts` will import `buildJsonbQuery` (a runtime value) from `@rfjs/jsonb-query`, and the e2e test imports `@rfjs/db` — both are consumed via their built `dist/`.

Run: `pnpm --filter @rfjs/jsonb-query build && pnpm --filter @rfjs/db build`
Expected: both build clean.

- [ ] **Step 2: Add the failing search test to `libs/core/src/dataset/repository.e2e.spec.ts`**

Add this `it` block inside the existing `describe('makeDatasetRepository (real PG)', ...)` (after the "lists datasets" test):

```ts
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
```

- [ ] **Step 3: Run it to verify it fails**

```bash
docker compose -f docker-compose.test.yml up -d && sleep 5
pnpm --filter @rfjs/core vitest:e2e:run
```
Expected: FAIL — `repo.search is not a function` (and a TS/type error that `search` is missing). Leave Postgres up for Step 5.

- [ ] **Step 4: Implement `search` in `libs/core/src/dataset/repository.ts`**

Replace the file's top imports and add `search` to both the interface and the factory:

```ts
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
```

Add this method to the object returned by `makeDatasetRepository` (after `create`):

```ts
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
```

(The aliased `SELECT` returns the exact `Dataset` field names, so the existing `toDataset` mapper is reused. `db.$client` is the node-postgres `Pool` Drizzle was constructed with; `search_path=workbench` resolves the unqualified `datasets`.)

- [ ] **Step 5: Run the e2e test to verify it passes, then tear down**

```bash
pnpm --filter @rfjs/db build           # repository.ts changed -> rebuild dep consumed by the test
pnpm --filter @rfjs/core vitest:e2e:run
docker compose -f docker-compose.test.yml down
```
Expected: PASS (3 e2e tests: create/get, list, filter).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @rfjs/core typecheck`
Expected: clean. If `db.$client` is not typed, confirm drizzle-orm 0.45.1 (it exposes `$client`); do not work around with `any` unless typecheck genuinely fails — report it instead.

- [ ] **Step 7: Commit**

```bash
git add libs/core/src/dataset/repository.ts libs/core/src/dataset/repository.e2e.spec.ts
git commit -m "feat(core): dataset repository.search via @rfjs/jsonb-query (data jsonb)"
```

---

## Task 2: `FilterGroupSchema` + `search-datasets` usecase

**Files:**
- Create: `libs/core/src/dataset/filter-schema.ts`
- Create: `libs/core/src/dataset/usecase/search-datasets.ts`
- Modify: `libs/core/src/dataset/usecase/index.ts`
- Test: `libs/core/src/dataset/usecase/search-datasets.spec.ts`

- [ ] **Step 1: Write the failing test — `libs/core/src/dataset/usecase/search-datasets.spec.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeSearchDatasets } from './search-datasets';
import type { DatasetRepository } from '../repository';

const validBody = {
  filter: {
    logic: 'and',
    filters: [{ field: 'region', dataType: 'string', operator: 'eq', value: 'apac' }],
  },
};

describe('makeSearchDatasets', () => {
  it('validates the body then delegates the filter to repository.search', async () => {
    const repo = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      search: vi.fn().mockResolvedValue([]),
    } satisfies DatasetRepository;
    const searchDatasets = makeSearchDatasets({ repo });
    await searchDatasets(validBody);
    expect(repo.search).toHaveBeenCalledWith(validBody.filter);
  });

  it('throws on an invalid body shape without calling the repository', async () => {
    const repo = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      search: vi.fn(),
    } satisfies DatasetRepository;
    const searchDatasets = makeSearchDatasets({ repo });
    await expect(searchDatasets({ filter: { logic: 'xor', filters: [] } })).rejects.toThrow();
    await expect(searchDatasets({})).rejects.toThrow();
    expect(repo.search).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @rfjs/core vitest:run`
Expected: FAIL — cannot find module './search-datasets'.

- [ ] **Step 3: Write `libs/core/src/dataset/filter-schema.ts`**

```ts
import { z } from 'zod';
import type { JsonbFilterGroup } from '@rfjs/jsonb-query';

const LOGIC = ['and', 'or', 'nor', 'not'] as const;
const DATA_TYPE = ['string', 'numeric', 'date', 'boolean', 'object', 'array'] as const;

// Loose condition shape: deep grammar (operator/dataType validity) is enforced by
// @rfjs/jsonb-query at build time. This gate only rejects gross malformation.
const ConditionSchema = z.object({
  field: z.string().min(1),
  dataType: z.enum(DATA_TYPE),
  operator: z.string().min(1),
  value: z.unknown().optional(),
  elementType: z.enum(['string', 'numeric', 'date', 'boolean', 'object']).optional(),
  filters: z.unknown().optional(), // nested group for elemmatch; validated by jsonb-query
});

export const FilterGroupSchema: z.ZodType<JsonbFilterGroup> = z.lazy(() =>
  z.object({
    logic: z.enum(LOGIC),
    filters: z.array(z.union([ConditionSchema, FilterGroupSchema])),
  }),
) as z.ZodType<JsonbFilterGroup>;

export const SearchBodySchema = z.object({ filter: FilterGroupSchema });
export type SearchBody = z.infer<typeof SearchBodySchema>;
```

- [ ] **Step 4: Write `libs/core/src/dataset/usecase/search-datasets.ts`**

```ts
import type { Dataset } from '../schema';
import type { DatasetRepository } from '../repository';
import { SearchBodySchema } from '../filter-schema';

export const makeSearchDatasets =
  (deps: { repo: DatasetRepository }) =>
  async (input: unknown): Promise<Dataset[]> => {
    const { filter } = SearchBodySchema.parse(input);
    return deps.repo.search(filter);
  };
```

- [ ] **Step 5: Export it — append to `libs/core/src/dataset/usecase/index.ts`**

```ts
export * from './create-dataset';
export * from './list-datasets';
export * from './get-dataset';
export * from './search-datasets';
```

(`filter-schema.ts` is reachable through the existing `dataset/index.ts` → `./schema`? No — add it: also append `export * from './filter-schema';` to `libs/core/src/dataset/index.ts` so `FilterGroupSchema`/`SearchBodySchema` are part of the package surface.)

- [ ] **Step 6: Append to `libs/core/src/dataset/index.ts`**

The file currently is:
```ts
export * from './schema';
export * from './repository';
export * from './usecase';
```
Add a line:
```ts
export * from './filter-schema';
```

- [ ] **Step 7: Run tests + typecheck**

Run: `pnpm --filter @rfjs/core vitest:run && pnpm --filter @rfjs/core typecheck`
Expected: PASS (unit tier: schema + 3 usecases + 2 new search tests). The e2e spec stays excluded from the unit tier.

- [ ] **Step 8: Commit**

```bash
git add libs/core/src/dataset/filter-schema.ts libs/core/src/dataset/usecase/search-datasets.ts libs/core/src/dataset/usecase/search-datasets.spec.ts libs/core/src/dataset/usecase/index.ts libs/core/src/dataset/index.ts
git commit -m "feat(core): search-datasets usecase + zod FilterGroupSchema"
```

---

## Task 3: api `POST /datasets/query` + `JsonbQueryError → 400`

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/infrastructures/datasource/index.ts`
- Modify: `apps/api/src/delivery/http/dataset/handlers/dataset.handler.ts`
- Modify: `apps/api/src/delivery/http/dataset/routes.ts`
- Modify: `apps/api/src/infrastructures/fastify/registers/register-error-handler.ts`
- Test: `apps/api/src/delivery/http/dataset/dataset.route.spec.ts`

- [ ] **Step 1: Add `@rfjs/jsonb-query` to apps/api and install**

Add `"@rfjs/jsonb-query": "workspace:*"` to `apps/api/package.json` `dependencies` (next to `@rfjs/core`). Then:

Run: `pnpm install`
Expected: links `@rfjs/jsonb-query` into apps/api.

- [ ] **Step 2: Write the failing route tests — edit `apps/api/src/delivery/http/dataset/dataset.route.spec.ts`**

(a) Add `import { JsonbQueryError } from '@rfjs/jsonb-query';` to the top imports.

(b) Add a `search` mock to the `vi.mock('@/infrastructures/datasource', ...)` `datasetUsecases` object:

```ts
    search: vi.fn().mockResolvedValue([
      {
        id: '1',
        name: 'A',
        description: null,
        data: { region: 'apac' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
```

(c) Add two `it` blocks inside `describe('dataset routes', ...)`:

```ts
  it('POST /datasets/query returns 200 with the filtered list', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/datasets/query',
      payload: {
        filter: {
          logic: 'and',
          filters: [{ field: 'region', dataType: 'string', operator: 'eq', value: 'apac' }],
        },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it('POST /datasets/query maps JsonbQueryError to 400', async () => {
    const { datasetUsecases } = await import('@/infrastructures/datasource');
    vi.mocked(datasetUsecases.search).mockRejectedValueOnce(
      new JsonbQueryError('bad operator', 'INVALID_OPERATOR'),
    );
    const res = await app.inject({
      method: 'POST',
      url: '/datasets/query',
      payload: { filter: { logic: 'and', filters: [] } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toBe('Bad Request');
  });
```

(Verify `'INVALID_OPERATOR'` is a real `JsonbQueryErrorCode` by checking `packages/jsonb-query/src/errors.ts`; if not, use any exported code such as `'INVALID_DIALECT'`. The exact code doesn't affect the 400 mapping.)

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @rfjs/jsonb-query build && pnpm --filter @rfjs/core build && pnpm --filter api vitest:run`
Expected: FAIL — `POST /datasets/query` returns 404 (route not registered) and/or `datasetUsecases.search` undefined.

- [ ] **Step 4: Add `search` to the composition root — `apps/api/src/infrastructures/datasource/index.ts`**

```ts
import { createDb } from '@rfjs/db';
import {
  makeDatasetRepository,
  makeListDatasets,
  makeGetDataset,
  makeCreateDataset,
  makeSearchDatasets,
} from '@rfjs/core';
import { configs } from '@/configs';

const { db } = createDb(configs.databaseUrl);
const datasetRepository = makeDatasetRepository(db);

export const datasetUsecases = {
  list: makeListDatasets({ repo: datasetRepository }),
  get: makeGetDataset({ repo: datasetRepository }),
  create: makeCreateDataset({ repo: datasetRepository }),
  search: makeSearchDatasets({ repo: datasetRepository }),
};
```

- [ ] **Step 5: Add the handler — `apps/api/src/delivery/http/dataset/handlers/dataset.handler.ts`**

Append:
```ts
export const searchDatasetsHandler: RouteHandlerMethod = async (req, reply) => {
  reply.send(await datasetUsecases.search(req.body));
};
```

- [ ] **Step 6: Add the route — `apps/api/src/delivery/http/dataset/routes.ts`**

```ts
import { RouteOptions } from 'fastify';
import {
  listDatasetsHandler,
  getDatasetHandler,
  createDatasetHandler,
  searchDatasetsHandler,
} from './handlers';

export const datasetRoutes: RouteOptions[] = [
  { method: 'GET', url: '/datasets', schema: { tags: ['dataset'] }, handler: listDatasetsHandler },
  { method: 'GET', url: '/datasets/:id', schema: { tags: ['dataset'] }, handler: getDatasetHandler },
  { method: 'POST', url: '/datasets', schema: { tags: ['dataset'] }, handler: createDatasetHandler },
  { method: 'POST', url: '/datasets/query', schema: { tags: ['dataset'] }, handler: searchDatasetsHandler },
];
```

- [ ] **Step 7: Map `JsonbQueryError → 400` — edit `apps/api/src/infrastructures/fastify/registers/register-error-handler.ts`**

Add the import and a branch before the ZodError branch (or after — order is independent):

```ts
import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { JsonbQueryError } from '@rfjs/jsonb-query';
```

Inside `setErrorHandler`, before `// Preserve default behavior`:

```ts
    if (error instanceof JsonbQueryError) {
      request.log.info({ code: error.code }, 'jsonb filter build failed');
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid filter',
        code: error.code,
      });
    }
```

(`JsonbQueryError` carries a `code: JsonbQueryErrorCode` — confirm in `packages/jsonb-query/src/errors.ts`.)

- [ ] **Step 8: Run tests + typecheck**

```bash
pnpm --filter @rfjs/jsonb-query build && pnpm --filter @rfjs/core build
pnpm --filter api vitest:run
pnpm --filter api typecheck
```
Expected: PASS — all dataset route tests including the new 200 + 400 (now 7 in that file: list, create-201, get-200, get-404, create-400, query-200, query-400) plus the demo test.

- [ ] **Step 9: Commit**

```bash
git add apps/api/package.json apps/api/src/infrastructures/datasource/index.ts apps/api/src/delivery/http/dataset/handlers/dataset.handler.ts apps/api/src/delivery/http/dataset/routes.ts apps/api/src/infrastructures/fastify/registers/register-error-handler.ts apps/api/src/delivery/http/dataset/dataset.route.spec.ts pnpm-lock.yaml
git commit -m "feat(api): POST /datasets/query + map JsonbQueryError to 400"
```

---

## Task 4: full-stack e2e verification + run log

**Files:**
- Create: `docs/superpowers/notes/2026-06-14-datasets-jsonb-filter-e2e.md`

- [ ] **Step 1: Build libs, bring up PG, migrate + seed**

```bash
pnpm --filter @rfjs/jsonb-query build && pnpm --filter @rfjs/db build && pnpm --filter @rfjs/core build
docker compose -f docker-compose.test.yml up -d && sleep 5
export DBURL='postgresql://user:password@localhost:5433/workbench?options=-csearch_path=workbench'
DATABASE_URL="$DBURL" pnpm --filter @rfjs/db migrate
DATABASE_URL="$DBURL" pnpm --filter @rfjs/db seed
```
Expected: "Migrations completed." then "Seeded 2 datasets." (the seed rows have `data.region` `apac` and `emea`).

- [ ] **Step 2: Start the API and exercise the filter**

```bash
DATABASE_URL="$DBURL" pnpm --filter api tsx > /tmp/api.log 2>&1 &
for i in $(seq 1 30); do curl -sf localhost:3000/health && break; sleep 1; done
echo "--- filter region=apac ---"
curl -s -X POST localhost:3000/datasets/query -H 'content-type: application/json' \
  -d '{"filter":{"logic":"and","filters":[{"field":"region","dataType":"string","operator":"eq","value":"apac"}]}}'
echo ""
echo "--- malformed filter -> 400 ---"
curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3000/datasets/query -H 'content-type: application/json' \
  -d '{"filter":{"logic":"and","filters":[{"field":"region","dataType":"string","operator":"NOPE","value":"x"}]}}'
echo ""
```
Expected: the first returns a JSON array containing only the `apac` seed row ("Sales — Q1"); the malformed-operator request returns `400`.

- [ ] **Step 3: Tear down**

```bash
pkill -f 'apps/api' 2>/dev/null || true
docker compose -f docker-compose.test.yml down
```

- [ ] **Step 4: Write the run log + commit**

Record the real observed outputs into `docs/superpowers/notes/2026-06-14-datasets-jsonb-filter-e2e.md`, then:

```bash
git add docs/superpowers/notes/2026-06-14-datasets-jsonb-filter-e2e.md
git commit -m "docs(datasets): record jsonb filter e2e run log"
```

---

## Final verification

- [ ] **Unit tier:** `pnpm --filter @rfjs/core vitest:run && pnpm --filter api vitest:run` — all pass.
- [ ] **Integration tier (Docker):** PG up → `pnpm --filter @rfjs/core vitest:e2e:run` — 3 pass.
- [ ] **Builds + typecheck:** `pnpm --filter @rfjs/jsonb-query build && pnpm --filter @rfjs/db build && pnpm --filter @rfjs/core build && pnpm --filter @rfjs/core typecheck && pnpm --filter api typecheck` — clean.

## Notes / out of scope (per spec)

- Sorting (`@rfjs/jsonb-query` ORDER BY builder) + pagination — next iteration; the `{ filter }` body leaves room for `{ filter, sort?, page? }`.
- Top-level column filtering (`name`/`description`) and a workbench filter UI — later.
