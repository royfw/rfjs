# @rfjs/pg-toolkit

A utility toolkit for PostgreSQL, designed to share common functionality and management scripts across different ORMs (Drizzle, Prisma, Kysely, TypeORM).

## Features

### Admin
Provides database-level management functions, useful for CI/CD or environment initialization.
- `ensureSeedHistoryTable`: Creates and manages a seed execution history table (`__seed_history`).
- `checkSeedExecuted`: Checks if a specific seed has already been executed.
- `recordSeedExecution`: Records the execution status of a seed.
- `checkAndCreateDB`: Checks and automatically creates the database.
- `checkAndCreateSchema`: Checks and automatically creates Schemas.

### Pure
Utility functions that do not depend on database connections.
- `getConnectionStringInfo`: Parses Connection Strings, handling logic for `schema` parameters and merging `search_path` options.

## Installation

```bash
npm install @rfjs/pg-toolkit
# or
pnpm add @rfjs/pg-toolkit
```

## Usage Example

### Managing Seed History

```typescript
import { ensureSeedHistoryTable, checkSeedExecuted, recordSeedExecution } from '@rfjs/pg-toolkit/admin';
import { Client } from 'pg';

const client = new Client(process.env.DATABASE_URL);
await client.connect();

// Ensure history table exists
await ensureSeedHistoryTable(client);

// Check and execute
if (!await checkSeedExecuted(client, 'init_data')) {
  // await runMySeed();
  await recordSeedExecution(client, 'init_data');
}
```