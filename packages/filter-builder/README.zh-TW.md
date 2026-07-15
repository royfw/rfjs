# @rfjs/filter-builder

> English → [README.md](./README.md)

框架無關的**標準篩選樹(canonical filter-tree)**建構器:具備穩定節點 ID 的可編輯樹模型、不可變的 tree-ops、schema 推斷、反向解析(reverse-parse)、即時記憶體比對,以及一個把同一棵樹編譯到不同執行目標(PostgreSQL、JSONB、MongoDB、記憶體)的**引擎(engine)註冊表**。

這是**統合層(orchestration layer)**——它擁有共用的樹結構與 operator/arity 契約,也是唯一認得*所有*引擎的地方。本套件不含任何 UI。

---

## 定位(分層)

```
 執行引擎(各自獨立、可單獨發布)
 ┌───────────────┬──────────────┬─────────────┬──────────────┬─────────────┐
 │ @rfjs/        │ @rfjs/       │ @rfjs/      │ @rfjs/       │ @rfjs/      │
 │ data-filter   │ jsonb-query  │ sql-filter  │ mongo-query  │ pg-filter   │
 │ (記憶體)      │ (PG JSONB)   │ (純欄位)    │ (MongoDB)    │ (欄位+jsonb)│
 └───────┬───────┴──────┬───────┴──────┬──────┴──────┬───────┴──────┬──────┘
         └──────────────┴──────────────┼─────────────┴──────────────┘
                                       ▼
                          @rfjs/filter-builder          ← 你在這裡
              標準樹 · tree-ops · schema 推斷 · reverse
              · 即時比對 · 引擎註冊表(編譯到任一目標)
                                       ▼
                         @rfjs/filter-builder-ui
                本套件之上的 React 編輯器(<FilterTreeEditor>)
```

- **本套件** = 大腦:資料模型 + 邏輯 + 編譯。框架無關(純 TS、無 React)。以編譯後的 `dist/` 被消費(改 `src` 後需重建)。
- **[@rfjs/filter-builder-ui](../filter-builder-ui)** = 臉:React `<FilterTreeEditor>`,負責編輯樹,所有邏輯都轉回本套件處理。
- **引擎** = 各自獨立的執行器。`filter-builder` **相依全部**引擎(見下方安裝說明)。

---

## 安裝

**只需要單一引擎的功能、不要視覺化建構器** —— 直接裝該引擎並呼叫它即可,**不需要** `filter-builder`:

```bash
npm i @rfjs/data-filter      # 只做記憶體比對
# 或 @rfjs/jsonb-query / @rfjs/sql-filter / @rfjs/mongo-query / @rfjs/pg-filter
```

**要標準樹 + 編譯到任一引擎(無頭/headless)** —— 裝本套件,它會帶入**全部**引擎:

```bash
npm i @rfjs/filter-builder
```

**要現成的 React 編輯器** —— 裝 UI 層(它會一起帶入 `filter-builder`):

```bash
npm i @rfjs/filter-builder @rfjs/filter-builder-ui   # + peer:react、react-dom
```

> ⚠️ `@rfjs/filter-builder` **硬相依每一個引擎**
> (`pg-filter`、`jsonb-query`、`sql-filter`、`mongo-query`、`data-filter`、
> `data-transform`)。用它——或用 UI——就會把全部引擎帶進來,即使你只編譯到
> 一種目標。若只要單一引擎且不需視覺化建構器,請單獨安裝該引擎以求最小體積。

---

## 核心概念

### 標準樹(canonical tree)

可巢狀的群組,葉節點是欄位條件,並帶有可供編輯的**穩定 ID**:

```ts
type BuilderGroup = { kind: "group"; id: string; logic: "and"|"or"|"nor"|"not"; children: BuilderItem[] };
type BuilderCondition = { kind: "condition"; id: string; field: string; dataType: FieldType; elementType?: ElementType; operator: string; value?: unknown; filters?: BuilderGroup };
```

`treeToFilterGroup(tree)` 會去掉 ID,轉成引擎消費的共用 `FilterGroupLike` 結構。

### arity 模型 —— 值的「形狀」由 operator 決定

`arity.ts` 是「一個 operator 吃幾個值」的單一真相:

| arity  | 值形狀        | operators |
|--------|---------------|-----------|
| `none` | *(無值)*      | `isnull` `isnotnull` `isempty` `isnotempty` `elemmatch` |
| `one`  | 單一值        | `eq` `neq` `gt` `gte` `lt` `lte` `contains` `startswith` `endswith` `ieq` `haskey` … |
| `two`  | `[min, max]`  | `range` |
| `list` | 陣列          | `terms` `containsall` `nin` `hasanykey` `hasallkeys` |

`arityOf(op)` 回傳 arity(預設 `"one"`)。請用它來決定值輸入元件與驗證,**不要**對每個 operator 各自寫死值處理邏輯。

> 所以 `eq` 是**單一值**;要比對「多個值之中任一個」請用 `terms`
> (會編譯成 SQL `IN` / Mongo `$in`),而不是把陣列塞給 `eq`。

---

## 用法

```ts
import {
  emptyGroup, addCondition, updateNode,
  treeToFilterGroup, getEngine,
  inferSchema, runLiveMatch,
} from "@rfjs/filter-builder";

const id = () => crypto.randomUUID();

// 1. 建立 / 編輯標準樹(不可變操作,回傳新樹)
let tree = emptyGroup(id);
tree = addCondition(tree, tree.id, id);
const condId = tree.children[0]!.id;
tree = updateNode(tree, condId, { field: "age", dataType: "numeric", operator: "gt", value: 18 });

// 2a. 編譯到某個引擎
const out = getEngine("jsonb").compile(treeToFilterGroup(tree), {
  fields: [{ path: "age", kind: "jsonb", dataType: "numeric" }],
});
// → { ok: true, primary: '(("data" #>> $1)::numeric > $2)', secondary: '[["age"],18]' }

// 2b. …或在記憶體中直接評估
const { matched } = runLiveMatch([{ age: 36 }, { age: 12 }], tree); // → [{ age: 36 }]

// 從樣本資料推斷 schema
const schema = inferSchema([{ age: 36, name: "Ada" }]); // → FieldSchema[]
```

`getEngine(id)` 的引擎 id:`"data-filter"`、`"jsonb"`、`"sql-filter"`、`"mongo"`、`"pg-filter"`。每個回傳一個 `Engine`,含 `operators(dataType, elementType?, kind?)` 與 `compile(group, ctx)`。

---

## Operator 矩陣

各引擎提供哪些 operator,以及值的形狀(arity)。某個 operator 的**確切語意與編譯輸出**請看該引擎自己的 README(下方連結)——這張表是「跨引擎地圖」,不是各引擎行為的重述。

| Operator | Arity | data-filter | jsonb-query | sql-filter¹ | mongo-query | 意義 |
|----------|-------|:-----------:|:-----------:|:-----------:|:-----------:|------|
| `eq` | one | ✓ | ✓ | ✓ | ✓ | 等於(mongo:`$eq`) |
| `neq` | one | ✓ | ✓ | ✓ | ✓ | 不等於 |
| `gt` `gte` `lt` `lte` | one | ✓ | ✓ | ✓ | ✓ | 大小比較 |
| `range` | two `[min,max]` | ✓ | ✓ | ✓⁴ | ✓ | 介於(含邊界) |
| `contains` | one² | ✓ | ✓ | ✓ | ✓ | 子字串(sql:區分大小寫的 `LIKE`;mongo:`$regex`) |
| `startswith` | one | ✓ | ✓ | ✓ | ✓ | 開頭為 |
| `endswith` | one | ✓ | ✓ | ✓⁴ | ✓ | 結尾為 |
| `icontains` `istartswith` `iendswith` `ieq` `ineq` | one | – | ✓ | ✓⁴ | – | 不分大小寫版本 |
| `terms` | list | ✓ | ✓ | ✓⁴ | ✓ | 屬於集合(sql:`= ANY`;mongo:`$in`) |
| `nin` | list | – | – | – | ✓ | 不屬於集合(`$nin`) |
| `containsall` | list | ✓ | ✓ | – | – | 陣列包含全部值 |
| `isnull` `isnotnull` | none | ✓ | ✓ | ✓ | ✓ | null 檢查(mongo:`$eq`/`$ne null`) |
| `isempty` `isnotempty` | none | – | ✓ | – | – | 陣列為空 / 非空 |
| `haskey` | one | – | ✓ | – | – | 物件含某鍵 |
| `hasanykey` `hasallkeys` | list | – | ✓ | – | – | 物件含任一 / 全部鍵 |
| `elemmatch` | none³ | ✓ | ✓ | – | – | 比對「物件陣列」中的元素 |

¹ **`sql-filter`** 是純欄位層。`pg-filter` 把它與 `jsonb-query` 組合:`target: 'column'` 的葉節點走上表的 **sql-filter** 欄位集合;`target: 'jsonb'` 的葉節點走 **jsonb-query** 集合。

² `contains` 一般是單值,但 **data-filter** 在 `string` / 字串陣列欄位上把它視為 `list` arity(contains-**any**,任一命中)。

³ `elemmatch` 帶的是巢狀 `BuilderGroup`(在 `condition.filters`),而非純量值。

⁴ **sql-filter** 的欄位層對 `range`/`terms`/`iX` 家族依欄位 `type` 有不同的允許範圍 —— 例如 `range` 只有 numeric/timestamp(`text` 沒有),`terms` 在 `boolean` 上不可用;詳見 [@rfjs/sql-filter](../sql-filter#column-operator-與型別) 的每型別對照表。

arity 來自共用的 `arity.ts`(單一真相);各引擎的 ✓ 標記是依各引擎 `operators()` 維護。`@rfjs/filter-builder-ui` 裡有一個 drift-guard 測試(`operators.spec.ts`)確保任何引擎回傳的 operator 都存在於 `OPERATOR_KEYS`,所以**新增**的 operator 不會被漏掉——但表中的 ✓/– 格是人工核對,若有疑問請以各引擎自己的 README 為準。

---

## 公開 API(依模組)

- **`types`** — `BuilderGroup`、`BuilderCondition`、`FieldSchema`、`LogicOp`、`FieldType`、`ElementType`、`FieldKind`
- **`tree-ops`** — `emptyGroup`、`addCondition`、`addGroup`、`removeNode`、`updateNode`、`setLogic`
- **`schema-infer`** — `inferSchema`
- **`field-create`** / **`field-kind`** — `addInferredField`、`mapColumnType`、…
- **`reverse`** — `parseFilterGroup`、`filterGroupToTree`、`mergeFieldsFromTree`
- **`compile`** — `treeToFilterGroup`、`FilterGroupLike`
- **`pg-group`** — `treeToPgFilterGroup`
- **`live-match`** — `runLiveMatch`
- **`value-coerce`** — 值轉換輔助
- **`engines`** — `getEngine`、`ENGINE_IDS`、`Engine`、`OperatorSpec`、`OperatorArity`、`CompileContext`

## 相關套件

- **[@rfjs/filter-builder-ui](../filter-builder-ui)** — 本套件之上的 React `<FilterTreeEditor>`。
- 引擎(各 operator 的語意與編譯輸出):
  [@rfjs/data-filter](../data-filter) ·
  [@rfjs/jsonb-query](../jsonb-query) ·
  [@rfjs/sql-filter](../sql-filter) ·
  [@rfjs/mongo-query](../mongo-query) ·
  [@rfjs/pg-filter](../pg-filter)
