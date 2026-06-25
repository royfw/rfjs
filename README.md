# rfjs

A Turborepo monorepo and template collection for the [start-ts-by](https://www.npmjs.com/package/start-ts-by) CLI. Contains production-ready TypeScript project templates for apps, libraries, CLIs, ORM wrappers, and monorepo scaffolds.

`apps/web` is the rfjs web playground and developer-tools showcase; `apps/workbench` is an admin app whose dataset explorer offers a visual query builder, backed by `apps/api` + `libs/core` + `libs/db`.

## Packages

### Published Libraries (`@rfjs/*`)

| Package | Description |
|---------|-------------|
| [@rfjs/data-expr](packages/data-expr) | Safe JSON expression engine (JSONata wrapper) — compile-once eval, DoS guards, no `eval` |
| [@rfjs/data-filter](packages/data-filter) | In-memory filtering & mapping — scalar/object/array/elemmatch conditions, computed `=` expressions, logic operators |
| [@rfjs/data-label](packages/data-label) | Compose display label strings from data paths, value maps, and templates |
| [@rfjs/data-transform](packages/data-transform) | Data type transformation utilities — typeTransfer, jsonbTransfer, toBoolean, toDateString |
| [@rfjs/filter-builder](packages/filter-builder) | Framework-agnostic canonical filter-tree — edit model, schema inference, reverse parse, compile to the SQL/in-memory engines below |
| [@rfjs/jsonb-query](packages/jsonb-query) | PostgreSQL JSONB SQL query builder (WHERE/ORDER BY; legacy + jsonpath dialects) |
| [@rfjs/jwt](packages/jwt) | JWT sign, verify, and decode helper |
| [@rfjs/mongo-query](packages/mongo-query) | MongoDB query builder from structured filter metadata |
| [@rfjs/object-utils](packages/object-utils) | Object utilities — flatten, keysToNested, toJSONString, toFlatString |
| [@rfjs/pg-filter](packages/pg-filter) | Unified PostgreSQL filter builder — nests column + JSONB conditions in one tree, with sort and pagination |
| [@rfjs/pg-toolkit](packages/pg-toolkit) | PostgreSQL utilities for Drizzle, Prisma, Kysely, and TypeORM |
| [@rfjs/retry](packages/retry) | Retry helper with configurable delay and max attempts |
| [@rfjs/sql-filter](packages/sql-filter) | Generic boolean filter-group → parameterized SQL with pluggable leaf renderers |
| [@rfjs/tpl-toolkit](packages/tpl-toolkit) | Shared config factories and build helpers for project templates |

The four filter packages layer together: `sql-filter` (generic engine) ← `pg-filter` / `jsonb-query` (Postgres specialists), with `filter-builder` as the high-level tree model that compiles to any of them (or to in-memory `data-filter`).

### Internal Packages (private)

| Package | Description |
|---------|-------------|
| @rfjs/web-core | Tool/package registry, zod schemas, and fixtures for `apps/web` and `apps/workbench` |
| @rfjs/web-ui | Design tokens, Tailwind preset, and shadcn components for `apps/web` and `apps/workbench` |
| @rfjs/filter-builder-ui | React filter-tree editor (`<FilterTreeEditor>` + `useFilterTree`) over `@rfjs/filter-builder`; used by `apps/workbench` |

## Apps

| App | Description |
|-----|-------------|
| [api](apps/api) | Fastify REST API (esbuild) — serves the workbench dataset endpoints |
| [web](apps/web) | Next.js web app — package & developer-tools showcase |
| [workbench](apps/workbench) | Next.js admin app — dataset explorer with a visual query builder |

## Templates

Standalone project templates distributed via `start-ts-by` CLI. See [templates/registry.json](templates/registry.json) for the full registry.

- **Apps**: `app-esbuild`, `app-tsdown`, `fastify-esbuild`, `fastify-tsdown`, `fastify-gql-tsdown`, `koa-esbuild`
- **Libs**: `lib-esbuild`, `lib-tsdown`, `lib-rollup`, `lib-rolldown`
- **CLI**: `bin-tsdown`
- **Docs**: `docs-docsify`, `docs-vitepress`
- **ORM**: `orm-drizzle`, `orm-kysely`, `orm-prisma`, `orm-typeorm`
- **BullMQ**: `bull-api`, `lib-queue`
- **Monorepo**: `turbo`

## Internal Libraries (`libs/`)

| Lib | Description |
|-----|-------------|
| @rfjs/core | Workbench business logic — one folder per module (currently `dataset`) following schema → repository → usecase |
| @rfjs/db | Workbench Drizzle plumbing for PostgreSQL — connection, schema, migrations, seed |

`@rfjs/core` and `@rfjs/db` back the `apps/workbench` dataset explorer (via `apps/api`). The ORM wrappers (Drizzle / Kysely / Prisma / TypeORM, behind a common `migrateToLatest` / `seedToLatest` API) ship as standalone scaffolds — see the **ORM** templates above.
