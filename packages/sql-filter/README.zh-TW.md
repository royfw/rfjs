# @rfjs/sql-filter

> English → [README.md](./README.md)

通用的**布林 filter-group → 參數化 SQL** 產生器,搭配**可插拔的 leaf 渲染器**。它負責樹與邏輯(`and`/`or`/`nor`/`not`,任意巢狀),把每個 leaf 交給你提供的渲染器 —— 也就是它懂「**怎麼組合**條件」,不懂「條件是什麼意思」。內建一個 **column** 渲染器,對宣告過的欄位白名單產生 PostgreSQL `WHERE` / `ORDER BY`。零執行期相依。

這是底層核心;[@rfjs/pg-filter](../pg-filter) 的欄位端就是建構在它之上。

---

## 安裝

```bash
npm i @rfjs/sql-filter
```

## 兩層

```
 FilterGroup<L>  ──buildFilterGroup(group, renderLeaf, params)──▶  "a=$1 and (b=$2 or c=$3)"
   (樹 + 邏輯)         每個 leaf L 都交給「你的」renderLeaf
        │
        └─ 內建 column 層:buildColumnQuery(config, group) ──▶ { where, values }
                 leaf 是 { column, operator, value },依欄位白名單 + 型別表安全渲染
```

### 1. 通用核心 —— 自帶 leaf 渲染器

```ts
import { buildFilterGroup, ParamBuilder, type FilterGroup } from "@rfjs/sql-filter";

type Leaf = { col: string; val: unknown };
const group: FilterGroup<Leaf> = {
  logic: "and",
  filters: [{ col: "a", val: 1 }, { logic: "or", filters: [{ col: "b", val: 2 }, { col: "c", val: 3 }] }],
};

const params = new ParamBuilder();
const where = buildFilterGroup(group, (leaf, p) => `${leaf.col} = ${p.add(leaf.val)}`, params);
// where  → "a = $1 and (b = $2 or c = $3)"
// params.values → [1, 2, 3]
```

`ParamBuilder.add(value)` 回傳下一個 `$N` 佔位並累積該值 —— 所以輸出永遠是參數化的(不會把值字串拼接進 SQL)。

### 2. 內建 column 層

```ts
import { buildColumnQuery, type ColumnConfig } from "@rfjs/sql-filter";

const config: ColumnConfig = {
  name: { column: "name", type: "text" },
  createdAt: { column: "created_at", type: "timestamp" },
};

const { where, values } = buildColumnQuery(config, {
  logic: "and",
  filters: [
    { column: "name", operator: "contains", value: "sales" },
    { column: "createdAt", operator: "gte", value: "2026-01-01" },
  ],
});
// where  → "\"name\" like '%' || $1 || '%' escape '\\' and \"created_at\" >= $2"
// values → ["sales", "2026-01-01"]
```

`buildColumnOrderBy(config, sorts)` 用同樣方式產生參數化的 `ORDER BY`。

## Column operator 與型別

column 層是**純量**介面,但不僅限於單值相等:除了 `eq`/`neq`/比較運算子之外,對支援的型別它也會產生 IN-list 的 `= ANY`(`terms`)與 range 的 `BETWEEN`(`range`)。operator 會依欄位宣告的 `type` 驗證:

| `ColumnType` | 允許的 `ColumnOperator` |
|--------------|-------------------------|
| `text` | `eq` `neq` `isnull` `isnotnull` `contains` `startswith` `endswith` `icontains` `istartswith` `iendswith` `ieq` `ineq` `terms` `gt` `gte` `lt` `lte` |
| `numeric` / `timestamp` | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `terms` `range` |
| `uuid` | `eq` `neq` `isnull` `isnotnull` `terms` |
| `boolean` | `eq` `neq` `isnull` `isnotnull` |

`contains`/`startswith`/`endswith` 是**區分大小寫**的子字串/前綴/後綴比對(`LIKE`,並會跳脫 `%`/`_`/`\`,讓詞彙逐字比對而非當成萬用字元)。要不分大小寫請用 `iX` 家族:`icontains`/`istartswith`/`iendswith`(`ILIKE`,同樣的跳脫)與 `ieq`/`ineq`(`lower(欄位) = / <> lower($n)`)。`terms` 接受非空陣列,產生 `= ANY($n)`——整個陣列會綁定成**單一**參數,不是每個元素一個參數。`range` 接受 `[lo, hi]` 兩個值,產生 `BETWEEN $n AND $n+1`。

值都是單一值,除了 `terms`(陣列)與 `range`(兩個值);`isnull`/`isnotnull` 不帶值。未知欄位或型別不允許的 operator 會丟 `ColumnQueryError`(`UNKNOWN_COLUMN` / `UNSUPPORTED_OPERATOR`)。

> 跨引擎的 operator 全貌(哪個引擎有 `terms`/`range` 等)請見 [@rfjs/filter-builder](../filter-builder#operator-矩陣) 的矩陣。

## 公開 API

- **`engine`** — `buildFilterGroup(group, renderLeaf, params)`
- **`param-builder`** — `ParamBuilder`(`add(value) → "$N"`、`.values`)
- **`column`** — `buildColumnQuery`、`buildColumnOrderBy`、`ColumnConfig`、`ColumnCondition`、`ColumnOperator`、`ColumnType`、`ColumnSortSpec`
- **`types`** — `FilterGroup<L>`、`LogicalOperator`
- **`errors`** — `ColumnQueryError`(`code`:`UNKNOWN_COLUMN` | `UNSUPPORTED_OPERATOR` | `INVALID_PARAM_OFFSET`)

## 相關套件

- **[@rfjs/pg-filter](../pg-filter)** — 把本套件(欄位)與 `jsonb-query`(JSONB)組成同一棵樹。
- **[@rfjs/filter-builder](../filter-builder)** — 標準樹 + 跨引擎 operator 矩陣。

設計筆記:`docs/superpowers/specs/2026-06-15-sql-filter-design.md`。
