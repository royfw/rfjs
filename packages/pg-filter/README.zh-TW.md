# @rfjs/pg-filter

> English → [README.md](./README.md)

統一的 PostgreSQL 篩選建構器:**同一棵篩選樹同時混用純 SQL 欄位與 JSONB 路徑**,編譯成單一參數化的 `WHERE` / `ORDER BY`(外加 `LIMIT` / `OFFSET`)。它組合了 [@rfjs/sql-filter](../sql-filter)(欄位端)與 [@rfjs/jsonb-query](../jsonb-query)(JSONB 端)—— 每個 leaf 自己宣告 `target`,`buildPgFilter` 把整棵樹一起渲染。

---

## 安裝

```bash
npm i @rfjs/pg-filter
```

## 運作方式

```
 一棵 PgFilterGroup(and/or/nor/not,可巢狀)
 ├─ { target: 'column', column, operator, value }   ──▶ @rfjs/sql-filter  →  "name" ILIKE …
 └─ { target: 'jsonb',  field,  operator, value }    ──▶ @rfjs/jsonb-query →  ("data" #>> …)::numeric > …
                         │
                         ▼
        buildPgFilter(config, input)  ──▶  { where, orderBy, limit, offset, values, countValues }
```

欄位 leaf 依**欄位白名單 + 型別表**解析;JSONB leaf 對單一 JSONB **欄位**用指定 dialect 解析。兩股 `$N` 參數會合併成一個有序的 `values` 陣列。

## 用法

```ts
import { buildPgFilter, type PgFilterConfig } from "@rfjs/pg-filter";

const config: PgFilterConfig = {
  columns: { name: { column: "name", type: "text" } },
  jsonb: { column: "data", dialect: "legacy" }, // 或 'jsonpath'(PG12+)
};

const { where, orderBy, limit, offset, values, countValues } = buildPgFilter(config, {
  filter: {
    logic: "and",
    filters: [
      { target: "column", column: "name", operator: "contains", value: "cust" },
      { target: "jsonb", field: "score", dataType: "numeric", operator: "gt", value: 80 },
    ],
  },
  sort: [{ target: "jsonb", field: "score", dataType: "numeric", direction: "desc" }],
  page: 1,
  pageSize: 20,
});

// 執行
const rows = await client.query(
  `SELECT * FROM datasets WHERE ${where} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
  values,
);
const total = await client.query(`SELECT count(*) FROM datasets WHERE ${where}`, countValues);
```

- `where` 永不為空(無條件時為 `'true'`);`orderBy` 無排序時為 `''`。
- `values` = WHERE 參數 **++** ORDER BY 參數(主查詢用);`countValues` = 只有 WHERE 參數(是 `values` 的前綴)—— 給 `COUNT(*)` 查詢用。

## Leaf 與 sort 結構

```ts
type PgColumnLeaf = { target: "column"; column: string; operator: ColumnOperator; value?: unknown };
type PgJsonbLeaf  = { target: "jsonb"; field: string; dataType: JsonbDataType; operator: string;
                      value?: unknown; elementType?: JsonbScalarType | "object"; filters?: JsonbFilterGroup };
type PgSort = { target: "column"; column: string; direction?: "asc"|"desc"; nulls?: "first"|"last" }
            | { target: "jsonb"; field: string; dataType: JsonbScalarType; direction?: "asc"|"desc"; nulls?: "first"|"last" };
```

## Operator

`pg-filter` **不自己定義** operator —— 每個 leaf 用它 target 引擎的集合:

- `target: 'column'` → [@rfjs/sql-filter](../sql-filter#column-operator-與型別) 的**純量欄位** operator(`eq`/`neq`/`contains`/`startswith`/`gt`/`gte`/`lt`/`lte`/`isnull`/`isnotnull`;無 `IN`、無 range)。
- `target: 'jsonb'` → [@rfjs/jsonb-query](../jsonb-query) 的完整集合(`terms`、`range`、`containsall`、不分大小寫版本、`haskey…`、`elemmatch` 等)。

跨引擎矩陣見 [@rfjs/filter-builder](../filter-builder#operator-矩陣)。

## 公開 API

- **`build`** — `buildPgFilter(config, input) → PgFilterResult`
- **`types`** — `PgFilterConfig`、`PgFilterInput`、`PgFilterResult`、`PgFilterGroup`、`PgLeaf`(`PgColumnLeaf` | `PgJsonbLeaf`)、`PgSort`
- **`filter`** / **`order-by`** / **`pagination`** — `build` 組合的building blocks
- **`errors`** — pg-filter 錯誤型別

## 相關套件

- **[@rfjs/sql-filter](../sql-filter)** — 欄位引擎。
- **[@rfjs/jsonb-query](../jsonb-query)** — JSONB 引擎。
- **[@rfjs/filter-builder](../filter-builder)** — 可編輯的標準樹,編譯到本套件(`treeToPgFilterGroup` + `pg-filter` 引擎)。
