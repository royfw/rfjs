# rfjs

A Turborepo monorepo and template collection for the [start-ts-by](https://www.npmjs.com/package/start-ts-by) CLI. Contains production-ready TypeScript project templates for apps, libraries, CLIs, ORM wrappers, and monorepo scaffolds.

`apps/web` is the rfjs web playground and developer tools site.

## Packages

### Published Libraries (`@rfjs/*`)

| Package | Description |
|---------|-------------|
| [@rfjs/data-expr](packages/data-expr) | Safe JSON expression engine (JSONata wrapper) — compile-once eval, DoS guards, no `eval` |
| [@rfjs/data-filter](packages/data-filter) | In-memory filtering & mapping — scalar/object/array/elemmatch conditions, computed `=` expressions, logic operators |
| [@rfjs/data-label](packages/data-label) | Compose display label strings from data paths, value maps, and templates |
| [@rfjs/data-transform](packages/data-transform) | Data type transformation utilities — typeTransfer, jsonbTransfer, toBoolean, toDateString |
| [@rfjs/jsonb-query](packages/jsonb-query) | PostgreSQL JSONB SQL query builder |
| [@rfjs/jwt](packages/jwt) | JWT sign, verify, and decode helper |
| [@rfjs/mongo-query](packages/mongo-query) | MongoDB query builder from structured filter metadata |
| [@rfjs/object-utils](packages/object-utils) | Object utilities — flatten, keysToNested, toJSONString, toFlatString |
| [@rfjs/pg-toolkit](packages/pg-toolkit) | PostgreSQL utilities for Drizzle, Prisma, Kysely, and TypeORM |
| [@rfjs/retry](packages/retry) | Retry helper with configurable delay and max attempts |
| [@rfjs/tpl-toolkit](packages/tpl-toolkit) | Shared config factories and build helpers for project templates |

### Internal Packages (private)

| Package | Description |
|---------|-------------|
| @rfjs/web-core | Tool/package registry, zod schemas, and fixtures for `apps/web` |
| @rfjs/web-ui | Design tokens, Tailwind preset, and shadcn components for `apps/web` |

## Apps

| App | Description |
|-----|-------------|
| [api](apps/api) | Fastify REST API (esbuild) |
| [web](apps/web) | Next.js web app (turbopack) |
| [orm-app](apps/orm-app) | ORM integration demo (tsdown) — consumes all 4 ORM libs |

## Templates

Standalone project templates distributed via `start-ts-by` CLI. See [templates/registry.json](templates/registry.json) for the full registry.

- **Apps**: `app-esbuild`, `app-tsdown`, `fastify-esbuild`, `fastify-tsdown`, `fastify-gql-tsdown`, `koa-esbuild`
- **Libs**: `lib-esbuild`, `lib-tsdown`, `lib-rollup`, `lib-rolldown`
- **CLI**: `bin-tsdown`
- **Docs**: `docs-docsify`, `docs-vitepress`
- **ORM**: `orm-drizzle`, `orm-kysely`, `orm-prisma`, `orm-typeorm`
- **BullMQ**: `bull-api`, `lib-queue`
- **Monorepo**: `turbo`

## ORM Libraries (internal)

`libs/orm-drizzle`, `orm-kysely`, `orm-prisma`, and `orm-typeorm` wrap each ORM's migrate/seed flow behind a common `migrateToLatest` / `seedToLatest` API. For runnable usage, see [`apps/orm-app`](apps/orm-app) and each package's own README.
