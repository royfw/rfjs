# query-builder 共用 UI + workbench 資料集探索器 — 設計(交叉審查草稿)

> **狀態:DRAFT,供與另一個 session 的 B4 spec 交叉審查用。** 在兩份 spec 對齊出分工邊界前,**不進入實作**。
> 前置:`@rfjs/filter-builder`(canonical logic/engines,PR #175)已 ship 且穩定,本案只 consume。本案 = 子專案 B 的剩餘兩塊:**B4-ui**(抽共用樹編輯器)與 **workbench explorer**(用真實資料集查詢)。

## 背景與終局

query-builder 這條線的原始終局是:**讓 apps/workbench 對真實 dataset 視覺化建構查詢並執行**(`POST /datasets/query`)。目前:
- `@rfjs/filter-builder`:canonical tree + engines(jsonb/data-filter/pg-filter)+ reverse + schema-infer,框架無關,已 ship。
- apps/web 的 query-builder tool:三欄 styled UI(`ui/*.tsx`),consume filter-builder,但**styled 元件鎖在 apps/web 內**,workbench 無法重用(app 不能互相 import)。
- apps/workbench:admin dashboard,已有 `lib/datasets.ts`(API client)+ `datasets/page.tsx`;後端 `POST /datasets/query`(收結構化 `PgFilterInput`)已就緒。

要讓 workbench 不重寫整個樹 UI,須把 styled 元件抽成**共用套件**。

## 分解(兩個相依子專案)

1. **B4-ui**(本案主體):抽共用樹編輯器到**私有**套件 `@rfjs/filter-builder-ui`;apps/web/query-builder 改 consume(行為保持)。
2. **workbench explorer**(本案第二段,依賴 1):新 `(shell)` 頁,用共用 UI + filter-builder 對選定 dataset 建查詢 → `POST /datasets/query` → 顯示結果。

> 為交叉審查,本 spec 同時涵蓋兩段的終局;實作可再切。

## 架構

### `@rfjs/filter-builder-ui`(新,**私有**)

- **為何私有**:依賴私有的 `@rfjs/web-ui`(shadcn + Tailwind token),公開會逼下游複製 Tailwind 設定。對齊 repo 分層策略(styled UI 留 repo)。
- **依賴**:`@rfjs/filter-builder`(logic)、`@rfjs/web-ui`(styled);`react` / `next-intl` 視 i18n 決策(見下)。
- **內容**:
  - **headless `useQueryBuilder()` hook**:擁有 state(`sampleText / schema / engineId / tree / reverseError`)+ actions + derived(`output / live / serialized`)。把 filter-builder 的 tree-ops / compile / live-match / reverse 串起來。**無 UI、無樣式、無 i18n**。
  - **styled 元件**:`BuilderTree`、`SchemaPanel`、`ValueEditor`、`FieldCombobox`、`CanonicalEditor`、`PreviewPanel`/`LiveMatchView`、`ThreePane`,以及組合好的 `<QueryBuilderPanel>`(三欄 + hook 接好)。
  - **`colors.ts`**(目前在 apps/web `query-builder/logic/colors.ts`)搬進本套件(它是 builder-tree 的呈現 token)。
- **i18n 解耦(關鍵決策)**:目前 `builder-tree / schema-panel / preview-panel / index` 直接 `useTranslations("ToolUI")`,綁死 apps/web 的訊息命名空間。共用套件不能假設下游的 i18n。**作法**:元件改吃一個 typed `labels` 物件 prop(或 React context),由各 app 把自己的訊息映射進去。`canonical-editor`/`value-editor`/`field-combobox` 已是 props 驅動,沿用同模式。→ 套件**不依賴 next-intl**。

### apps/web/query-builder(改為薄消費者,行為保持)

- `ui/index.tsx` 變薄:用 `useTranslations("ToolUI")` 組出 `labels` 物件,渲染 `<QueryBuilderPanel labels={labels} />`(或用 `useQueryBuilder` + 元件自行組)。
- 刪除已搬走的 `ui/*.tsx` 與 `logic/colors.ts`;保留 tool 專屬:`index.ts`(descriptor)、`messages.ts`(i18n fragment,key 不變)。
- 行為、外觀、reverse-read(B2)、三欄(B3)全部不變;既有測試續綠。

### apps/workbench explorer(新 `(shell)` 頁)

- 路由:`apps/workbench/src/app/[locale]/(shell)/datasets/[id]/explore`(或 datasets 頁內的 explorer 區塊)。
- 流程:**選 dataset → 取得其欄位 schema(來自 dataset metadata,非貼 JSON)→ 用共用 `<QueryBuilderPanel>` 建樹 → 按「執行」→ 送結構化 filter 到 `POST /datasets/query` → 顯示結果表 + 總數**。
- `lib/datasets.ts` 擴充 `queryDataset(id, input): Promise<...>`(POST /datasets/query)。
- schema 來源從「sample JSON infer」換成「dataset metadata」——sample-infer 那塊在 workbench 可隱藏或改用 dataset 欄位定義。

## 跨切關鍵依賴(交叉審查必看)

> **explorer 需要結構化輸出,但 filter-builder 引擎目前只吐字串 SQL。**
`POST /datasets/query` 收 `PgFilterInput`(`{ filter?: PgFilterGroup; sort?; page?; pageSize? }`),`PgFilterGroup` 的 leaf 帶 `target: 'column' | 'jsonb'`。但 `@rfjs/filter-builder` 的 `Engine.compile` 回 `EngineOutput = { primary: string }`(只有 SQL 字串)。pg-filter 引擎內部有 `toPgGroup` 的 target-tagging,但**未對外 export 結構化結果**。
→ **explorer 需要 `@rfjs/filter-builder` 額外 export `toPgGroup(tree, schema) → PgFilterGroup`(或等價的結構化建構函式)。** 這會動到 logic 套件(另一個 session 的領域),是本案與對方 spec 的**最大相依/協調點**。

## 衝突面(供與對方 spec 逐點對比)

1. **新套件名稱 / 位置**:本案提 `@rfjs/filter-builder-ui`(私有)。對方可能命名不同或主張放別處。
2. **誰把 `apps/web/.../query-builder/ui/*` 抽走**:本案要動這批檔(搬入套件 + apps/web 改薄消費)。同時有人動就撞。
3. **headless hook**:本案含 `useQueryBuilder`。對方可能也想做、或主張 hook 進別的套件。
4. **i18n 解耦方式**:本案改 `labels` props。若對方保留 `useTranslations`,兩案不相容。
5. **filter-builder 結構化 export(`toPgGroup`)**:由誰加進 logic 套件?(本案需要它,但它屬 logic 套件領域。)
6. **workbench explorer 歸屬**:本案含它;若對方也含,須擇一。
7. **colors.ts 去向**:本案搬進 UI 套件。

## 測試策略

- **套件**(`@rfjs/filter-builder-ui`):headless `useQueryBuilder` 用 `@testing-library/react` 的 `renderHook` 測 state/actions/derived;styled 元件以 props(含 `labels`)測關鍵互動(沿用 B2 的 props 驅動可測模式)。
- **apps/web**:行為保持——既有 query-builder 測試 + check-types + lint + build 續綠;新增「web 映射 messages→labels 無漏 key」守門。
- **explorer**:`queryDataset` client 測試(成功/錯誤/空)、頁面層輕量測試(選 dataset→建樹→執行→渲染結果);API-down vs 空結果區分(沿用 workbench 既有模式)。

## 非目標(YAGNI)

- 不改 `@rfjs/filter-builder` 的 logic 行為(只可能**新增** `toPgGroup` export,且須與 logic 套件 owner 協調)。
- 不把 styled UI 套件 public。
- 不做 mongo、不反解 jsonb SQL(維持 B2 範圍)。
- 不動後端 `/datasets/query` 契約(只 consume)。

## 建議實作順序(若分工歸本案)

B4-ui(抽套件 + apps/web 薄消費,行為保持)先 → 確認 logic 套件 export `toPgGroup` → workbench explorer。各自一份 plan。
