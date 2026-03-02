# @rfjs/orm-prisma

Prisma ORM wrapper library.

## Installation

```bash
pnpm add @rfjs/orm-prisma
```

## Environment Variables

This library relies on the following environment variables:

- `DATABASE_URL`: The PostgreSQL connection string.

## Usage

### Database Connection

```typescript
import { createDb } from '@rfjs/orm-prisma';

// Initialize the Prisma client
const { db } = createDb(process.env.DATABASE_URL);
```

### Migrations

You can run migrations using the exported `migrateToLatest` function.

```typescript
import { migrateToLatest } from '@rfjs/orm-prisma';

await migrateToLatest({
  connectionString: process.env.DATABASE_URL,
  schemaFilePath: 'node_modules/@rfjs/orm-prisma/dist/prisma/schema.prisma', // Path to your schema.prisma
  configFilePath: 'node_modules/@rfjs/orm-prisma/dist/prisma.config.ts',   // Path to your prisma config
  schema: 'app_prisma', // Optional: schema name
});
```

### Seeding

```typescript
import { seedToLatest } from '@rfjs/orm-prisma';

await seedToLatest(process.env.DATABASE_URL, 'app_prisma');
```