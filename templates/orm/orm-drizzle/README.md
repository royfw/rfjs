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
  schema: 'public', // optional: specify schema
  migrationsFolder: 'node_modules/@rfjs/orm-drizzle/dist/drizzle', // optional: path to migrations
});
```

### Seeding

Seeding can be performed using `seedToLatest`.

```typescript
import { seedToLatest } from '@rfjs/orm-drizzle';

await seedToLatest(process.env.DATABASE_URL, 'public');
```