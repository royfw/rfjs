# workbench 資料集探索器(consumer)— 設計

> 子專案 **B** 終局的消費端。交叉審查後定:**B4-ui(provider)由另一個 session 做**——抽 `@rfjs/filter-builder-ui`(私有,含 `<FilterTreeEditor>` + `useFilterTree` + colors,labels-as-props);**本案(consumer)做 apps/workbench 的資料集探索器**,消費那組 API。
> 兩份 spec 已對齊:套件名 `@rfjs/filter-builder-ui`、私有、labels-as-props、hook 與元件同套件、`@rfjs/filter-builder` 需新增結構化 `toPgGroup` export。本案**不碰 apps/web、不碰 packages**,只動 `apps/workbench`,衝突面為零。

## 背景與終局

query-builder 這條線的原始終局:**讓 workbench 對真實資料集視覺化建構過濾、執行**。後端 `POST /datasets/query` 已就緒(libs/core `query-datasets` usecase + apps/api route)。本案把「樹編輯器(來自 B4-ui)+ filter-builder 的結構化輸出」接到這個端點,做成 workbench 的探索頁。

**重要語意**:`/datasets/query` 是**對 datasets 這張表本身**做過濾(欄位見下),回傳符合的 `Dataset[]`,**不是**查某個 dataset 內部的列。所以探索器是「用 column + jsonb 條件篩選資料集目錄」。

## 後端契約(只 consume,不改)

- **Request** `QueryDatasetsBody`(zod `.strict()`):`{ filter?: PgFilterGroup; sort?: PgSort[]; page=1; pageSize=20(max 100) }`。
- **`PgFilterGroup`** leaf 二擇一:
  - column:`{ target:'column', column, operator, value? }`
  - jsonb:`{ target:'jsonb', field, dataType, operator, value?, elementType?, filters? }`
- **Response** `QueryDatasetsResult`:`{ items: Dataset[]; total; page; pageSize }`;`Dataset = { id; name; description|null; data: Record<string,unknown>; createdAt; updatedAt }`。
- **datasets 的 pg-filter 設定**(`libs/core` `datasetPgConfig`,決定可用欄位):
  - columns:`name`(text)、`description`(text)、`createdAt`(timestamp)、`updatedAt`(timestamp)、`id`(uuid)
  - jsonb:`data` 欄(dialect `jsonpath`)
- 錯誤:後端把 `JsonbQueryError`/`ColumnQueryError`/`PgFilterError` 映成 **400**。

## 依賴(provider 必須提供 —— 互審協調點)

1. **`@rfjs/filter-builder-ui`**(B4-ui,另一 session):
   - `<FilterTreeEditor tree, schema, engineId, onChange, onCreateField, labels />`
   - `useFilterTree(init?) → { tree, schema, setTree, setSchema, createField }`
   - `logicColor` / `dataTypeColor`(本案大概不直接用,FilterTreeEditor 內部用)
2. **`@rfjs/filter-builder` 新增結構化 export**:`toPgGroup(tree, schema) → PgFilterGroup`(依 schema 的 `kind` 把 leaf 打 `target:'column'|'jsonb'`、column leaf 的 `column` 用 config key)。**目前引擎只吐字串 SQL(`EngineOutput.primary`)**,本案需要結構化 group 才能送 API。此 export 屬 `@rfjs/filter-builder`(logic 套件 owner = 另一 session)領域 → **由 provider 那邊一併加**。
   - 若 provider 暫時不加,fallback:本案在 workbench 內自行用 filter-builder 的 `treeToFilterGroup` + 一個薄 mapper 依 schema kind 補 `target`(技術債,且邏輯與 pg-filter 引擎重複 → 不建議,列為協調項)。

## 探索器設計(apps/workbench)

### 位置
- 路由:`apps/workbench/src/app/[locale]/(shell)/datasets/explore`(或 datasets 頁內分頁)。沿用既有 `(shell)` 版面。

### Schema 來源(非 sample-JSON)
探索器的 builder schema **固定來自 datasets 的可篩欄位**(對齊 `datasetPgConfig`):
- column 欄位:`name`/`description`(string)、`createdAt`/`updatedAt`(date)、(`id` 視需要)—— `FieldSchema.kind='column'`,`path` = config key。
- jsonb 欄位:`data` 之下的任意路徑 —— `kind='jsonb'`;使用者用 `FieldCombobox` 自行輸入 `data.xxx`(`onCreateField` 補 schema),或之後可由抽樣既有資料集的 `data` keys 預填(YAGNI,v1 先手輸)。
- `engineId='pg-filter'`(取得 column/jsonb 運算子矩陣)。

### 流程
1. 進頁 → 初始 schema(上述固定 column 集合 + 空 jsonb)。
2. `<FilterTreeEditor tree schema engineId='pg-filter' onChange onCreateField labels={workbenchLabels} />` 建樹;state 用 `useFilterTree`。
3. 排序/分頁控制(v1:可只給 page/pageSize;sort 可選,沿用後端 TIEBREAKER 預設)。
4. 按「執行」→ `toPgGroup(tree, schema)` → `queryDatasets({ filter, sort?, page, pageSize })`。
5. 顯示**結果表**(name / description / createdAt;`data` 可摺疊預覽)+ 總數 + 分頁;**空結果 vs API-down 分流**(沿用既有 `DatasetsResult` 的 `ok:true 空` vs `ok:false`)。

### API client(`apps/workbench/src/lib/datasets.ts` 擴充)
```ts
export type QueryResult =
  | { ok: true; items: Dataset[]; total: number; page: number; pageSize: number }
  | { ok: false; status?: number; error?: string }; // 400 → 帶回後端錯誤訊息以顯示
export async function queryDatasets(body: QueryDatasetsBody): Promise<QueryResult>;
```
- POST `${API_BASE_URL}/datasets/query`,`cache: 'no-store'`;非 2xx → `ok:false`(400 帶 error 字串,其餘視為 API-down)。沿用既有 `fetchDatasets` 的型態。

### i18n
- workbench 用**自己的**訊息命名空間,組出 `labels` 物件傳給 `<FilterTreeEditor>`(labels-as-props,與 apps/web 不共用 `ToolUI`)。explorer 外圍字串(欄位標題、執行鈕、空/錯狀態)用 workbench 既有 next-intl。

## 測試

- `lib/datasets.ts` `queryDatasets`:成功(items/total)、400(帶 error)、API-down(`ok:false`)、空結果(`ok:true items:[]`)。
- 探索頁(輕量):初始 schema 正確、建樹 → 執行呼叫 `queryDatasets` 帶正確 body(`toPgGroup` 輸出)、結果/空/錯三態渲染。
- 對 `toPgGroup` 的契約測試(若由本案 fallback 實作則必測;若 provider 提供則信任其套件測試 + 一個整合用例)。
- 全域 `pnpm -F workbench ...` test/check-types/lint/build。

## 風險 / 協調

- **`toPgGroup` 由誰提供**:首選 provider 在 `@rfjs/filter-builder` 加;本案實作前需確認到位,否則走 fallback(技術債)。**這是與另一 session 的唯一硬相依**。
- **provider API 穩定度**:`<FilterTreeEditor>` / `useFilterTree` 的 props 形狀以對方 spec 為準;若有出入以對方為準並回報。
- **schema↔config 對齊**:column `path` 必須等於 `datasetPgConfig` 的 key(name/description/...),否則後端 400(`.strict()` + 未知欄位)。jsonb path 走 `data` 欄。
- **無回歸**:本案不動 apps/web / packages,query-builder(A/B1/B2/B3)與 filter-builder 不受影響。

## 非目標(YAGNI)

- 不抽任何共用 UI(那是 B4-ui,provider 領域)。
- 不查「dataset 內部的列」(端點語意是篩 datasets 表;若日後要 per-dataset row 查詢,另案)。
- v1 不做 jsonb 欄位自動抽樣預填(先手輸 `data.*`)、不做進階 sort UI(用後端預設 tiebreaker,sort 可後續加)。
- 不改後端契約。
