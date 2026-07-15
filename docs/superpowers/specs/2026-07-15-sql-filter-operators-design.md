# 設計：@rfjs/sql-filter 運算子對齊（① ILIKE bug + ② column 覆蓋）

- 日期：2026-07-15
- 分支：`feat-sql-filter-operators`（新 worktree，base `ec0c8b2`）
- 相關參考：`docs/filter-operator-matrix.md`（跨 engine 運算子矩陣，branch `docs-filter-operator-matrix`）

## 背景與目標

`@rfjs/sql-filter` 的 **column 層**（`src/column/operators.ts`）目前只支援
`eq/neq/isnull/isnotnull/contains/startswith/gt/gte/lt/lte`，而同屬「同名直通群」的
`jsonb-query` / `data-filter` 支援更廣（`terms`/`range`/`endswith`/`iX` ci 家族…）。因為
`pg-filter` 一棵樹會混用 `target:'column'`（→ sql-filter）與 `target:'jsonb'`（→ jsonb-query）
兩種 leaf，使用者會遇到「同一個運算子在 jsonb 欄位可用、在 column 欄位卻丟
`UNSUPPORTED_OPERATOR`」的落差。同時 column 層的 `contains`/`startswith` 有一個 ILIKE
萬用字元 bug。

**目標（本輪範圍 = ①+②）**：
- **① 修正 ILIKE bug**（正確性）。
- **② 補齊 column 層運算子覆蓋**，讓 column 路徑對齊 jsonb/data-filter 的每型別運算子集合。

**非目標**：不做「大改名對齊」（同名直通群拼字已一致）；不動 `es-query`/`mongo-query`
（由 adapter map 隔離）；**不含** 把 canonical `operator: string` 收斂成 union 型別的加購
（列為後續可選）；不改 `es-query` 的 `*`/`?` escape（另案）。

## ① ILIKE bug 修正

現況（`src/column/operators.ts:58-63`）：
```ts
if (operator === 'contains')   return `${col} ilike '%' || ${params.add(value)} || '%'`;
if (operator === 'startswith') return `${col} ilike ${params.add(value)} || '%'`;
```
兩個問題：
1. **未 escape**：term 內的 `%`/`_` 被當萬用字元，且無 `ESCAPE` 子句 → 搜 `50%`/`a_b` 會誤配。
2. **大小寫語意不一致**：無條件用 `ilike`（不敏感），但 jsonb-query / data-filter 的
   `contains`/`startswith` 是**大小寫敏感**（jsonb 把 ci 保留給 `iX` 家族）。

### 決策 D1（需你確認）：大小寫語意
**採「大小寫敏感」對齊 jsonb/data-filter** —— `contains`/`startswith`/`endswith` 改用
`LIKE`（敏感）；大小寫**不**敏感交給 ② 新增的 `icontains`/`istartswith`/`iendswith`（用
`ILIKE`）。這是**行為變更**：既有 column `contains`/`startswith` 從 ci 變 cs（此 repo 無外部
consumer 依賴舊 ci 行為，安全；但既有 sql-filter 測試斷言 `ilike`，需一併更新）。

### escape 作法
新增純函式 `escapeLike(v: string): string`，將 `\` `%` `_` 前置 `\`；render 時 term 走
`escapeLike(String(value))` 綁參數，並在 SQL 尾加 `ESCAPE '\'`：
```ts
// contains  → `${col} like '%' || $1 || '%' escape '\'`   ($1 = escapeLike(String(value)))
// startswith→ `${col} like $1 || '%' escape '\'`
// endswith  → `${col} like '%' || $1 escape '\'`
```

## ② column 覆蓋補齊

### 決策 D2（需你確認）：每型別運算子集合（對齊 data-filter / jsonb 的 dataType 集合）
新增運算子加入 `ColumnOperator` union 與 `ALLOWED` 每型別集合：

| ColumnType | 現有 | **新增** |
|---|---|---|
| `text` | eq, neq, isnull, isnotnull, contains, startswith, gt, gte, lt, lte | **endswith, terms, ieq, ineq, icontains, istartswith, iendswith** |
| `numeric` | eq, neq, isnull, isnotnull, gt, gte, lt, lte | **terms, range** |
| `timestamp` | 同 numeric | **terms, range** |
| `boolean` | eq, neq, isnull, isnotnull | （不加；terms 對 bool 無意義） |
| `uuid` | eq, neq, isnull, isnotnull | **terms** |

（text 不加 `range` —— 字串 BETWEEN 是字典序、幾乎不會要，且 jsonb 實務也少用；如需再議。）

### 決策 D3：SQL render（`ParamBuilder.add` 已支援陣列參數 → `= ANY`）
| op | arity（`filter-builder/arity.ts` 已定義） | SQL |
|---|---|---|
| `terms` | list | `${col} = any(${add(value)})`（value 為陣列；pg 驅動綁 JS 陣列為 PG 陣列） |
| `range` | two | `${col} between ${add(v[0])} and ${add(v[1])}`（value 為 `[lo,hi]`，驗證 2 元素） |
| `endswith` | one | `${col} like '%' || ${add(esc)} escape '\'` |
| `ieq` | one | `lower(${col}) = lower(${add(value)})`（ci 精確，免 escape） |
| `ineq` | one | `lower(${col}) <> lower(${add(value)})` |
| `icontains` | one | `${col} ilike '%' || ${add(esc)} || '%' escape '\'` |
| `istartswith` | one | `${col} ilike ${add(esc)} || '%' escape '\'` |
| `iendswith` | one | `${col} ilike '%' || ${add(esc)} escape '\'` |

value 驗證：`terms` 需非空陣列、`range` 需 2 元素陣列，否則丟 `INVALID_VALUE`（比照現有
nullary/undefined 檢查風格）。

### filter-builder adapter（`src/engines/sql-filter.ts`）同步
`columnOps(dataType)` 的清單要加上對應新運算子，UI 才會提供：
- `TEXT_OPS`（dataType `string`，含 uuid→text）：+ `endswith, terms, ieq, ineq, icontains, istartswith, iendswith`
- `NUMERIC_OPS`（`numeric`/`date`）：+ `terms, range`
- `BOOL_OPS`：不變

（arity 已於 `arity.ts` 定義 `terms`=list、`range`=two；iX 家族預設 `one`，正確。）

## 檔案清單

- `packages/sql-filter/src/column/operators.ts` — `ColumnOperator` union、`ALLOWED`、`NULLARY`
  不變、加 `escapeLike` + 新 render 分支 + `ilike`→`like`（cs）+ ESCAPE。
- `packages/sql-filter/src/column/*.spec.ts` — 更新既有 `ilike` 斷言為 `like ... escape`；新增
  escape / terms / range / endswith / iX 的測試。
- `packages/filter-builder/src/engines/sql-filter.ts` — 擴充 `TEXT_OPS`/`NUMERIC_OPS`。
- `packages/filter-builder/src/engines/*.spec.ts`（若有斷言 sql-filter 運算子清單）— 同步。
- `packages/pg-filter` — 無需改碼（`PgColumnLeaf.operator: ColumnOperator` 自動涵蓋新 op）；
  跑既有測試確認綠，視情況補 column 新運算子的 e2e/單元覆蓋。

## 測試與相容性

- **會變紅需更新**：既有 sql-filter column 測試中斷言 `ilike '%' || ... || '%'` 的案例（D1 改
  `like ... escape '\'` + cs）。這是預期的行為變更、不是回歸。
- 新增測試涵蓋：escape（`50%`/`a_b`/`\`）、cs vs ci（`contains` 敏感、`icontains` 不敏感）、
  `terms`（`= any`）、`range`（`between` + 非 2 元素報錯）、`endswith`、每型別 `ALLOWED` 拒絕
  （如 boolean 不接受 `terms`）。
- `pg-filter` 既有測試維持綠。

## Changeset（每個變更的 workspace 套件都要）

- `@rfjs/sql-filter` — **minor**（新增 column 運算子 + 修 contains/startswith 語意）。
- `@rfjs/filter-builder` — **minor**（sql-filter engine 對外提供的運算子集合擴充）。
- `@rfjs/pg-filter` — **patch**（透過 sql-filter 傳遞性支援新 column 運算子；無自身改碼但行為擴充）。

## 驗收

- `pnpm -F @rfjs/sql-filter vitest:run`（含 e2e 若有）、`pnpm -F @rfjs/filter-builder vitest:run`、
  `pnpm -F @rfjs/pg-filter vitest:run`（含 e2e）全綠；`pnpm -F <pkg> check-types` 綠。
- 手動驗證一個含 `%`/`_` 的 `contains` 不再誤配；`terms`/`range`/`endswith`/`iX` 產出正確 SQL。
- 不 push、不動 primary checkout；HOLD PR 直到使用者說「PR」。

## 已定案的決策（2026-07-15 使用者確認）
- **D1 ✅**：`contains`/`startswith`/`endswith` 改**大小寫敏感**（`LIKE`），ci 交給新增的 `iX`（`ILIKE`）。
- **D2 ✅**：每型別新增運算子照上表 —— text **不加** `range`；uuid 只加 `terms`；boolean 不加。
- **型別收斂加購**（`operator: string`→union）：**這次不做**，列為獨立後續。
