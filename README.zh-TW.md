# rfjs

一個 Turborepo monorepo 與模板集合，供 [start-ts-by](https://www.npmjs.com/package/start-ts-by) CLI 使用。內含可用於正式環境的 TypeScript 專案模板，涵蓋應用程式、函式庫、CLI、ORM 封裝與 monorepo 骨架。

## 套件

### 已發布函式庫（`@rfjs/*`）

| 套件 | 說明 |
|------|------|
| [@rfjs/data-expr](packages/data-expr) | 安全的 JSON 運算式引擎（JSONata 封裝）— 編譯一次重複求值、DoS 防護、不使用 `eval` |
| [@rfjs/data-filter](packages/data-filter) | 記憶體內過濾與映射 — scalar/object/array/elemmatch 條件、`=` 計算式、邏輯運算子 |
| [@rfjs/data-label](packages/data-label) | 從資料路徑、值對照表與模板組合顯示用標籤字串 |
| [@rfjs/data-transform](packages/data-transform) | 資料型別轉換工具 — typeTransfer、jsonbTransfer、toBoolean、toDateString |
| [@rfjs/jsonb-query](packages/jsonb-query) | PostgreSQL JSONB SQL 查詢建構器 |
| [@rfjs/jwt](packages/jwt) | JWT 簽發、驗證與解碼輔助工具 |
| [@rfjs/mongo-query](packages/mongo-query) | 由結構化過濾 metadata 建構 MongoDB 查詢 |
| [@rfjs/object-utils](packages/object-utils) | 物件工具 — flatten、keysToNested、toJSONString、toFlatString |
| [@rfjs/pg-toolkit](packages/pg-toolkit) | 適用於 Drizzle、Prisma、Kysely、TypeORM 的 PostgreSQL 工具 |
| [@rfjs/retry](packages/retry) | 可設定延遲與最大次數的重試輔助工具 |
| [@rfjs/tpl-toolkit](packages/tpl-toolkit) | 專案模板共用的設定工廠與建置輔助工具 |

### 內部套件（private）

| 套件 | 說明 |
|------|------|
| @repo/eslint-config | 共用 ESLint 設定 |
| @repo/typescript-config | 共用 TypeScript 設定 |
| @repo/ui | 共用 React 元件庫 |

## 應用程式

| 應用程式 | 說明 |
|----------|------|
| [api](apps/api) | Fastify REST API（esbuild） |
| [web](apps/web) | Next.js 網頁應用（turbopack） |
| [orm-app](apps/orm-app) | ORM 整合範例（tsdown）— 使用全部 4 個 ORM 函式庫 |

## 模板

透過 `start-ts-by` CLI 發布的獨立專案模板。完整清單見 [templates/registry.json](templates/registry.json)。

- **Apps**：`app-esbuild`、`app-tsdown`、`fastify-esbuild`、`fastify-tsdown`、`fastify-gql-tsdown`、`koa-esbuild`
- **Libs**：`lib-esbuild`、`lib-tsdown`、`lib-rollup`、`lib-rolldown`
- **CLI**：`bin-tsdown`
- **Docs**：`docs-docsify`、`docs-vitepress`
- **ORM**：`orm-drizzle`、`orm-kysely`、`orm-prisma`、`orm-typeorm`
- **BullMQ**：`bull-api`、`lib-queue`
- **Monorepo**：`turbo`

## ORM 函式庫（內部）

`libs/orm-drizzle`、`orm-kysely`、`orm-prisma`、`orm-typeorm` 將各 ORM 的 migrate/seed 流程封裝在共用的 `migrateToLatest` / `seedToLatest` API 之後。可執行的使用範例見 [`apps/orm-app`](apps/orm-app) 以及各套件自身的 README。
