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
  schema: 'public', // 選用：指定 schema（預設為 `public`）
  migrationsFolder: 'node_modules/@rfjs/orm-drizzle/dist/drizzle', // 選用：遷移檔案路徑
});
```

> **Schema 一致性。** `drizzle-kit generate` 產出的 migration 會把 enum 型別與
> FK 目標硬綁到 `public.`，因此 migration 必須在 `public` schema 下執行——這也是
> `schema` 預設為 `public` 的原因。若在其他 `search_path` 下執行 migrate，會解析
> 不到那些 enum/FK；再加上每個 schema 各自的 `__drizzle_migrations` 追蹤表是空的，
> 會從 `0000` 重播所有 migration。若真的需要非 `public` 的 schema，請改用 drizzle
> [`pgSchema()`](https://orm.drizzle.team/docs/schemas) 定義 table，讓 `generate`
> 的輸出也綁到同一個 schema，端到端保持一致。

### 資料庫種子 (Seeding)

可以使用 `seedToLatest` 來執行種子資料填入。

```typescript
import { seedToLatest } from '@rfjs/orm-drizzle';

await seedToLatest(process.env.DATABASE_URL, 'public');
```
