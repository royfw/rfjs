# @rfjs/orm-drizzle

Drizzle ORM wrapper library.

## Installation

```bash
pnpm add @rfjs/orm-drizzle
```

## TypeScript version support

This template pins `typescript@^5.7.3`. The pin is required by the **lint** step only —
`pnpm build`, `pnpm typecheck`, and the emitted `.d.ts` are all verified against
`typescript@7.0.2` and produce type-identical output.

| Task | TypeScript 5.x | TypeScript 7.x |
| --- | --- | --- |
| `pnpm build` (tsdown, incl. `.d.ts`) | ok | ok |
| `pnpm typecheck` (`tsc --noEmit`) | ok | ok |
| `pnpm lint` (typescript-eslint) | ok | **fails** |

**Why lint fails on TS 7.** `@typescript-eslint/*` still caps its `typescript` peer
below 6, and its type-aware rules read compiler internals that TS 7 (the native Go
compiler) no longer exposes — `pnpm lint` aborts with
`TypeError: Cannot read properties of undefined`. This unblocks when typescript-eslint
ships TS 7 support; until then, keep the `^5.7.3` pin (or run TS 7 everywhere else and
pin 5.x for this package alone).

### Two build constraints worth knowing

- **`dts: { oxc: false }` in `tsdown.config.ts` must stay.** The oxc `.d.ts` backend is
  an `isolatedDeclarations` emitter: it never infers types, so `export const usersTable =
  pgTable(...)` fails with `TS9010: Variable must have an explicit type annotation`.
  Drizzle's `pgTable` return type is a deeply generic `PgTableWithColumns<...>` that
  cannot reasonably be written by hand, so the TypeScript backend does the inference.
- **`tsconfig.build.json` must not set `declarationDir`.** Under TS 7 the `.d.ts` step
  shells out to `tsgo` with `--outDir <tempdir>`, and `declarationDir` outranks `outDir`
  for declaration output — declarations land in `./types` instead, and the build fails
  with `tsgo did not generate dts file for src/index.ts`. The build config resets it to
  `null`; keep it that way if you edit the tsconfigs.

## Environment Variables

This library relies on the following environment variables:

- `DATABASE_URL`: The PostgreSQL connection string.

## Usage

### Database Connection

```typescript
import { createDb } from '@rfjs/orm-drizzle';

// Initialize the database connection
const { db, pool } = createDb(process.env.DATABASE_URL);
```

### Migrations

You can run migrations using the exported `migrateToLatest` function. This is typically used in a migration script in your application.

```typescript
import { migrateToLatest } from '@rfjs/orm-drizzle';

await migrateToLatest({
  connectionString: process.env.DATABASE_URL,
  schema: 'public', // optional: specify schema (defaults to `public`)
  migrationsFolder: 'node_modules/@rfjs/orm-drizzle/dist/drizzle', // optional: path to migrations
});
```

> **Schema consistency.** `drizzle-kit generate` binds enum types and FK
> targets to `public.`, so migrations must run against the `public` schema —
> which is why `schema` defaults to `public`. Running migrate under a different
> `search_path` will fail to resolve those enums/FKs and, with a fresh
> per-schema `__drizzle_migrations` table, replay every migration from `0000`.
> If you need a non-`public` schema, define your tables with drizzle
> [`pgSchema()`](https://orm.drizzle.team/docs/schemas) so `generate` emits
> output bound to that same schema, keeping things consistent end to end.

### Seeding

Seeding can be performed using `seedToLatest`.

```typescript
import { seedToLatest } from '@rfjs/orm-drizzle';

await seedToLatest(process.env.DATABASE_URL, 'public');
```