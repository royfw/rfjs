# @rfjs/orm-kysely

Kysely ORM wrapper library.

## Installation

```bash
pnpm add @rfjs/orm-kysely
```

## Environment Variables

This library relies on the following environment variables:

- `DATABASE_URL`: The PostgreSQL connection string.

## Usage

### Database Connection

```typescript
import { createDb } from '@rfjs/orm-kysely';

// Initialize the Kysely instance
const { db } = createDb(process.env.DATABASE_URL);
```

### Migrations

You can run migrations using the exported `migrateToLatest` function. Note that migrations are bundled with this library.

```typescript
import { migrateToLatest } from '@rfjs/orm-kysely';

await migrateToLatest({
  connectionString: process.env.DATABASE_URL,
  schema: 'app_kysely', // Optional: schema name
});
```

### Seeding

```typescript
import { seedToLatest } from '@rfjs/orm-kysely';

await seedToLatest(process.env.DATABASE_URL, 'app_kysely');
```