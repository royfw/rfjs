# @rfjs/orm-typeorm

TypeORM 封裝函式庫。

## 安裝

```bash
pnpm add @rfjs/orm-typeorm
```

## 環境變數

此函式庫依賴以下環境變數：

- `DATABASE_URL`: PostgreSQL 連線字串。

## 使用方式

### 資料庫連線

```typescript
import { createDb } from '@rfjs/orm-typeorm';

// 初始化 Data Source
const { db: dataSource } = createDb(process.env.DATABASE_URL);
```

### 資料庫遷移 (Migrations)

您可以使用匯出的 `migrateToLatest` 函式來執行遷移。請注意，遷移檔案已打包在此函式庫中。


```typescript
import { migrateToLatest } from '@coa/orm-core';

await migrateToLatest({
  connectionString: process.env.DATABASE_URL,
  schema: 'app_typeorm', // 選用：schema 名稱
});
```

#### 1. 新增 entity，建立新遷移檔案

在 `src/entities` 目錄下建立完後，可以使用：
```sh
pnpm typeorm migration:generate src/migrations/{MigrationName}
# ex: pnpm migration:generate src/migrations/create-demo
```

再執行
```sh
# 建立 migrations index
pnpm migrate:gen-index

# migrate db
pnpm migrate
```

#### 2. 建立空的遷移檔案

在 `src/migrations` 目錄下建立空的遷移檔案，可以使用：
```sh
pnpm migration:create src/migrations/{MigrationName}
# ex: pnpm migration:create src/migrations/create-empty
```

再執行
```sh
# 建立 migrations index
pnpm migrate:gen-index

# migrate db
pnpm migrate
```


### 資料庫種子 (Seeding)

```typescript
import { seedToLatest } from '@coa/orm-core';

await seedToLatest(process.env.DATABASE_URL, 'app_typeorm');
```

#### 新增種子檔案

```ts
import { DemoEntity, DemoEntityInsert } from '@/entities';
import { DataSource } from 'typeorm';

const data: DemoEntityInsert[] = [
  {
    content: 'alice@prisma.io',
    complete: false,
  },
];

export async function seed(db: DataSource): Promise<void> {
  const repo = db.getRepository(DemoEntity);
  await repo.insert(data);
}
```

```sh
# 建立 seeds index
pnpm seed:gen-index

# seed db
pnpm seed
```
