# @rfjs/orm-drizzle

Drizzle ORM 封裝函式庫。

## 安裝

```bash
pnpm add @rfjs/orm-drizzle
```

## TypeScript 版本支援

此模板將 `typescript` 鎖在 `^5.7.3`。這個鎖定**只**是為了 lint——`pnpm build`、
`pnpm typecheck` 以及產出的 `.d.ts` 都已在 `typescript@7.0.2` 下驗證過，型別內容完全相同。

| 指令 | TypeScript 5.x | TypeScript 7.x |
| --- | --- | --- |
| `pnpm build`（tsdown，含 `.d.ts`） | 可用 | 可用 |
| `pnpm typecheck`（`tsc --noEmit`） | 可用 | 可用 |
| `pnpm lint`（typescript-eslint） | 可用 | **失敗** |

**為什麼 TS 7 下 lint 會失敗。** `@typescript-eslint/*` 的 `typescript` peer 目前仍限制在
6 以下，且其 type-aware 規則會讀取 TS 7（原生 Go 編譯器）不再公開的 compiler 內部結構，
`pnpm lint` 會直接以 `TypeError: Cannot read properties of undefined` 中止。等
typescript-eslint 支援 TS 7 後即可解除；在那之前請保留 `^5.7.3`（或讓其他套件跑 TS 7，
只對這個套件單獨鎖 5.x）。

### 兩個值得知道的建置限制

- **`tsdown.config.ts` 裡的 `dts: { oxc: false }` 必須保留。** oxc 的 `.d.ts` backend 是
  `isolatedDeclarations` 產生器，完全不做型別推斷，因此 `export const usersTable =
  pgTable(...)` 會直接報 `TS9010: Variable must have an explicit type annotation`。
  drizzle `pgTable` 的回傳型別是巨大的泛型 `PgTableWithColumns<...>`，不可能手寫標注，
  所以推斷必須交給 TypeScript backend。
- **`tsconfig.build.json` 不能設定 `declarationDir`。** 在 TS 7 下，`.d.ts` 這一步會以
  `--outDir <暫存目錄>` 呼叫 `tsgo`，而宣告檔輸出的優先權是 `declarationDir` 高於
  `outDir`——宣告檔會被寫到 `./types`，建置便以
  `tsgo did not generate dts file for src/index.ts` 失敗。build config 已將其重設為
  `null`，若要修改 tsconfig 請維持這個設定。

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
