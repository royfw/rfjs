# @rfjs/orm-kysely

Kysely ORM 封裝函式庫。

## 安裝

```bash
pnpm add @rfjs/orm-kysely
```

## 環境變數

此函式庫依賴以下環境變數：

- `DATABASE_URL`: PostgreSQL 連線字串。

## 使用方式

### 資料庫連線

```typescript
import { createDb } from '@rfjs/orm-kysely';

// 初始化 Kysely 實例
const { db } = createDb(process.env.DATABASE_URL);
```

### 資料庫遷移 (Migrations)

您可以使用匯出的 `migrateToLatest` 函式來執行遷移。請注意，遷移檔案已打包在此函式庫中。

```typescript
import { migrateToLatest } from '@rfjs/orm-kysely';

await migrateToLatest({
  connectionString: process.env.DATABASE_URL,
  schema: 'app_kysely', // 選用：schema 名稱
});
```

### 資料庫種子 (Seeding)

```typescript
import { seedToLatest } from '@rfjs/orm-kysely';

await seedToLatest(process.env.DATABASE_URL, 'app_kysely');
```
