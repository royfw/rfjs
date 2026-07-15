# api filter 第一輪(stack only):遠端篩選契約 + ConfigTable remote 篩選 — 設計規格

日期:2026-07-10
分支:`feat-api-filter`(worktree,基於含 #239 的 main @ `ae7e413`)
狀態:範圍已與使用者確認 —— **stack only**,不押 workbench(其故事線待 #13 討論定案);metadata 宣告面板留第二輪。

## 目標

讓設定驅動表格的「篩選樹」能編進 **API 請求**(而非只做記憶體過濾):

```
FilterTreeEditor(篩選樹)→ treeToPgFilterGroup(既有)→ BuiltRequest.filter
    → fetcher(自行決定放 POST body 或 query param)→ {items,total} → ConfigTable
```

三層各補一塊,全部**不需要 postgres 即可開發與驗證**(web 工具的假 fetcher 走完全鏈路):

1. **`@rfjs/data-schema`**:契約 —— 欄位宣告 `kind`、請求宣告 `filter` 編碼、`BuiltRequest` 載運編譯後的 filter
2. **`@rfjs/table-builder-ui`**:remote 來源解鎖篩選(Apply 觸發重抓)+ controlled filter-tree props
3. **apps/web `table-builder` 工具**:fetcher 模式的假 fetcher 真的執行 filter(dogfood reverse-parse + runLiveMatch),示範全鏈路

## 非目標(明確不做)

- **workbench 改動**(datasets 頁換裝、宣告面板)—— 等 #13 故事線 + 第二輪
- **metadata 宣告面板** —— 第二輪(吃本輪契約)
- **NL→篩選樹助手** —— 需要本輪的 controlled props,下一輪接
- **`DataFieldMeta.operators`(限定欄位可用運算子)** —— FilterTreeEditor 目前沒有 per-field operator 限制能力,沒有消費者就不進契約(YAGNI)
- **remote 篩選的即時(逐鍵)重抓** —— v1 用 Apply 鈕;live+debounce 記為未來項
- **非 pg 的 filter 編碼**(`style` 保留擴充空間,但只實作 `'pg'`)
- 紅線:不碰 `packages/filter-builder/**`(零改動,只消費)、`packages/table-builder/**`(引擎零改動)、workbench、form-builder 系。

## 1. 契約(`@rfjs/data-schema`,minor changeset)

### 1.1 `DataFieldMeta.kind`

```ts
kind?: 'column' | 'jsonb';
```

- 字面量與 `@rfjs/filter-builder` 的 `FieldKind` **對齊但不 import**(兩套件互不依賴;比照 `ScalarType` 既有做法)
- 語義:此欄位在後端是 typed SQL column 還是 JSONB path —— **infer 推不出、只能 authored** 的資訊
- `inferFieldsFromRows` 不產生 `kind`(維持現狀);缺省時下游把該欄位視為不可遠端篩選

### 1.2 `RequestMeta.filter`

```ts
export interface FilterRequestMeta {
  style: 'pg';    // 目前唯一值;未來擴充其他編碼
  param: string;  // filter 在請求中的鍵名(POST body key,或 GET 時序列化後的 query param 名)
}
// RequestMeta 增加:
filter?: FilterRequestMeta;
```

### 1.3 `BuiltRequest.filter` 與 `buildRequestParams`

```ts
export interface BuiltRequest {
  endpoint: string;
  method: 'GET' | 'POST';
  params: Record<string, string>;
  /** 編譯後的 filter(對 data-schema 是不透明值);由 fetcher 依 meta.filter.param 放進 body 或序列化進 qs。 */
  filter?: unknown;
}

buildRequestParams(request, state, filter?: unknown): BuiltRequest
```

- 第三參數選填、向後相容;只有 `request.filter` 存在且 `filter` 非空時才附上
- **data-schema 不認得 pg-filter 型別**(保持零依賴):filter 是誰編譯的、長什麼樣,是上層(table-builder-ui + filter-builder)的事
- zod schema 同步更新(`filterRequestMetaSchema`;`dataFieldMetaSchema` 加 `kind`)

## 2. UI(`@rfjs/table-builder-ui`,minor changeset;私有套件照 changeset 政策)

### 2.1 `TableSource.remote` 增加 `fields`

```ts
{
  kind: 'remote';
  request: RequestMeta;
  response: ResponseMeta;
  fields?: DataFieldMeta[];   // 新增:遠端篩選的欄位描述(kind/dataType/filterable 來源)
  fetch: (built: BuiltRequest) => Promise<unknown>;
}
```

- 遠端篩選的 schema 來自 **meta 的 fields**,不是 TableConfig 的 columns(columns 是顯示描述,沒有 `kind`;查詢知識不進顯示層)
- 新 helper `fieldsToFilterSchema(fields): FieldSchema[]`:取 `filterable === true` **且** `kind` 存在的欄位 → `{ path: f.key, dataType: f.dataType, include: true, kind: f.kind }`(與既有 `columnsToFilterSchema` 並列,rows 模式不變)

### 2.2 remote 篩選行為(`useConfigTable`)

- **啟用條件**:`source.kind === 'remote'` 且 `request.filter` 存在且 `fieldsToFilterSchema(fields)` 非空;否則維持現行 `filterDisabled` 提示
- **Apply 觸發**(v1 決策):篩選樹編輯不即時打 API;按 **Apply** 才 `treeToPgFilterGroup(tree, schema)` → `buildRequestParams(request, { …page: 1 }, group)` → refetch。理由:避免逐鍵重抓與「值還沒填完的半成品條件」打出 400
- **空樹**:編譯結果無有效條件時,請求**不帶** filter(等同清除)
- **Apply 一律重置分頁**:offset/page 策略回第 1 頁;cursor 策略清空游標從頭抓(篩選條件變了,舊游標無意義)
- 分頁/排序既有行為不變,但翻頁/排序時**沿用當前已套用的 filter**(filter 是 page state 的一部分)
- hook 回傳增加:`appliedFilter`(當前已套用的 group 或 null)、`applyFilter()`;既有欄位不變(hook 呼叫順序穩定性守則照舊)

### 2.3 controlled filter-tree props(`ConfigTable`)

```ts
filterTree?: BuilderGroup;                 // 受控模式(NL 助手等外部寫入用)
onFilterTreeChange?: (t: BuilderGroup) => void;
```

- 未傳 = 現行非受控行為(內部 state),完全向後相容;傳了則樹狀態由外部持有
- rows 模式與 remote 模式都支援
- 篩選區 UI:remote 模式在 FilterTreeEditor 下方多一顆 **Apply** 鈕(label 走 `TableLabels` 新鍵 `filterApply`,含英文預設);rows 模式維持即時、不顯示 Apply

### 2.4 錯誤與邊界

- Apply 後 fetch 失敗:走既有 error/retry 狀態(retry 重放同一 built request,含 filter)
- `fields` 裡有 `filterable` 但缺 `kind` 的欄位:不進 schema(等同不可篩),不報錯
- 受控模式下 Apply 語義不變(讀當前樹編譯)

## 3. 示範(apps/web `table-builder` 工具)

- `sample.ts`:`SAMPLE_META.fields` 補 `kind`(展示混合:`id`/`title` 等平面欄 `column`;`author.name` 這種巢狀欄 `jsonb`)與 `filterable: true`(挑 3–4 欄);`SAMPLE_META.request` 補 `filter: { style: 'pg', param: 'filter' }`
- `ui.tsx`:fetcher 模式的 `source` 補 `fields: SAMPLE_META.fields`
- `fake-fetcher.ts`:接到 `built.filter`(PgFilterGroup)時真的過濾 —— **adapter**:pg 葉 → `FilterConditionLike`(`field: leaf.column ?? leaf.field`;column 葉無 `dataType`,從 SAMPLE fields 反查)→ `filterGroupToTree`(filter-builder 既有 reverse)→ `runLiveMatch` → 過濾後再分頁。這同時 dogfood 了 reverse-parse 鏈
- i18n:`tbFilterApply`(en: "Apply" / zh-TW: "套用")等新鍵,en/zh-TW 同步
- rows 模式(靜態資料)行為完全不變

## 4. 測試

| 層 | 內容 |
|---|---|
| `data-schema` | `kind`/`filter` schema 驗證(合法/非法);`buildRequestParams` 第三參數:有 meta.filter+filter → 附上;缺任一 → 不附;既有呼叫(兩參數)不變 |
| `table-builder-ui` | `fieldsToFilterSchema`(filterable+kind 過濾、缺 kind 剔除);remote:Apply 後 fetch 收到含 filter 的 built + 回第 1 頁;空樹 Apply → 不帶 filter;翻頁沿用 filter;無 `request.filter` → filterDisabled 照舊;controlled props(外部樹注入 → 編輯回呼);rows 模式回歸(既有測試不得刪弱) |
| 工具 | 假 fetcher:含 filter 的 built → 正確過濾+分頁(含 jsonb 巢狀欄);adapter 對 column 葉的 dataType 反查 |
| e2e | fetcher 模式:開篩選 → 加條件 → Apply → 列數縮;翻頁仍維持篩選 |
| 真渲染 | light/dark 截圖:fetcher 模式篩選展開 + Apply 後結果 |

**既有測試連動**:`table-builder-ui` 的 hook 順序守則、`use-config-table` 既有測試全數保留;web 工具 e2e 第 2 條(rows 模式篩選)不受影響。

## 5. 慣例

- Changesets:`@rfjs/data-schema` minor、`@rfjs/table-builder-ui` minor;apps 不寫
- `@rfjs/data-schema` 是 dist 套件:改完必須 rebuild 才輪到 UI/工具層;`table-builder-ui` 走 transpilePackages 免建置
- Commit/PR 英文 conventional(小寫、≤90 字元)+ `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`;HOLD PR;e2e 用 `E2E_PORT=3013`

## 6. 第二輪銜接(僅記錄,不在本輪)

metadata 宣告面板(編輯 fields 的 kind/filterable/enum options,匯入/匯出 meta.json)吃本輪契約;掛載位置(workbench datasets 頁或獨立組件)依 #13 故事線結論;會合輪把面板產的 meta 餵進本輪的 `TableSource.fields`。
