# @rfjs/orm-drizzle

Drizzle ORM wrapper library.

## Installation

```bash
pnpm add @rfjs/orm-drizzle
```

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