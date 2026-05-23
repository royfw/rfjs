# @rfjs/orm-typeorm

TypeORM wrapper library.

## Installation

```bash
pnpm add @rfjs/orm-typeorm
```

## Environment Variables

This library relies on the following environment variables:

- `DATABASE_URL`: The PostgreSQL connection string.

## Usage

### Database Connection

```typescript
import { createDb } from '@rfjs/orm-typeorm';

// Initialize the Data Source
const { db: dataSource } = createDb(process.env.DATABASE_URL);
```

### Migrations

You can run migrations using the exported `migrateToLatest` function. Note that migrations are bundled with this library.

```typescript
import { migrateToLatest } from '@rfjs/orm-typeorm';

await migrateToLatest({
  connectionString: process.env.DATABASE_URL,
  schema: 'app_typeorm', // Optional: schema name
});
```

### Seeding

```typescript
import { seedToLatest } from '@rfjs/orm-typeorm';

await seedToLatest(process.env.DATABASE_URL, 'app_typeorm');
```