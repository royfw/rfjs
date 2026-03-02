# @rfjs/orm-prisma

Prisma ORM 封裝函式庫。

## 安裝

```bash
pnpm add @rfjs/orm-prisma
```

## 環境變數

此函式庫依賴以下環境變數：

- `DATABASE_URL`: PostgreSQL 連線字串。

## 使用方式

### 資料庫連線

```typescript
import { createDb } from '@rfjs/orm-prisma';

// 初始化 Prisma Client
const { db } = createDb(process.env.DATABASE_URL);
```

### 資料庫遷移 (Migrations)

您可以使用匯出的 `migrateToLatest` 函式來執行遷移。

```typescript
import { migrateToLatest } from '@rfjs/orm-prisma';

await migrateToLatest({
  connectionString: process.env.DATABASE_URL,
  schemaFilePath: 'node_modules/@rfjs/orm-prisma/dist/prisma/schema.prisma', // schema.prisma 檔案路徑
  configFilePath: 'node_modules/@rfjs/orm-prisma/dist/prisma.config.ts',   // prisma 設定檔路徑
  schema: 'app_prisma', // 選用：schema 名稱
});
```

### 資料庫種子 (Seeding)

```typescript
import { seedToLatest } from '@rfjs/orm-prisma';

await seedToLatest(process.env.DATABASE_URL, 'app_prisma');
```
