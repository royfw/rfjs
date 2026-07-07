# 設計：query-builder 加入 pg-filter 引擎 + 欄位種類模型 + 三欄彩色 UI

日期：2026-06-16
狀態：設計中(待 review)

## 背景與目標

`apps/web` 的 query-builder 工具目前是兩欄 ToolShell:左邊輸入(sample JSON → 推斷 schema + 巢狀樹建構),右邊輸出(引擎產出 + live-match)。引擎是個乾淨的 registry,目前有 `jsonb`(→ jsonb SQL)與 `data-filter`(→ 記憶體比對)。**現況:所有欄位一律視為 JSON 路徑,沒有「真欄位 vs jsonb」的概念。**

剛 ship 的 **`@rfjs/pg-filter`**(PR #168)能把「真欄位過濾」與「jsonb 過濾」組成一棵混合樹。要在 query-builder 裡展示它「轉出來的 SQL 長怎樣」,就必須讓使用者把欄位標成 column 或 jsonb —— 否則 pg-filter 跟現有 jsonb 引擎產出無異、毫無價值。

本案範圍(子專案 B 的兩塊):
- **B1 — 欄位種類模型 + pg-filter 引擎**:讓欄位可標 column/jsonb,新增「Unified PG SQL」引擎。
- **B3 — 三欄彩色 UI 重做**:把這個工具從兩欄 ToolShell 改成全寬三欄、巢狀樹上色。

排除(各自獨立、之後另開 spec):**B2 反向讀取**(貼任一框反推其他框)、**B4 抽 canonical model / headless hook 成 public npm**。

---

## Part 1（B1）— 欄位種類模型 + pg-filter 引擎

### 1.1 模型變更（`logic/types.ts`）

`FieldSchema` 增加 `kind`,並讓 column 欄位帶一個 SQL 型別:

```ts
export type FieldKind = 'column' | 'jsonb';

export interface FieldSchema {
  path: string;
  dataType: FieldType;        // string|numeric|date|boolean|object|array(不變)
  elementType?: ElementType;
  include: boolean;
  kind: FieldKind;            // 新增
}
```

- **canonical 樹(`BuilderCondition`)不動** —— 條件只描述 field/dataType/operator/value,維持與引擎無關。某個 field 是 column 還是 jsonb,由 schema 查得(引擎在 compile 時查)。這保持樹的純粹。
- **column 只允許 scalar**:`kind:'column'` 僅當 `dataType ∈ {string,numeric,date,boolean}`。object/array 一律 jsonb(UI 禁止把它們設成 column)。
- **dataType → sql-filter `ColumnType` 映射**:`string→text`、`numeric→numeric`、`date→timestamp`、`boolean→boolean`。(`uuid` 無法從 sample 推斷,本案不支援 column uuid。)

> **決策 D1 — 推斷出的欄位預設 kind?**
> 建議:預設全部 `jsonb`,使用者再把要當真欄位的勾成 column(顯式、無意外)。另在左欄提供一鍵「把頂層 scalar 全設為 column」加速常見情境(datasets 形狀:頂層欄位 + data blob)。

### 1.2 引擎介面演進（`logic/engines/types.ts`）

兩處加入「欄位種類」資訊,jsonb / data-filter 引擎忽略即可:

```ts
export type EngineId = 'jsonb' | 'data-filter' | 'pg-filter';   // 加 pg-filter

export interface CompileContext {
  fields: Array<{ path: string; kind: FieldKind; dataType: FieldType; elementType?: ElementType }>;
}

export interface Engine {
  id: EngineId;
  label: string;
  operators(dataType: string, elementType?: string, kind?: FieldKind): OperatorSpec[]; // 加 kind
  compile(group: FilterGroupLike, ctx: CompileContext): EngineOutput;                  // 加 ctx
}
```

- `compile` 多收 `ctx`(欄位種類表)。`jsonb`/`data-filter` 簽名照收但不使用。
- `operators` 多收 `kind`:pg-filter 在 column 欄位回傳 sql-filter 欄位運算子、在 jsonb 欄位回傳 jsonb-query 運算子。builder-tree 渲染運算子下拉時,本來就握有 field → 可查 kind 傳入。

### 1.3 pg-filter 引擎（新檔 `logic/engines/pg-filter.ts`）

```ts
// 概念
compile(group, ctx) {
  const columns = ctx.fields.filter(f => f.kind === 'column')
    .reduce((acc, f) => ({ ...acc, [f.path]: { column: f.path, type: mapType(f.dataType) } }), {});
  const config: PgFilterConfig = { columns, jsonb: { column: 'data', dialect: 'legacy' } };
  const tree = toPgFilterGroup(group, ctx);   // 依 kind 給每葉打 target
  const { where, values } = buildPgFilter(config, { filter: tree });
  return { ok: true, primary: where, secondary: JSON.stringify(values, null, 2) };
}
```

- `toPgFilterGroup`:走訪 `FilterGroupLike`,每個葉子查 `ctx` 的 kind →
  - column → `{ target:'column', column: field, operator, value }`
  - jsonb → `{ target:'jsonb', field, dataType, operator, value, elementType?, filters? }`
- `operators(dataType, elementType, kind)`:`kind==='column'` → sql-filter 欄位運算子矩陣(eq/neq/isnull/isnotnull 全型別;contains/startswith 限 text;gt/gte/lt/lte 限 numeric/timestamp/text);否則 → 沿用 jsonb 引擎的矩陣。
- 錯誤(`ColumnQueryError`/`PgFilterError`/`JsonbQueryError`)→ `{ ok:false, error: err.message }`(沿用現有 try/catch 樣式)。

> **決策 D2 — pg-filter 預覽用哪個 jsonb dialect?**
> 建議:`legacy`,與同工具裡現有 jsonb 引擎一致(畫面風格統一)。備選:`jsonpath`(與 datasets 後端實際用的一致)。

> **決策 D3 — 是否在 builder 裡也展示 sort / pagination?**
> 建議:**否**。query-builder 的樹是「過濾樹」,沒有排序/分頁 UI。pg-filter 引擎只展示 `WHERE <where>` + 參數(column+jsonb 混合正是賣點)。sort/pagination 預覽留到未來(需要額外 UI)。

### 1.4 live-match（不變）

`runLiveMatch` 以 `@rfjs/data-filter` 對 sample 列做記憶體比對,**與選哪個引擎無關**(它吃 builder 樹,把所有 field 當路徑)。選 pg-filter 時 live-match 照常顯示命中列;若樹含 data-filter 無法涵蓋的 jsonb-only 運算子,維持現有 `uncoverable` 提示。pg-filter 引擎**不需**特別處理。

---

## Part 2（B3）— 三欄全寬彩色 UI

把此工具從兩欄 `ToolShell` 換成**全寬三欄**版面(`ToolShell` 仍供其他簡單工具用)。

```
┌────────────┬─────────────────────────┬──────────────┐
│ 左:資料源  │ 中:彩色巢狀樹           │ 右:輸出      │
│            │                         │              │
│ sample/貼上│ logic(and/or/nor/not)   │ 引擎切換     │
│ 欄位清單:  │ /dataType/operator 上色 │ 轉換結果 SQL │
│  include   │ 遞迴群組 + 條件         │ + 參數       │
│  kind 切換 │ creatable 欄位 combobox │ live-match   │
│  type      │                         │ 命中列       │
└────────────┴─────────────────────────┴──────────────┘
```

### 2.1 左欄 — 資料源 + schema 控制
- sample JSON textarea(現有)+ 推斷錯誤提示。
- 欄位清單,每列:`include` 勾選、**`kind` 切換(column/jsonb,object/array 鎖死為 jsonb)**、`type` 下拉(現有)。
- 一鍵「頂層 scalar → column」(見 D1)。

### 2.2 中欄 — 彩色巢狀樹
- 沿用現有遞迴 `GroupNode` / `ConditionRow` 邏輯,改版面與上色。
- **上色走 `@rfjs/web-ui` Tailwind token,不硬寫色碼**:logic 運算子、dataType、filterOperator 各一組語意色(用既有 token 如 `signal`/`fault`/`muted` 或新增語意 token)。
- 欄位 key 改 **creatable combobox**:下拉列出推斷出的欄位 + 允許自打新 key;打新 key 即時補一筆 `FieldSchema`(預設 `kind:'jsonb'`、`dataType:'string'`)。(完整「反向讀取」是 B2;此處僅單向新增欄位。)

### 2.3 右欄 — 輸出
- **引擎切換**(jsonb / data-filter / pg-filter)移到此欄頂(現在在中欄輸入區)。
- 引擎輸出(primary SQL + secondary 參數,現有 PreviewPanel 邏輯)。
- live-match 命中列(現有)。

### 2.4 元件拆分
- 新版面容器 `ui/three-pane.tsx`(取代此工具對 `ToolShell` 的使用;`ToolShell` 不動)。
- 既有 `schema-panel` / `builder-tree` / `preview-panel` 拆進三欄;新增 `field-combobox.tsx`、配色用的小工具(token 對照,如 `logic-color.ts`)。
- 既有 `logic/`(compile/engines/tree-ops/live-match/...)**幾乎不動**,只加 pg-filter 引擎與 ctx 串接。

> **決策 D4 — 三欄在窄螢幕的退化?**
> 建議:`lg` 以上三欄並排;以下垂直堆疊(左→中→右),沿用現有 RWD 樣式慣例。

---

## 相依與套件
- `apps/web` 加 `@rfjs/pg-filter` dependency(純函式、platform neutral、瀏覽器安全;會帶進 sql-filter + jsonb-query,後者 apps/web 已依賴)。
- i18n:新字串(kind 切換、pg-filter 標籤、combobox 提示、一鍵設 column 等)加進此工具 co-located 的 `messages.ts`(en + zh-TW)。

## 測試策略
- **logic(TDD,vitest)**:pg-filter 引擎 compile —— 純 column 樹、純 jsonb 樹、混合樹(驗證每葉 target + 產出 SQL 含對應片段 + 參數連號);`operators(...,kind)` 依 kind 回傳正確矩陣;`mapType` 映射;非法情境(column 設在 object/array 欄位應在 UI 擋掉,引擎層以 ctx 為準)。schema 預設 kind、creatable 新增欄位的 schema-infer 互動。
- **UI**:沿用現有測試風格(元件渲染 + 互動);三欄版面在 lg/窄螢幕的結構;kind 切換驅動運算子清單改變。
- 全程 co-located `*.spec.ts`;沿用 apps/web vitest 設定;確認 SSG build 仍過。

## YAGNI / 範圍外
- **B2 反向讀取**、**B4 public 抽取** 不在本案。
- pg-filter 的 sort/pagination 預覽不做(D3)。
- 不加新運算子到 sql-filter(用既有能力)。
- column uuid 不支援(無法從 sample 推斷)。

## 相關 memory
[[query-builder-rework-b]](本案 = 其中 B1+B3)、[[sql-filter-and-datasets-query]](@rfjs/pg-filter 來源)、[[rfjs-open-source-and-layering]](B4 分層留待)、[[spec-language-traditional-chinese]]、[[commits-and-pr-in-english]]。
