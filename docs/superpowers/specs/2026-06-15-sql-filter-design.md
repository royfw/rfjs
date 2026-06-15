# `@rfjs/sql-filter` 設計

**日期:** 2026-06-15
**狀態:** 已核可(brainstorming 完成;待 writing-plans)
**範圍:** 一個通用的布林 filter-group 引擎(and/or/nor/not、巢狀、空組 identity、參數位移),搭配可插拔的 leaf renderer;內建一個 column leaf(對真實 SQL 欄位做 WHERE/ORDER BY)。輸出標準 PostgreSQL 定位參數 SQL。

## 背景

`@rfjs/jsonb-query` 把「巢狀 filter group → SQL」做在 jsonb 欄位上,但它的 group 引擎(and/or/nor/not、巢狀、空組 identity、參數位移)其實與葉節點無關——jsonb 專屬的只有葉節點渲染。本套件把這個**通用 group 引擎**正式化,並讓葉節點渲染**可插拔**:內建 column leaf(對真實欄位)為主力,消費端可注入其他 leaf。

直接動機:workbench 的 `datasets` 需要對 **top-level 欄位**(`name`/`createdAt`…)做巢狀過濾與排序,並能與 jsonb 過濾**混在同一棵邏輯樹**(跨空間 OR)。`@rfjs/sql-filter` 提供 column 能力與可插拔引擎;datasets 之後注入一個委派給 jsonb-query 的 jsonb leaf 即可達成統一樹。這是子專案 1;datasets 的消費是獨立的子專案 2。

## 架構

兩層,刻意分離:

- **通用 group 引擎(與葉節點無關):** `buildFilterGroup`、`ParamBuilder`、`ColumnQueryError`、型別。沿用 jsonb-query 的 `buildGroup`/`joinLogic`/空組 identity/`wrap` 模式。
- **內建 column leaf(sub-domain,放 `column/`):** 用消費端宣告的 `ColumnConfig`(白名單 + 型別)把 `ColumnCondition` 渲染成參數化 SQL;附 `buildColumnQuery`(便利包裝)與 `buildColumnOrderBy`。

```
src/
  types.ts          LogicalOperator、FilterGroup<L>
  param-builder.ts  ParamBuilder（offset → $N、values）
  errors.ts         ColumnQueryError + ColumnQueryErrorCode
  engine.ts         buildFilterGroup<L>(group, renderLeaf, params): string
  column/
    config.ts       ColumnType、ColumnConfig
    operators.ts    ColumnOperator、型別可用性表、單一條件 → SQL
    leaf.ts         ColumnCondition、makeColumnLeafRenderer(config)
    build.ts        buildColumnQuery(config, group, opts?)
    order-by.ts     buildColumnOrderBy(config, sorts, opts?)
    index.ts        column barrel
  index.ts          套件 barrel
```

## 通用核心(API)

```ts
export type LogicalOperator = 'and' | 'or' | 'nor' | 'not';
export type FilterGroup<L> = { logic: LogicalOperator; filters: Array<L | FilterGroup<L>> };

export class ParamBuilder {            // 與 jsonb-query 同形,獨立一份
  constructor(offset?: number);
  add(value: unknown): string;          // 推入值,回傳 `$N`
  get values(): unknown[];
}

// 葉節點渲染由呼叫端提供;引擎只負責邏輯/巢狀/空組 identity/否定/括號
export function buildFilterGroup<L>(
  group: FilterGroup<L>,
  renderLeaf: (leaf: L, params: ParamBuilder) => string,
  params: ParamBuilder,
): string;

export type ColumnQueryErrorCode =
  | 'UNKNOWN_COLUMN'        // field 不在 ColumnConfig
  | 'UNSUPPORTED_OPERATOR'  // operator 對該欄位型別不適用
  | 'INVALID_VALUE'         // 例如 isnull 帶 value、range 不是長度 2
  | 'INVALID_SORT'          // 排序 direction/nulls 不合法
  | 'INVALID_PARAM_OFFSET';
export class ColumnQueryError extends Error { readonly code: ColumnQueryErrorCode }
```

空組 identity 與 jsonb-query 一致:`and→'true'`、`or→'false'`、`not→'false'`、`nor→'true'`。

## 內建 column leaf(API)

```ts
export type ColumnType = 'text' | 'numeric' | 'timestamp' | 'boolean' | 'uuid';
export type ColumnConfig = Record<string, { column: string; type: ColumnType }>;

export type ColumnOperator =
  | 'eq' | 'neq' | 'isnull' | 'isnotnull'   // 全型別
  | 'contains' | 'startswith'               // text
  | 'gt' | 'gte' | 'lt' | 'lte';            // numeric / timestamp（text 也允許 gt..lte 作字典序）

export type ColumnCondition = { column: string; operator: ColumnOperator; value?: unknown };

export function makeColumnLeafRenderer(
  config: ColumnConfig,
): (leaf: ColumnCondition, params: ParamBuilder) => string;

export function buildColumnQuery(
  config: ColumnConfig,
  group: FilterGroup<ColumnCondition>,
  options?: { paramOffset?: number },
): { where: string; values: unknown[] };

export type ColumnSortSpec = { column: string; direction?: 'asc' | 'desc'; nulls?: 'first' | 'last' };
export function buildColumnOrderBy(
  config: ColumnConfig,
  sorts: ColumnSortSpec[],
  options?: { paramOffset?: number },   // 為與 WHERE 組合保留;column 排序本身不產生參數
): { orderBy: string; values: unknown[] };
```

### v1 operator 範圍(先做一版,加強另議)

- 全型別:`eq` `neq` `isnull` `isnotnull`
- text:`+ contains`(`ILIKE '%' || $n || '%'`)、`startswith`(`ILIKE $n || '%'`)
- numeric / timestamp / text:`+ gt` `gte` `lt` `lte`
- **延後(加強階段):** `in`、`endswith`、`between/range`、大小寫不敏感變體、`boolean`/`uuid` 的比較運算等。

operator × 型別的可用性由 `operators.ts` 的對照表決定;不適用即丟 `ColumnQueryError('UNSUPPORTED_OPERATOR')`。`isnull`/`isnotnull` 不得帶 `value`,否則 `INVALID_VALUE`。

## 渲染與安全

- 單一條件渲染:`"<config[field].column>" <opSql> <param>`。欄位識別字**只能**來自 `ColumnConfig`(以 `"..."` 加引號;`field` 不在 config 即 `UNKNOWN_COLUMN`),**絕不**取使用者輸入字串。
- 所有比較值一律走 `ParamBuilder.add()` 變成 `$N`,值不進 SQL 字串 → 無 injection。
- `contains`/`startswith` 用 `value || '%'` 串接是在 **SQL 端**對參數做(`$n || '%'`),不是字串拼接 → 仍安全。
- `buildColumnOrderBy`:`column`/`direction`/`nulls` 皆驗證(direction ∈ asc/desc、nulls ∈ first/last),欄位名來自 config → 安全。

## 可插拔路徑(供子專案 2 的統一樹)

`buildFilterGroup` 與 `ParamBuilder` 為公開 API。datasets 可組一棵 `FilterGroup<ColumnCondition | JsonbLeaf>`,提供一個會分派的 `renderLeaf`:`ColumnCondition` → `makeColumnLeafRenderer(config)`;jsonb leaf → `buildJsonbQuery('data', { logic:'and', filters:[leaf] }, { paramOffset })` 取得單一條件片段。引擎負責 and/or/nor/not 與參數位移,達成跨空間混用。(此整合屬子專案 2,本 spec 不實作。)

## 錯誤處理

`buildColumnQuery`/`buildColumnOrderBy`/`makeColumnLeafRenderer` 對不合法輸入丟 `ColumnQueryError`(具 `code`),呼叫端(如 apps/api)可映射為 400——與 `JsonbQueryError` 同模式。

## 測試

純單元測試(無需 DB,與 jsonb-query 同):
- **engine:** and/or/nor/not 連接、巢狀括號、空組 identity(四種)、not/nor 否定、`paramOffset` 起算正確、leaf renderer 被正確呼叫。
- **column leaf / build:** 每個 operator × 型別組合的 SQL 與參數;`UNKNOWN_COLUMN`、`UNSUPPORTED_OPERATOR`、`INVALID_VALUE` 各自拋錯;injection 安全(欄位名只來自 config、值皆參數)。
- **order-by:** 多欄排序、direction/nulls、非法值拋 `INVALID_SORT`、欄位名來自 config。
- **pluggable:** 用一個假 leaf renderer 驗證 `buildFilterGroup` 與 leaf 種類無關。

## 套件設定

比照 `@rfjs/jsonb-query`:public(`publishConfig.access: public`、ISC、`version: 0.0.0`)、tsdown 雙輸出、`sideEffects: false`、vitest、co-located `*.spec.ts`、`src/index.ts` 為唯一 exports 入口。`packages/sql-filter/`。需要時加入 `templates/registry.json` / 套件清單 skill(屬發佈準備,非本輪)。

## 不在本輪範圍

- 加強版 operators(見上)。
- 子專案 2:datasets 對 `@rfjs/sql-filter` + `@rfjs/jsonb-query` 的整合、sort/pagination/total、統一樹注入。
- 把 jsonb-query 重構成共用 group 引擎(路線 3)——本套件先自帶引擎;未來若要消除重複再議。
- npm 實際發佈(走既有 changeset 流程,另行處理)。
