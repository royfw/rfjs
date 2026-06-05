# rfjs

A Turborepo monorepo and template collection for the [start-ts-by](https://www.npmjs.com/package/start-ts-by) CLI. Contains production-ready TypeScript project templates for apps, libraries, CLIs, ORM wrappers, and monorepo scaffolds.

## Packages

### Published Libraries (`@rfjs/*`)

| Package | Description |
|---------|-------------|
| [@rfjs/data-filter](packages/data-filter) | Data filtering with JSONPath support, wildcard path resolution, and logic operators |
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
| @repo/eslint-config | Shared ESLint configuration |
| @repo/typescript-config | Shared TypeScript configuration |
| @repo/ui | Shared React component library |

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

## ORM Libraries Usage

This project includes wrappers for multiple ORM libraries. Below are examples of how to initialize migrations and seeding for each, based on usage in `@apps/orm-app`.

### @libs/orm-drizzle

```typescript
import { migrateToLatest, seedToLatest } from '@rfjs/orm-drizzle';

await migrateToLatest({
  connectionString: process.env.DATABASE_URL,
  schema: 'app_drizzle',
  migrationsFolder: 'node_modules/@rfjs/orm-drizzle/dist/drizzle',
});
await seedToLatest(process.env.DATABASE_URL, 'app_drizzle');
```

### @libs/orm-kysely

```typescript
import { migrateToLatest, seedToLatest } from '@rfjs/orm-kysely';

await migrateToLatest({
  connectionString: process.env.DATABASE_URL,
  schema: 'app_kysely',
});
await seedToLatest(process.env.DATABASE_URL, 'app_kysely');
```

### @libs/orm-prisma

```typescript
import { migrateToLatest, seedToLatest } from '@rfjs/orm-prisma';

await migrateToLatest({
  connectionString: process.env.DATABASE_URL,
  schemaFilePath: 'node_modules/@rfjs/orm-prisma/dist/prisma/schema.prisma',
  configFilePath: 'node_modules/@rfjs/orm-prisma/dist/prisma.config.ts',
  schema: 'app_prisma',
});
await seedToLatest(process.env.DATABASE_URL, 'app_prisma');
```

### @libs/orm-typeorm

```typescript
import { migrateToLatest, seedToLatest } from '@rfjs/orm-typeorm';

await migrateToLatest({
  connectionString: process.env.DATABASE_URL,
  schema: 'app_typeorm',
});
await seedToLatest(process.env.DATABASE_URL, 'app_typeorm');
```
