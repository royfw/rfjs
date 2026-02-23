# @rfjs/orm-drizzle

Drizzle ORM 封裝函式庫。

## 安裝

```bash
pnpm add @rfjs/orm-drizzle
```

## 環境變數

此函式庫依賴以下環境變數：

- `DATABASE_URL`: PostgreSQL 連線字串。

## 使用方式

### 資料庫連線

```typescript
import { createDb } from '@rfjs/orm-drizzle';

// 初始化資料庫連線
const { db, pool } = createDb(process.env.DATABASE_URL);
```

### 資料庫遷移 (Migrations)

您可以使用匯出的 `migrateToLatest` 函式來執行遷移。這通常在應用程式的遷移腳本中使用。

```typescript
import { migrateToLatest } from '@rfjs/orm-drizzle';

await migrateToLatest({
  connectionString: process.env.DATABASE_URL,
  schema: 'public', // 選用：指定 schema
  migrationsFolder: 'node_modules/@rfjs/orm-drizzle/dist/drizzle', // 選用：遷移檔案路徑
});
```

### 資料庫種子 (Seeding)

可以使用 `seedToLatest` 來執行種子資料填入。

```typescript
import { seedToLatest } from '@rfjs/orm-drizzle';

await seedToLatest(process.env.DATABASE_URL, 'public');
```
