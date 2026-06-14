# Datasets jsonb Filtering via `@rfjs/jsonb-query` — Design

**Date:** 2026-06-14
**Status:** Approved (brainstorming complete; pending writing-plans)
**Scope:** Add server-side filtering of `datasets` over the `data` jsonb column, powered by `@rfjs/jsonb-query`. Extends the datasets vertical slice shipped in PR #159.

## Context

PR #159 built the workbench backend foundation with a `datasets` CRUD slice. `@rfjs/jsonb-query`
was deliberately pre-wired as a `@rfjs/core` dependency but not yet used; the spec noted its first
real use would be "filtering the `data` jsonb column." This is that iteration — it both delivers
useful filtering and showcases the `@rfjs/jsonb-query` package end to end.

## Key facts that shaped the design

- `@rfjs/jsonb-query` input is a structured `JsonbFilterGroup` (`{ logic, filters: [{ field, dataType, operator, value }] }`); output is **standard Postgres positional SQL** (`{ where, values }`).
- Signature: `buildJsonbQuery(column, filter, options)` → `{ where, values, from }`; `options.dialect` defaults to `legacy`.
- It is a SQL builder meant to be executed by a raw PG driver. Drizzle's node-postgres exposes the
  underlying pool via **`db.$client`** (confirmed in 0.45.1), so the repository can run jsonb-query's
  SQL on `db.$client.query(text, values)` **without changing the `makeDatasetRepository(db)` signature**.

## Architecture & data flow

```
POST /datasets/query   body: { filter: JsonbFilterGroup }
  → createDatasetQueryHandler: datasetUsecases.search(req.body)
  → makeSearchDatasets({ repo }): zod-validate the body shape → repo.search(filter)
  → repository.search(filter):
       const { where, values } = buildJsonbQuery('data', filter, { dialect: 'jsonpath' })
       const { rows } = await db.$client.query(
         `SELECT dataset_id AS id, name, description, data,
                 created_at AS "createdAt", updated_at AS "updatedAt"
          FROM datasets WHERE ${where}`, values)
       return rows.map(toDataset)
```

The aliased `SELECT` returns rows in the exact `Dataset` shape (`id/name/description/data/createdAt/updatedAt`),
so the existing `toDataset` mapper is reused. `search_path=workbench` (on the connection string) resolves
the unqualified `datasets` to `workbench.datasets`, consistent with the rest of the slice.

## Decisions

- **New endpoint `POST /datasets/query`** (not overloading `GET /datasets`) — the filter is a rich nested
  object that belongs in a JSON body, and jsonb-query's native input is that structured group.
- **Dialect = `jsonpath`** — the richer dialect (nested elemmatch support); best showcase. Centralised so it's a one-line switch.
- **Filtering targets only the `data` jsonb column.** Filtering on top-level `name`/`description` is out of scope for this slice.
- **Execution via `db.$client`** — keeps the repository ORM-isolation boundary intact (only `repository.ts` touches drizzle/pg) and avoids threading jsonb-query's positional params through Drizzle's query builder.

## Components (small, focused)

- `libs/core/src/dataset/filter-schema.ts` (new) — a zod `FilterGroupSchema` (recursive via `z.lazy`) validating the outer `JsonbFilterGroup` shape (logic enum + filters array of condition|group). Deep grammar validation is delegated to jsonb-query.
- `libs/core/src/dataset/repository.ts` — add `search(filter: JsonbFilterGroup): Promise<Dataset[]>` to the `DatasetRepository` interface + factory; import `buildJsonbQuery` and the `JsonbFilterGroup` type from `@rfjs/jsonb-query`.
- `libs/core/src/dataset/usecase/search-datasets.ts` (new) — `makeSearchDatasets({ repo })` → validates `{ filter }` with `FilterGroupSchema` then calls `repo.search(filter)`; export via `usecase/index.ts`.
- `apps/api/src/infrastructures/datasource/index.ts` — add `search: makeSearchDatasets({ repo: datasetRepository })` to `datasetUsecases`.
- `apps/api/src/delivery/http/dataset/handlers/dataset.handler.ts` — add `searchDatasetsHandler` → `datasetUsecases.search(req.body)`.
- `apps/api/src/delivery/http/dataset/routes.ts` — add `{ method: 'POST', url: '/datasets/query', ... }`.
- `apps/api/src/infrastructures/fastify/registers/register-error-handler.ts` — add `JsonbQueryError → 400` (alongside `ZodError → 400`), mapping a clean body (no internal leak).
- `apps/api/package.json` — add `@rfjs/jsonb-query` (workspace:\*) so the error handler can `instanceof JsonbQueryError`.

## Error handling

Two untrusted-input gates, both surfacing as **400**:
- `FilterGroupSchema` (zod) rejects gross shape errors at the usecase boundary → `ZodError` → 400 (existing handler).
- jsonb-query throws `JsonbQueryError` on bad operator/dataType/grammar → mapped to 400 by the extended handler (no raw internals leaked). All other errors keep current behavior.

## Testing

- **Unit (fake repo):** `search-datasets.spec.ts` — valid filter delegates to `repo.search`; invalid shape throws without calling the repo.
- **Repository real-PG e2e:** extend `repository.e2e.spec.ts` — seed rows with distinct `data` (e.g. `{region:'apac'}`, `{region:'emea'}`), `search({ logic:'and', filters:[{ field:'region', dataType:'string', operator:'eq', value:'apac' }] })`, assert only matching rows return.
- **Route test (mock):** `dataset.route.spec.ts` — `POST /datasets/query` with a valid filter → 200 (mock `search`); a malformed filter where the mocked `search` throws `JsonbQueryError` → 400.

## Out of scope (this iteration)

- Sorting (`@rfjs/jsonb-query` ORDER BY builder) and pagination — natural next iteration; the `POST /datasets/query` body leaves room (`{ filter, sort?, page? }`).
- Filtering on top-level columns (`name`, `description`).
- Exposing the filter UI in workbench (this slice is API-only; a workbench filter form is a later step).
