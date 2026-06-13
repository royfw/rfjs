# @rfjs/pg-toolkit

PostgreSQL 工具庫，提供跨 ORM (Drizzle, Prisma, Kysely, TypeORM) 共用的基礎功能與管理腳本。

## 功能特色

### Admin (管理工具)
提供資料庫層級的管理功能，通常用於 CI/CD 或開發環境初始化。
- `ensureSeedHistoryTable`: 建立並管理種子資料執行紀錄表 (`__seed_history`)。
- `checkSeedExecuted`: 檢查特定種子資料是否已執行。
- `recordSeedExecution`: 紀錄種子資料執行狀態。
- `checkAndCreateDB`: 檢查並自動建立資料庫。
- `checkAndCreateSchema`: 檢查並自動建立 Schema。

### Pure (純函數)
不依賴資料庫連線的工具函數。
- `getConnectionStringInfo`: 解析 Connection String，處理 `schema` 參數與 `search_path` options 的合併邏輯。

## 安裝

```bash
npm install @rfjs/pg-toolkit
# 或
pnpm add @rfjs/pg-toolkit
```

## 使用範例

### 管理種子紀錄

```typescript
import { ensureSeedHistoryTable, checkSeedExecuted, recordSeedExecution } from '@rfjs/pg-toolkit/admin';
import { Client } from 'pg';

const client = new Client(process.env.DATABASE_URL);
await client.connect();

// 確保紀錄表存在
await ensureSeedHistoryTable(client);

// 檢查並執行
if (!await checkSeedExecuted(client, 'init_data')) {
  // await runMySeed();
  await recordSeedExecution(client, 'init_data');
}
```
