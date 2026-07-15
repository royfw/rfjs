# 設計：`@rfjs/pg-filter` 統一過濾套件 + datasets 整合

日期：2026-06-16
狀態：設計定稿（待實作）

## 背景與目標

`datasets` 的 `POST /datasets/query` 目前只能過濾 `data`(jsonb)欄位。使用者要的是：**在同一棵 AND/OR 巢狀樹裡,同時過濾頂層欄位(`name`/`created_at`…)與 jsonb `data` 內任意 key**,並補上排序與分頁。

repo 已有兩塊現成能力:

- **`@rfjs/sql-filter`**:leaf-agnostic 的群組引擎 `buildFilterGroup<L>(group, renderLeaf, params)`(and/or/nor/not、巢狀、空組 identity、`ParamBuilder` 參數位移),外加內建 **column 葉**(`makeColumnLeafRenderer`、`buildColumnQuery`、`buildColumnOrderBy`,型別 text/numeric/timestamp/boolean/uuid)。
- **`@rfjs/jsonb-query`**:`buildJsonbQuery(column, filter, {dialect, paramOffset})` 把 jsonb 條件編成 SQL;`buildJsonbOrderBy(column, sorts, {paramOffset})` 編 ORDER BY 片段。

本案**新增第三個套件 `@rfjs/pg-filter`**,把上述兩者組合成「一棵可混用 column 與 jsonb 葉子的巢狀過濾樹 + 排序 + 分頁」的高階 builder;再讓 `datasets` 成為它的第一個消費者。

開新套件而非寫在消費端,是因為本 repo 的使命就是把通用能力抽成公開 `@rfjs/*` 套件(見 memory `rfjs-open-source-and-layering`)。「PostgreSQL 統一過濾」是貨真價實的通用能力,datasets 只是它的第一個 demo 消費者。

## 架構：依賴 DAG 與耦合方式

```
@rfjs/pg-filter  ──depends──▶  @rfjs/sql-filter   (引擎 + column 葉 + ParamBuilder)
       └─────────depends──────▶  @rfjs/jsonb-query  (jsonb 葉 SQL / ORDER BY 片段)
```

無循環依賴。耦合點是 sql-filter 刻意 export 的 `renderLeaf` 接縫:

- **巢狀邏輯的唯一真相來源 = sql-filter 引擎**。所有 `and/or/nor/not`、任意深度巢狀、空組 identity、參數編號,一律由 `buildFilterGroup` 處理。
- **jsonb-query 被降級成「單葉翻譯器」**。走到一片 jsonb 葉時,用 singleton-group 技巧 `buildJsonbQuery(jsonbColumn, { logic:'and', filters:[該葉] }, { dialect, paramOffset })` 借它把單一條件編成 SQL,**完全不使用 jsonb-query 自己的群組巢狀機制**(唯一例外:`elemmatch` 葉內「每元素」的子條件,本質是 jsonb 內部巢狀,仍由 jsonb-query 處理)。

兩套件均不修改內部。**唯一可能的微調**:`renderLeaf` 內呼叫 `buildJsonbQuery` 時需要算出目前已用的參數絕對數量當 `paramOffset`。做法是 pg-filter 自己建立頂層 `ParamBuilder(paramOffset)` 並 **closure 捕捉 `paramOffset`**,絕對位移 = `paramOffset + params.values.length`——因此 **sql-filter 不需任何改動**。

### 巢狀模型:純葉子

每個 jsonb 條件都是樹上一片**獨立葉子**。`data.a > 1 OR data.b < 2` = sql-filter 的 OR 群組底下兩片 jsonb 葉,各自 singleton 翻譯。產出多個 `jsonb_path_exists(...)` 以 OR 串接,正確性與「一次 jsonpath 表達兩條件」相同。好處:對外只有「一棵樹、一套巢狀模型」,概念最乾淨,也鋪好未來收斂(把 jsonb 葉翻譯直接做成 sql-filter renderer)的路。

## `@rfjs/pg-filter` 公開 API

### 型別(`src/types.ts`)

葉子用**顯式 `target` 判別**(discriminated union),理由:公開套件 API 應優先無歧義、好錯誤訊息、自我文件化;且天然對應 zod `discriminatedUnion`;且杜絕「欄位名與 jsonb key 撞名」的安靜判錯。

```ts
import type { FilterGroup } from '@rfjs/sql-filter';
import type { ColumnType, ColumnOperator } from '@rfjs/sql-filter';
import type {
  JsonbDataType, JsonbScalarType, JsonbDialect,
  JsonbCondition, JsonbFilterGroup,
} from '@rfjs/jsonb-query';

// ── 過濾葉子 ──────────────────────────────────────────────
export interface PgColumnLeaf {
  target: 'column';
  column: string;            // 對應 config.columns 的 key
  operator: ColumnOperator;  // eq/neq/isnull/isnotnull/contains/startswith/gt/gte/lt/lte
  value?: unknown;
}
export interface PgJsonbLeaf {
  target: 'jsonb';           // 'jsonb' 而非 'data':判別「葉子種類」,不綁特定欄位名(欄位名在 config.jsonb.column)
  field: string;
  dataType: JsonbDataType;   // string/numeric/date/boolean/object/array
  operator: string;          // 由 jsonb-query 深度驗證
  value?: unknown;
  elementType?: JsonbScalarType | 'object'; // dataType==='array' 時
  filters?: JsonbFilterGroup;               // operator==='elemmatch' 時的每元素子條件
}
export type PgLeaf = PgColumnLeaf | PgJsonbLeaf;

// 統一過濾樹 = sql-filter 的泛型 FilterGroup 套上 PgLeaf
export type PgFilterGroup = FilterGroup<PgLeaf>;

// ── 排序規格 ──────────────────────────────────────────────
export interface PgColumnSort {
  target: 'column';
  column: string;
  direction?: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}
export interface PgJsonbSort {
  target: 'jsonb';
  field: string;
  dataType: JsonbScalarType;  // 只有 scalar 可排序
  direction?: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}
export type PgSort = PgColumnSort | PgJsonbSort;

// ── 設定與輸入 / 輸出 ─────────────────────────────────────
export interface PgFilterConfig {
  columns: Record<string, { column: string; type: ColumnType }>; // = sql-filter ColumnConfig
  jsonb: { column: string; dialect?: JsonbDialect };             // 預設 dialect 'legacy';datasets 用 'jsonpath'
}
export interface PgFilterInput {
  filter?: PgFilterGroup;
  sort?: PgSort[];
  page?: number;       // 1-based;預設 1
  pageSize?: number;   // 省略 → 無 LIMIT
}
export interface PgFilterResult {
  where: string;          // 永不為空;無 filter 時為 'true'
  orderBy: string;        // 可為 ''(無 sort)
  limit?: number;         // pageSize 給定時 = pageSize
  offset?: number;        // pageSize 給定時 = (page-1)*pageSize
  values: unknown[];      // 主查詢用 = WHERE 參數 ++ ORDER BY 參數(依 $N 順序)
  countValues: unknown[]; // COUNT 查詢用 = 僅 WHERE 參數(values 的前綴)
}
```

> **為何分兩個 values 陣列**:`COUNT(*) … WHERE {where}` 只引用 WHERE 的 `$1..$k`,而主查詢 `SELECT … WHERE {where} ORDER BY {orderBy}` 引用全部 `$1..$m`(ORDER BY 的 jsonb-sort 會佔用 `$k+1..$m`)。`countValues` 即 `values` 的前綴,直接給消費端兩種用法,免去自行切片出錯。

### 進入點(`src/build.ts`)

```ts
export function buildPgFilter(config: PgFilterConfig, input: PgFilterInput): PgFilterResult;
```

責任:filter + sort +(薄)pagination。內部模組拆分(扁平佈局,≤7 模組):

- `src/filter.ts` — `buildPgWhere(config, group, paramOffset)`:建 `ParamBuilder(paramOffset)`,以 dispatching `renderLeaf` 呼叫 `buildFilterGroup`。`renderLeaf`:`target:'column'` → `makeColumnLeafRenderer(config.columns)`(把 `PgColumnLeaf` 去掉 `target` 當 `ColumnCondition`);`target:'jsonb'` → singleton `buildJsonbQuery(config.jsonb.column, {logic:'and',filters:[去 target 的葉]}, {dialect, paramOffset: paramOffset + params.values.length})`,再把回傳 `values` 逐一 `params.add` 推進共用計數器。回傳 `{ where, values }`。
- `src/order-by.ts` — `buildPgOrderBy(config, sorts, paramOffset)`:依序走訪混合 sort 陣列,維持連續參數編號。column-sort → `buildColumnOrderBy`(無參數);jsonb-sort → `buildJsonbOrderBy(config.jsonb.column, [spec], {paramOffset: 累進})`(field 路徑佔一參數),累加 values。逐片段以 `, ` 串接。回傳 `{ orderBy, values }`。
- `src/pagination.ts` — `computeLimitOffset({page, pageSize})`:`page` 預設 1;驗證皆為正整數(否則丟 `PgFilterError('INVALID_PAGINATION')`);`pageSize` 省略 → `{}`(無 limit/offset);否則 `{ limit: pageSize, offset: (page-1)*pageSize }`。
- `src/build.ts` — `buildPgFilter`:`where = buildPgWhere(...0)`;`orderBy = buildPgOrderBy(..., where.values.length)`;`countValues = where.values`;`values = [...where.values, ...orderBy.values]`;併入 `computeLimitOffset`。

### 錯誤(`src/errors.ts`)

```ts
export type PgFilterErrorCode = 'INVALID_TARGET' | 'INVALID_PAGINATION';
export class PgFilterError extends Error { constructor(message: string, readonly code: PgFilterErrorCode) }
```

- `renderLeaf` / sort dispatch 遇到非法 `target` → `INVALID_TARGET`。
- 分頁非正整數 → `INVALID_PAGINATION`。
- column 葉/排序的 `UNKNOWN_COLUMN`、`UNSUPPORTED_OPERATOR` 等由 `@rfjs/sql-filter` 的 `ColumnQueryError` 拋出;jsonb 葉/排序的問題由 `@rfjs/jsonb-query` 的 `JsonbQueryError` 拋出。**pg-filter 不包裹這些**,讓三種錯誤型別各自向上傳遞,由消費端統一對應 400。

### 安全性

- 所有值一律走位置參數 `$N`(`ParamBuilder` / 兩個 dep builder 的既有保證)。
- 識別字(欄位名)只來自 `config` 宣告,經各自的 `quoteIdent` / `quoteJsonbColumn`。
- `limit`/`offset` 經正整數驗證後以**整數**回傳(非位置參數);整數無注入面,消費端可安全內插 `LIMIT n OFFSET m`。此為刻意取捨——避免分頁參數混入 WHERE/ORDER BY 的參數序列、保持 `values` 順序單純。

### 套件外形

公開、ISC、version `0.0.0`、純函式無 runtime deps(僅 `dependencies` 含 `@rfjs/sql-filter`、`@rfjs/jsonb-query` 兩個 workspace 套件)。tsdown(esm+cjs+dts)、vitest、co-located `*.spec.ts`、單一 `src/index.ts` barrel。config(tsconfig、tsdown.config、vitest.config)鏡像 `sql-filter`/`jsonb-query`。

## datasets 整合(第二塊)

把 `POST /datasets/query` 從「jsonb-only 過濾」升級為「統一過濾 + 排序 + 分頁」。**這是對該端點的破壞性變更**(body 形狀改變);因屬 demo 且 pre-1.0、無已知線上消費者(`apps/web` 的 query-builder 為純前端、不呼叫此 API),同一 PR 內更新測試即可。

### dataset 的設定

```ts
const datasetPgConfig: PgFilterConfig = {
  columns: {
    id:          { column: 'dataset_id', type: 'uuid' },
    name:        { column: 'name',        type: 'text' },
    description: { column: 'description', type: 'text' },
    createdAt:   { column: 'created_at',  type: 'timestamp' },
    updatedAt:   { column: 'updated_at',  type: 'timestamp' },
  },
  jsonb: { column: 'data', dialect: 'jsonpath' },
};
```

### 請求 / 回應

- Body:`{ filter?: PgFilterGroup, sort?: PgSort[], page?: number, pageSize?: number }`
- 回應:`{ items: Dataset[], total: number, page: number, pageSize: number }`

### 排序穩定性

datasets 在送進 `buildPgFilter` 前,於使用者 `sort` 後面**追加穩定 tiebreaker**:`{target:'column', column:'createdAt', direction:'desc'}` 與 `{target:'column', column:'id', direction:'asc'}`(對應 `created_at desc, dataset_id asc`)。這保證 LIMIT/OFFSET 結果具決定性,也是「未給 sort 時」的預設排序。tiebreaker 是消費端政策,不寫進 pg-filter。

### 分頁政策

由 datasets 的 zod schema 套用預設與上限:`page` 預設 1;`pageSize` 預設 20、上限 100。pg-filter 只負責「正整數 → limit/offset」的機制。

### 變更清單(libs/core + apps/api)

- `libs/core/src/dataset/query-schema.ts`(新):zod 驗證統一 body。`filter` 用遞迴 `z.lazy` 群組 + `z.discriminatedUnion('target', [columnLeaf, jsonbLeaf])` 葉(沿用既有「淺驗證、深度交給 builder」策略);`sort` 為 discriminatedUnion 陣列;`page`/`pageSize` 套預設與上限。匯出 `QueryDatasetsBody` 型別。
- `libs/core/src/dataset/repository.ts`:`search(filter)` → `query(input): Promise<{ items: Dataset[]; total: number }>`。內部 `buildPgFilter(datasetPgConfig, input)` 後,用 `db.$client` 跑兩段查詢:主查詢 `SELECT … WHERE {where} ORDER BY {orderBy} LIMIT {limit} OFFSET {offset}` 帶 `values`;`SELECT COUNT(*) … WHERE {where}` 帶 `countValues`。
- `libs/core/src/dataset/usecase/query-datasets.ts`(取代 `search-datasets.ts`):驗證 body → `repo.query` → 回傳 `{ items, total, page, pageSize }`。
- `libs/core/src/dataset/filter-schema.ts`:移除或併入 `query-schema.ts`。
- `apps/api`:handler `searchDatasetsHandler` → `queryDatasetsHandler`;route 維持 `POST /datasets/query`;`datasource` 組裝改用 `query` usecase。
- `apps/api/.../register-error-handler.ts`:新增 `ColumnQueryError`(來自 `@rfjs/sql-filter`)與 `PgFilterError`(來自 `@rfjs/pg-filter`)→ 400,訊息含 `code`(與既有 `JsonbQueryError` 分支一致)。

## 測試策略

- **`@rfjs/pg-filter` 單元(TDD)**:純 column 樹;純 jsonb 樹;混合巢狀(column AND (jsonb OR column));空 filter → `where='true'`;空 sort → `orderBy=''`;參數連續性(WHERE→ORDER BY 跨界編號正確、無撞號);混合 sort 順序保留;`elemmatch` jsonb 葉攜帶子群組;分頁 limit/offset 計算與非正整數錯誤;非法 target 錯誤;注入嘗試(欄位名/jsonb 欄名)被拒。
- **datasets**:usecase 驗證 + 委派;repository 以 mock `db.$client` 驗證送出的 SQL/參數/COUNT;既有 e2e(真 PG)擴充涵蓋混合過濾 + 排序 + 分頁 + total。
- 全程 co-located `*.spec.ts`;沿用各套件既有 vitest 設定。

## YAGNI / 範圍外

- 不新增過濾運算子(in/endswith/range 等)——沿用兩 dep 既有能力。
- 不做 jsonb-query 收斂重構(Option C)——留待 canonical-model lib 那波。
- 前端(`apps/web` #165 / workbench filter UI)不在本案;前端未來只需於送出時對 column 葉補 `target:'column'`、jsonb 葉補 `target:'jsonb'` 即可對齊。
- 不發布 npm(version 留 `0.0.0`);發布走既有 changeset 流程,另案處理。

## 相關 memory

`sql-filter-and-datasets-query`、`workbench-backend-foundation`、`jsonb-query-two-dialects`、`spec-language-traditional-chinese`、`rfjs-open-source-and-layering`。
