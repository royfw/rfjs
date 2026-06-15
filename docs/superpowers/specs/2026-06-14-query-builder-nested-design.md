# Metadata 驅動的巢狀查詢建構器 — 設計文件

**日期:** 2026-06-14
**狀態:** 設計已核可;待撰寫實作計畫
**範圍:** 垂直切片 — `apps/web` 內一個引擎感知的視覺化查詢建構器工具

---

## 背景與整體願景

起點是一張參考 UI（`.tmp/create_model.png`,一個「創建模型」關鍵詞規則建構器）:
三個彩色桶 — 必須成立（AND）、不可成立（NOT）、擇一成立（OR） — 由一個可組合的
條件建構器餵入,並有即時匹配預覽。

這張圖帶出的更大想法:與其替每個查詢引擎
（`@rfjs/jsonb-query`、`@rfjs/data-filter`、`@rfjs/mongo-query`）各做一個視覺化
建構器,不如把整條流程繞著 **metadata** 統一起來:

```
建立資料集 → 對欄位定義型別 → 產出 schema metadata
                                      │
                  ┌───────────────────┼───────────────────┐
                  ▼                   ▼                    ▼
          有哪些欄位可選      每個欄位能用哪些條件      值怎麼輸入
                  └───────────────────┼───────────────────┘
                                      ▼
                      巢狀的視覺化 builder（比圖更彈性）
                                      ▼
              同一棵 builder 樹 → 編譯成 jsonb SQL / mongo / data-filter
```

這三個引擎本來就共用幾乎相同的 filter 形狀 — `data-filter` 的 `FilterMatchQuery`
與 `jsonb-query` 的 `JsonbFilterGroup` 都是 `{ logic, filters[] }`,`logic` 為
`and|or|nor|not`,而 condition 都是 `{ field, dataType, operator, value }`,以
`dataType` 區分(陣列另有 `elementType` 與 `elemmatch` 巢狀)。**結構完全相同**;
只有 **operator 集合不同**(jsonb 多半是超集:大小寫不敏感系列、
`haskey`/`hasanykey`/`hasallkeys`、`isempty`/`isnotempty`、字串的 `range`/`gt`/`lt`)。

### 完整拆解(每塊各自走一輪 spec → plan → 實作)

| | 子專案 | 內容 | 狀態 |
|---|---|---|---|
| **A** | Canonical filter model + 多引擎編譯器 | 一份 `FilterModel`,轉接到 jsonb/mongo/data-filter | 延後(本切片埋種子) |
| **B** | 資料集欄位 schema（型別 metadata） | 從 dataset rows 推斷 + 可編輯 + 持久化 | 延後 |
| **C** | Builder 能力設定 | type→operator 矩陣、欄位可見性/標籤(可設定) | 延後(本切片用靜態矩陣) |
| **D** | 巢狀視覺化 builder UI | 遞迴 group/condition 樹 + 即時預覽 | **本切片** |

**本文件只涵蓋垂直切片:** `apps/web` 內單一引擎感知的巢狀查詢建構器工具,
單頁、零後端。它為 A(canonical tree + engine registry)與 C(靜態 per-engine
矩陣)埋下剛好夠用的種子,端到端證明「metadata → UI → 巢狀 → SQL」這條路,並讓
真實 UI 反過來告訴我們 canonical model(A)該長成什麼樣。

---

## 已鎖定的決定

1. **位置:** `apps/web` 內一個 self-contained 的 demo 工具。貼範例 JSON → 推斷
   schema → 建構 → 即時預覽。無後端。
2. **預覽:** SQL **加上**真實 row 比對。同一棵 canonical tree 同時餵
   `buildJsonbQuery()`(SQL `WHERE` + 參數)與 `matchQuery()`(在瀏覽器內對貼進來
   的資料做 row 比對)。
3. **operator 缺口:** 每個引擎各自的 operator 選單。引擎選擇器決定選單列出哪些
   operator。(子專案 A 那個 `engine → 矩陣 + 編譯器` registry 的種子。)
4. **頂層結構:** 純遞迴樹 + 友善的 logic 標籤(不是固定三桶版面)。
5. **工具定位:** 一個**新**工具(`query-builder`),保留既有的
   `jsonb-query-generator`(raw-JSON textarea)給 power user。兩者互補。
6. **Schema UX:** 從貼進來的資料推斷型別,再讓使用者編輯(改某欄位的
   type/elementType、勾選要納入哪些欄位)。

---

## 架構

一棵 **canonical tree** + 一個 **engine registry**。樹是結構(共用);每個引擎各
自帶自己的 operator 矩陣與編譯器。

```
canonical tree (logic + children)
        │
        ├─ engine: jsonb        → operator 矩陣 + buildJsonbQuery() → SQL WHERE + values
        ├─ engine: data-filter  → operator 矩陣 +（query JSON 本身即輸出）+ matchQuery() 即時 rows
        └─ engine: mongo        →（延後;registry 留擴充點）
```

### Canonical tree 型別（`lib/tools/query-builder/types.ts`）

結構與兩個引擎的 `FilterGroup` 一致,額外加一個 client 端 `id` 供 React key / 編輯
使用。編譯前會把 `id` 剝除。

```ts
type LogicOp = 'and' | 'or' | 'nor' | 'not';
type ScalarType = 'string' | 'numeric' | 'date' | 'boolean';

interface BuilderGroup {
  kind: 'group';
  id: string;
  logic: LogicOp;
  children: BuilderItem[];
}

interface BuilderCondition {
  kind: 'condition';
  id: string;
  field: string;
  dataType: ScalarType | 'object' | 'array';
  elementType?: ScalarType | 'object'; // 當 dataType === 'array'
  operator: string;                    // 對所選引擎的矩陣驗證
  value?: unknown;
  filters?: BuilderGroup;              // 當 operator === 'elemmatch'
}

type BuilderItem = BuilderGroup | BuilderCondition;
```

### Engine registry（`lib/tools/query-builder/engines/`）

```ts
interface OperatorSpec {
  op: string;
  label: string;        // i18n key
  arity: 'none' | 'one' | 'two' | 'list'; // 驅動值編輯器
}

interface Engine {
  id: 'jsonb' | 'data-filter';
  label: string;
  // type → 合法 operator（C 層矩陣,目前為靜態）
  operators(dataType: string, elementType?: string): OperatorSpec[];
  // canonical tree → 引擎輸出（給預覽面板）
  compile(tree: BuilderGroup, opts?: unknown): EngineOutput;
}

type EngineOutput =
  | { ok: true; primary: string; secondary?: string }   // jsonb: where + values; data-filter: query JSON
  | { ok: false; error: string };
```

- **`engines/jsonb.ts`** — 矩陣來自 `Jsonb{Scalar,Object,Array}Operator`;
  `compile` → `buildJsonbQuery(column, tree, { dialect })` → `{ primary: where, secondary: JSON.stringify(values) }`。
- **`engines/data-filter.ts`** — 矩陣來自 data-filter 的 operator unions;
  `compile` → query JSON 本身即輸出(`{ primary: JSON.stringify(tree) }`)。
- **`engines/index.ts`** — 以 id 為 key 的 registry;mongo 以註解形式留為擴充點。

### 即時比對（`lib/tools/query-builder/live-match.ts`）

永遠開啟,與所選引擎無關。對解析後的範例 rows 跑 `@rfjs/data-filter` 的
`matchQuery(row, tree)`。

- 當樹中所有用到的 operator 都在 data-filter 矩陣內 → 完整結果(命中 rows + 筆數)。
- 當引擎為 `jsonb` 且某條用了 data-filter 沒有的 operator(`icontains`、`haskey`…)
  → 該條標記「無法在瀏覽器預覽」;SQL 輸出仍完整。(誠實降級;重用既有
  `data-filter-tester` 的 `matchQuery` 模式。)

### Schema 推斷（`lib/tools/query-builder/schema-infer.ts`）

解析貼進來的 JSON(必須是物件陣列)。對每個發現的欄位 path,從值推斷 `dataType`
(陣列再加 `elementType`):

- 純量 → `string` / `numeric` / `date`(ISO 樣式字串啟發式)/ `boolean`
- 物件值 → `object`
- 陣列 → `array` + 由元素推斷的 `elementType`(物件 → 可 `elemmatch`)
- 混型 / 全為 null → 預設 `string`,並標記為可編輯

輸出:`FieldSchema[]` = `{ path, dataType, elementType?, include: boolean }`。使用者
可編輯 type/elementType,並切換 `include`。

---

## UI（三欄,呼應參考圖）

| 左:資料 & Schema | 中:Builder | 右:預覽 |
|---|---|---|
| 貼範例 JSON 陣列 → 推斷後**可編輯**的欄位清單（path · dataType · elementType · include 勾選） | 頂部**引擎選擇器**;遞迴 group 樹 | 主引擎輸出（SQL where+values / data-filter JSON）+ **即時命中**（筆數 + 命中 rows）+ 複製鈕 |

- **GroupNode:** logic 選擇器 `and/or/nor/not`,用友善雙語標籤
  (`and=全部成立/All`、`or=擇一成立/Any`、`nor=皆不成立/None`、`not=非全部/Not all`);
  `+ 條件`、`+ 群組`、刪除。巢狀無上限。
- **ConditionRow:** 欄位下拉(來自已納入的 schema 欄位)→ operator 下拉(來自所選
  引擎對該欄位型別的矩陣)→ 型別感知的值編輯器(由 `OperatorSpec.arity` 驅動)。當
  `dataType: array`、`elementType: object`、`operator: elemmatch` → 展開一個巢狀
  子 builder 做 per-element 條件。
- **PreviewPanel:** 主輸出 + 即時命中 rows;必要處顯示 per-condition「無法預覽」提示;
  複製鈕(重用 `CopyButton`、`Panel`、`ToolShell`)。

參考圖的三桶其實就是一棵遞迴樹、頂層 group 的 `logic` 各設一種 — 所以彈性樹涵蓋
了這個隱喻,而不必把它寫死。

---

## 狀態與資料流

單一 React state:`{ sampleData: string, schema: FieldSchema[], engineId, tree: BuilderGroup }`。
所有編譯皆為純函式。編輯樹 / schema / 引擎會同步重新推導預覽與即時命中(與既有工具
同模式)。切換引擎時,逐條對新矩陣重新驗證 operator;新引擎沒有的 operator 退回該
引擎對該欄位型別的預設值(並標記該條讓使用者注意到)。

---

## 檔案結構

```
apps/web/src/lib/tools/query-builder/
  types.ts             # canonical BuilderGroup / BuilderCondition / FieldSchema
  schema-infer.ts      # 從範例 rows 推斷欄位型別
  live-match.ts        # 對範例 rows 跑 matchQuery + 覆蓋率檢查
  engines/
    jsonb.ts           # 矩陣 + compile (buildJsonbQuery)
    data-filter.ts     # 矩陣 + compile (query JSON)
    index.ts           # registry（mongo 擴充點以註解標示）
apps/web/src/components/tools/query-builder/
  index.tsx            # QueryBuilder（組合 ToolShell）
  schema-panel.tsx
  builder-tree.tsx     # GroupNode（遞迴）+ ConditionRow
  value-editor.tsx
  preview-panel.tsx
apps/web/src/components/tools/registry.tsx   # 註冊 "query-builder"
packages/web-core/...                        # 工具 metadata 項目（id, slug, title）
apps/web/src/messages/*                       # i18n 字串（ToolUI namespace）
```

---

## 錯誤處理與邊界情況

- 無效的範例 JSON → schema 面板顯示錯誤,builder 仍可用(空白手動 schema)。
- 範例 JSON 非物件陣列 → 錯誤(比照 `data-filter-tester` 的 `notArray`)。
- 空樹 / 空群組 → identity(全部命中);預覽顯示該 trivial 結果。
- 條件尚未填欄位/operator → 在完成前排除於編譯之外(不崩潰)。
- `buildJsonbQuery` 丟例外 → 預覽顯示 `queryFailed` 訊息;即時命中不受影響。
- 切換引擎後留下不合法 operator → 重設為引擎預設 + 標記該條。

---

## 測試（co-located `*.spec.ts`,依 CLAUDE.md）

- **schema-infer:** 純量、ISO 日期字串、純量陣列、物件陣列、巢狀物件、混型與
  全 null 欄位。
- **engine 矩陣:** 兩個引擎對每個 `dataType`/`elementType` 的合法 operator 集合;
  斷言 jsonb 超集 vs data-filter 子集的差異。
- **compile 轉接:** canonical tree → `buildJsonbQuery` 輸出(where + values);
  canonical tree → data-filter query JSON;round-trip 穩定性。
- **live-match:** 對範例 rows 的 `matchQuery` 結果;有 jsonb-only operator 時覆蓋率
  旗標被設起。
- **元件:** 輕量 render/互動測試(加群組、加條件、切換引擎重推選單、elemmatch 展開)。

---

## 不在範圍內（各自為未來的 spec → plan）

- 子專案 A:把 canonical model + 編譯器抽成共用 lib;mongo 引擎。
- 子專案 B:資料集欄位 schema 持久化;workbench 真實資料集整合。
- 子專案 C:可由使用者設定的能力層(自訂標籤、欄位可見性規則)。
- 透過 `POST /datasets/query` 對真實資料集執行查詢。
