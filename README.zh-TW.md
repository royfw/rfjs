# rfjs

一個 Turborepo monorepo 與模板集合，供 [start-ts-by](https://www.npmjs.com/package/start-ts-by) CLI 使用。內含可用於正式環境的 TypeScript 專案模板，涵蓋應用程式、函式庫、CLI、ORM 封裝與 monorepo 骨架。

`apps/web` 是 rfjs 的網頁遊樂場與開發者工具展示站；`apps/workbench` 是管理端應用，其 dataset explorer 提供視覺化查詢建構器，由 `apps/api` + `libs/core` + `libs/db` 支撐。

## 套件

### 已發布函式庫（`@rfjs/*`）

| 套件 | 說明 |
|------|------|
| [@rfjs/data-expr](packages/data-expr) | 安全的 JSON 運算式引擎（JSONata 封裝）— 編譯一次重複求值、DoS 防護、不使用 `eval` |
| [@rfjs/data-filter](packages/data-filter) | 記憶體內過濾與映射 — scalar/object/array/elemmatch 條件、`=` 計算式、邏輯運算子 |
| [@rfjs/data-label](packages/data-label) | 從資料路徑、值對照表與模板組合顯示用標籤字串 |
| [@rfjs/data-transform](packages/data-transform) | 資料型別轉換工具 — typeTransfer、jsonbTransfer、toBoolean、toDateString |
| [@rfjs/filter-builder](packages/filter-builder) | 框架無關的 canonical 過濾樹 — 編輯模型、schema 推斷、反向解析，並可編譯到下列 SQL／記憶體引擎 |
| [@rfjs/jsonb-query](packages/jsonb-query) | PostgreSQL JSONB SQL 查詢建構器（WHERE/ORDER BY；legacy 與 jsonpath 兩種 dialect） |
| [@rfjs/jwt](packages/jwt) | JWT 簽發、驗證與解碼輔助工具 |
| [@rfjs/mongo-query](packages/mongo-query) | 由結構化過濾 metadata 建構 MongoDB 查詢 |
| [@rfjs/object-utils](packages/object-utils) | 物件工具 — flatten、keysToNested、toJSONString、toFlatString |
| [@rfjs/pg-filter](packages/pg-filter) | 統一的 PostgreSQL 過濾建構器 — 在同一棵樹中巢狀組合欄位條件與 JSONB 條件，並支援排序與分頁 |
| [@rfjs/pg-toolkit](packages/pg-toolkit) | 適用於 Drizzle、Prisma、Kysely、TypeORM 的 PostgreSQL 工具 |
| [@rfjs/retry](packages/retry) | 可設定延遲與最大次數的重試輔助工具 |
| [@rfjs/sql-filter](packages/sql-filter) | 通用的布林過濾群組 → 參數化 SQL，可插拔 leaf renderer |
| [@rfjs/tpl-toolkit](packages/tpl-toolkit) | 專案模板共用的設定工廠與建置輔助工具 |

四個過濾套件分層組合：`sql-filter`（通用引擎）← `pg-filter` / `jsonb-query`（Postgres 特化），`filter-builder` 則是高階樹模型，可編譯到上述任一引擎（或記憶體內的 `data-filter`）。

### 內部套件（private）

| 套件 | 說明 |
|------|------|
| @rfjs/web-core | `apps/web` 與 `apps/workbench` 的工具／套件 registry、zod schema 與 fixtures |
| @rfjs/web-ui | `apps/web` 與 `apps/workbench` 的設計 token、Tailwind preset 與 shadcn 元件 |
| @rfjs/filter-builder-ui | 建立在 `@rfjs/filter-builder` 之上的 React 過濾樹編輯器（`<FilterTreeEditor>` + `useFilterTree`）；由 `apps/workbench` 使用 |

## 應用程式

| 應用程式 | 說明 |
|----------|------|
| [api](apps/api) | Fastify REST API（esbuild）— 提供 workbench 的 dataset 端點 |
| [web](apps/web) | Next.js 網頁應用 — 套件與開發者工具展示站 |
| [workbench](apps/workbench) | Next.js 管理端應用 — 含視覺化查詢建構器的 dataset explorer |

## 模板

透過 `start-ts-by` CLI 發布的獨立專案模板。完整清單見 [templates/registry.json](templates/registry.json)。

- **Apps**：`app-esbuild`、`app-tsdown`、`fastify-esbuild`、`fastify-tsdown`、`fastify-gql-tsdown`、`koa-esbuild`
- **Libs**：`lib-esbuild`、`lib-tsdown`、`lib-rollup`、`lib-rolldown`
- **CLI**：`bin-tsdown`
- **Docs**：`docs-docsify`、`docs-vitepress`
- **ORM**：`orm-drizzle`、`orm-kysely`、`orm-prisma`、`orm-typeorm`
- **BullMQ**：`bull-api`、`lib-queue`
- **Monorepo**：`turbo`

## 內部函式庫（`libs/`）

| 函式庫 | 說明 |
|--------|------|
| @rfjs/core | Workbench 業務邏輯 — 每個模組一個資料夾（目前為 `dataset`），遵循 schema → repository → usecase |
| @rfjs/db | Workbench 的 Drizzle PostgreSQL plumbing — 連線、schema、migrations、seed |

`@rfjs/core` 與 `@rfjs/db` 支撐 `apps/workbench` 的 dataset explorer（透過 `apps/api`）。ORM 封裝（Drizzle / Kysely / Prisma / TypeORM,共用 `migrateToLatest` / `seedToLatest` API）以獨立 scaffold 形式提供 —— 見上方 **ORM** 模板。
