# query-builder 反向讀取(B2)— 設計

> 子專案 **B** 的第 4 塊中的 **B2**。B1(pg-filter 引擎 + field-kind)與 B3(三欄彩色 UI + creatable 欄位)已於 PR #172 ship。本案就地加在現有 `apps/web/src/tools/query-builder`,**不新增 tool**。B4(抽 public lib)仍 parked,不在本案。

## 背景

現在的 query-builder(#172 後)是三欄:**左** `SchemaPanel`(sample 資料 + schema 編輯)、**中** `GroupNode`(canonical 樹)、**右** 引擎切換器 + `PreviewPanel`(輸出 + live-match)。資料流是**單向 forward**:`tree → treeToFilterGroup → engine.compile → 輸出`。state 在 `ui/index.tsx`:`sampleText / schema / engineId / tree`。

引擎輸出:`jsonb`、`pg-filter` 出 SQL;**`data-filter` 引擎的 `compile` 就是 `JSON.stringify(group)`** —— 也就是 data-filter 的「表示」本身就是 canonical `FilterGroupLike`(同構於 `@rfjs/jsonb-query` 的 `JsonbFilterGroup`)。

本案讓這個 canonical 表示**可反向編輯**:把它貼上/改寫 → 反推回中間那棵樹。

## 目標與非目標

**目標**:選到 `data-filter` 引擎時,其 JSON 輸出就地變**可編輯**;編輯(debounced)→ parse → 回寫 `tree`,並補上樹用到、schema 還沒有的欄位。

**非目標(YAGNI)**:
- 不反解 `jsonb` / `pg-filter` 的 SQL(SQL 反解最難,排除 → 兩者維持唯讀)。
- 不支援 mongo(無 mongo 引擎)。
- 不新增 tool、不抽 public lib(B4)、不動 sample→infer 與 schema 編輯的既有 forward 流程。

## 設計原則

- **canonical tree 是唯一真相**。可編輯的 canonical-JSON 框是它的一個雙向 view。
- **可逆表示只有一個**:canonical `FilterGroupLike` JSON(= data-filter 引擎輸出)。SQL view 唯讀。
- 反向格式對齊 `@rfjs/jsonb-query` 的 `JsonbFilterGroup`,實務上等同既有的本地 `FilterGroupLike`(`logic` + `filters[]`,leaf 為 `{field, dataType, operator, value?, elementType?, filters?}`)。

## 行為

1. 右欄引擎選到 **data-filter** → JSON 輸出改用可編輯 textarea(其他引擎維持唯讀 SQL)。
2. 使用者編輯該框 → **停 ~300ms(debounced)** → `parseFilterGroup(text)`:
   - 成功 → `setTree(filterGroupToTree(group, id))`,並 `setSchema(mergeFieldsFromTree(schema, group))`。
   - 失敗 → 該框顯示 typed 錯誤訊息,**tree 與 schema 不變**。
3. **防迴圈**:框在編輯中(focused / 有未套用 draft)時,**不被樹回染**;離開編輯(blur,且無 pending parse)後,draft 重新同步成 `JSON.stringify(treeToFilterGroup(tree))`。
4. id 沿用現有 `crypto.randomUUID()`(`ui/index.tsx` 既有的 `id`)。

## 新增 logic(`apps/web/src/tools/query-builder/logic/reverse.ts`)

型別參考(現況,`logic/types.ts` / `logic/compile.ts`):
`FilterGroupLike = { logic: string; filters: Array<FilterConditionLike | FilterGroupLike> }`;
`FilterConditionLike = { field; dataType; elementType?; operator; value?; filters? }`;
`BuilderGroup = { kind:"group"; id; logic: LogicOp; children: BuilderItem[] }`;
`BuilderCondition = { kind:"condition"; id; field; dataType: FieldType; elementType?; operator; value?; filters?: BuilderGroup }`;
`FieldSchema = { path; dataType: FieldType; elementType?; include: boolean; kind: FieldKind }`。

- **`filterGroupToTree(group: FilterGroupLike, makeId: () => string): BuilderGroup`** — `treeToFilterGroup` 的逆。遞迴:
  - group → `{ kind:"group", id: makeId(), logic: group.logic as LogicOp, children: [...] }`。
  - 區分子項:有 `logic` 且無 `field` → 巢狀 group(遞迴);否則 → leaf condition。
  - leaf → `{ kind:"condition", id: makeId(), field, dataType: dataType as FieldType, operator, value?, elementType? as ElementType, filters? }`;當 `operator === "elemmatch"` 且 leaf 有 `filters` → `filters` 遞迴成 `BuilderGroup`(而非當成 group 子項)。
- **`parseFilterGroup(text: string): { ok: true; group: FilterGroupLike } | { ok: false; error: ReverseError }`** —
  - `JSON.parse`;失敗 → `invalidJson`。
  - 結構驗證:頂層必須是 plain object;`logic ∈ {and,or,nor,not}`;`filters` 為陣列;每個子項要嘛是合法巢狀 group(同規則遞迴),要嘛是合法 leaf(`field` 非空字串、`dataType` 字串、`operator` 非空字串;`elemmatch` 的 `filters` 為巢狀 group)。任一不符 → `invalidShape`。
  - `ReverseError = "invalidJson" | "invalidShape"`。
- **`mergeFieldsFromTree(schema: FieldSchema[], group: FilterGroupLike): FieldSchema[]`** — 走訪所有 leaf(含 elemmatch 巢狀),對 `field` 不在 `schema` 的,append `{ path: field, dataType: (dataType as FieldType), elementType?, include: true, kind: "jsonb" }`(預設 kind=jsonb,沿用 `addInferredField` 慣例;既有欄位**完全不動**,保留其 kind/dataType)。

## UI

- **新 `apps/web/src/tools/query-builder/ui/canonical-editor.tsx`** — 受控 textarea,內部:
  - `draft`(本地字串)、`editing` 旗標(onFocus=true / onBlur=false)、debounce(~300ms)。
  - `editing` 為 false 時,`useEffect` 把 `draft` 同步成 props 傳入的 `serialized`(由樹序列化)。
  - draft 變動(debounced)→ 呼叫 `onParse(text)`,由父層決定成功/失敗;失敗訊息以 prop 傳回顯示(紅字)。
  - props:`serialized: string`、`error: string | null`、`onParse(text: string): void`。
- **`ui/index.tsx`** — 當 `engineId === "data-filter"`:
  - 改渲染 `CanonicalEditor`,`serialized = JSON.stringify(treeToFilterGroup(tree), null, 2)`。
  - `onParse(text)`:`const r = parseFilterGroup(text)`;`r.ok` → `setTree(filterGroupToTree(r.group, id))` + `setSchema((s) => mergeFieldsFromTree(s, r.group))` + 清錯誤;否則 setReverseError(r.error)。
  - 其他引擎(jsonb / pg-filter)維持現有唯讀 `PreviewPanel`。
  - live-match(`runLiveMatch`)維持唯讀,隨樹更新。

## 錯誤處理

- parse 失敗只影響該框(顯示 `ToolUI.error.*` 對應訊息),**絕不**清空或破壞既有 tree / schema。
- 空字串 / 空白 → 視為「沒有反向輸入」,不報錯、不改樹(避免清空時誤觸)。

## 測試

co-locate `*.spec.ts`:
- `logic/reverse.spec.ts`:
  - **round-trip 不變式**:對多種樹,`treeToFilterGroup(filterGroupToTree(g)) ≡ g`(g 為合法、條件完整的 FilterGroupLike;含巢狀 group、elemmatch、array+elementType)。
  - `filterGroupToTree`:每個 node 有 id;elemmatch 的 `filters` 轉成 `BuilderGroup` 而非 group 子項。
  - `parseFilterGroup`:合法 → ok;壞 JSON → `invalidJson`;壞結構(logic 非法 / leaf 缺 field / filters 非陣列)→ `invalidShape`。
  - `mergeFieldsFromTree`:補缺欄位(dataType/elementType 取自條件,kind=jsonb);既有欄位不動;elemmatch 巢狀欄位也納入。
- `ui/canonical-editor.spec.tsx`(輕量):編輯中不被 `serialized` 回染;debounce 後呼叫 `onParse`;`error` prop 顯示紅字。

## i18n(query-builder `messages.ts` fragment,en + zh-TW)

新增 `ToolUI` key(掛在 query-builder fragment,避免與中央/其他 tool 碰撞):
- `canonicalEditable`(提示文:此框可貼上/編輯以反推查詢)
- `error.reverseInvalidJson`、`error.reverseInvalidShape`(對應 `ReverseError`)

(註:`ToolUI.error` 既有為共用巢狀物件,新 key 以 query-builder fragment 的 `ToolUI.error.*` 深度合併進去;need 確認不與中央既有 error key 撞名 —— `reverseInvalidJson/Shape` 為新名,無衝突。)

## 風險 / 注意

- **Hydration**:`canonical-editor` 是 client component;id 用 `crypto.randomUUID()`(既有作法),不可用 module 計數器(B3 踩過 useId hydration 雷)。
- **schema-authoritative compile**(B1 既有約束):compile 以 schema 為準。反向後務必 `mergeFieldsFromTree` 補欄位,否則新 field 在 schema 缺席會導致 compile 行為不如預期。
- **不變式邊界**:`treeToFilterGroup` 會丟棄不完整條件;`parseFilterGroup` 只接受完整條件,故 round-trip 成立。
