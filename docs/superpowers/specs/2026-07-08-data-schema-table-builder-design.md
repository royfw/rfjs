# 資料描述層 + config 化資料表:@rfjs/data-schema、@rfjs/table-builder、@rfjs/table-builder-ui 設計

- 日期:2026-07-08
- 狀態:已與使用者逐段確認
- 分支:`feat-data-table`(獨立 worktree,與 form-builder result item session 並行)

## 1. 動機與定位

form-builder 之外,表單/表格也可能「從外部描述轉換而來」。本案先定義**資料面的 metadata 契約**(`DataResourceMeta`),table 只是它的第一個消費者;之後 FormConfig 骨架衍生、filter 欄位清單、flow 清單頁都會消費同一份契約。

三層結構 + 一個展示工具:

```
@rfjs/data-schema   (publishable engine)  DataResourceMeta 契約 + helpers
      ↑
@rfjs/table-builder (publishable engine)  TableConfig + deriveTableConfig + 純函式
      ↑
@rfjs/table-builder-ui (private React)    <ConfigTable> + useConfigTable
      ↑
apps/web 工具「table-builder」            上編輯/下預覽 + 假 fetcher 分頁 demo
```

依賴單向、不碰 form-builder 任何檔案。

### 紀律(不可違背)

1. **不做通用標準** — 不引入/實作 JSON Schema、OpenAPI;外部格式日後用轉換器轉進 `DataResourceMeta`,不是把外部格式當內部真相。v1 欄位只放 table 顯示所需。
2. **衍生是單向 compile** — `deriveTableConfig(meta)` 產生可再編輯的 config,不是 runtime 動態綁定;meta 之後變更不會自動同步回 config。
3. **FormConfig 骨架衍生不在本 session 範圍**(避免碰 form-builder 檔案)— 記於 future work。

### 介面接縫(先知道,不實作)

form-builder 的 result item 之後會以 `{ mode: 'table', table: TableConfig }` 內嵌本案定義的 `TableConfig` — 因此 **`TableConfig` 型別名與 `@rfjs/table-builder` 套件名凍結,不再改**。

## 2. 已確認的關鍵決策

| 議題 | 決策 |
| --- | --- |
| 分頁範圍 | 契約、helpers、UI 三種策略(offset / page / cursor)全做;cursor 模式 UI 降級為 prev/next(無總數、不可跳頁) |
| 排序語義 | 跟著資料來源走:靜態 rows → client 記憶體排序;fetcher → 排序參數經 request meta 送 server 重新 fetch(回到第一頁) |
| fields 契約 | key / label / dataType / format / options / sortable / filterable;format 走封閉字彙(依 dataType 驗證);options 為 `{ value, label }[]` |
| filter 帶法 | v1 契約**不含**(無消費者);`filterable` 欄位佔位,future work additive 加入 |
| 工具頁 UX | 上編輯(資料來源 / Columns / 分頁三面板並排)/ 下全寬即時預覽 — 表格是寬型元件,全寬預覽才看得出成品 |
| 拖拉排序 + pin | 都進 v1:columns 陣列順序 + `pin: 'left'\|'right'`;編輯器原生 HTML5 拖拉 + pin 切換;渲染 CSS sticky |
| 邏輯歸屬 | engine 純函式 + UI hook(比照 filter-builder ↔ filter-builder-ui 分工);排序比較器、分頁計算、格式化都在 engine,UI 只管 React 狀態與呼叫 fetcher |
| UI labels | **偏離 filter-builder-ui 慣例**:`labels?: Partial<TableLabels>` 選填 + 內建英文預設(result item 內嵌時不必帶全套文案);工具頁照樣從 next-intl 組完整 labels 傳入 |

## 3. `@rfjs/data-schema`(publishable)

打包比照 `@rfjs/decision-table`:tsdown、dual export(單一根 barrel)、`publishConfig.access: public`、`sideEffects: false`、唯一 dependency `zod ^4`。

### 3.1 核心型別(全部有對應 zod schema 並匯出)

```ts
type ScalarType = 'string' | 'numeric' | 'date' | 'boolean';   // 沿用 rfjs 既有字彙(filter-builder / form-builder / jsonb-query 同款)
type LocalizedLabel = string | Record<string, string>;          // 同 form-builder 慣例

// resolveLabel(label, locale, fallbackLocale?) 一併提供
// (實作複製自 form-builder 的 localized-label.ts,不 import form-builder — 紅線)

type FieldFormat =
  | 'integer' | 'decimal' | 'percent' | 'currency'   // 僅限 dataType: 'numeric'
  | 'date' | 'datetime' | 'time';                     // 僅限 dataType: 'date'
// zod superRefine 驗證 format 與 dataType 相容;boolean / string 無 format

interface DataFieldMeta {
  key: string;                    // dot path,可指到巢狀值,如 'author.name'
  label: LocalizedLabel;
  dataType: ScalarType;
  format?: FieldFormat;
  options?: { value: string | number | boolean; label: LocalizedLabel }[];  // enum 欄位(狀態碼→標籤)
  sortable?: boolean;             // 預設 false
  filterable?: boolean;           // 預留給日後 filter 消費,v1 table 不使用
}

interface RequestMeta {
  endpoint: string;
  method?: 'GET' | 'POST';        // 預設 GET
  pagination:                     // discriminated union
    | { strategy: 'offset'; limitParam: string; offsetParam: string }
    | { strategy: 'page';   pageParam: string; pageSizeParam: string; firstPage?: 0 | 1 }  // 預設 1
    | { strategy: 'cursor'; cursorParam: string; limitParam: string };
  sort?:                          // server 排序參數怎麼帶
    | { style: 'single'; param: string; encoding: 'colon' | 'signed' }  // sort=name:asc / sort=-name
    | { style: 'split';  fieldParam: string; dirParam: string };        // sortBy=name&order=asc
}

interface ResponseMeta {
  rowsPath: string;      // dot path 到列陣列;'' 表示回應本身就是陣列
  totalPath?: string;    // offset / page 模式取總數
  cursorPath?: string;   // cursor 模式:下一頁游標位置;取無值 = 沒有下一頁
}

interface DataResourceMeta {
  fields: DataFieldMeta[];
  request?: RequestMeta;    // 純靜態資料可以沒有
  response?: ResponseMeta;
}
```

### 3.2 Helpers(零 React,node 環境單測)

- `inferFieldsFromRows(rows: unknown): DataFieldMeta[]` — 參考 filter-builder `schema-infer.ts` 的走訪方式:巢狀物件攤成 dot path;數字→`numeric`、布林→`boolean`、ISO 日期字串→`date`、其餘→`string`;跨列型別衝突退回 `string`;null/undefined 跳過;**物件/陣列本身不產生欄位**(表格只顯示 scalar);label 預設用 key 字串。非陣列或列非純物件時丟明確錯誤。
- `buildRequestParams(request: RequestMeta, state): BuiltRequest` — 輸入 `{ pageSize, offset? | page? | cursor?, sort?: { key, direction } }`,輸出 `{ endpoint, method, params: Record<string, string> }`;純函式,不發請求(transport 由外部注入)。
- `extractRows(payload, response): unknown[]`、`extractTotal(payload, response): number | undefined`、`extractCursor(payload, response): string | undefined` — 按 dot path 取值;path 取不到時 rows 丟明確錯誤、total/cursor 回 undefined。
- dot path 取值工具(`getByPath`)供上述與 table-builder 共用。

## 4. `@rfjs/table-builder`(publishable)

打包同上;deps:`@rfjs/data-schema`(workspace:*)+ `zod ^4`。

### 4.1 核心型別(有對應 zod schema;**名稱凍結**)

```ts
interface TableColumnConfig {
  key: string;
  label: LocalizedLabel;
  dataType: ScalarType;
  format?: FieldFormat;
  options?: { value: string | number | boolean; label: LocalizedLabel }[];
  sortable?: boolean;        // 預設 false
  visible?: boolean;         // 預設 true — 編輯器顯/隱開關
  pin?: 'left' | 'right';
  align?: 'left' | 'center' | 'right';  // 未指定時渲染端按 dataType 給預設(numeric → right,其餘 left)
}

interface TableConfig {
  columns: TableColumnConfig[];               // 陣列順序 = 欄位順序(拖拉排序改這裡)
  pagination: { pageSize: number; pageSizeOptions?: number[] };
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  emptyText?: LocalizedLabel;                 // 可省,UI 有英文預設
}
```

### 4.2 衍生與純函式

- `deriveTableConfig(meta: DataResourceMeta): TableConfig` — fields 逐一映射(`filterable` 忽略、`sortable` 照抄、label/format/options 帶過去),`pageSize` 預設 10;單向 compile,產物可再編輯。
- `sortRows(rows, sort, columns)` — client 排序:按 column `dataType` 選比較器(numeric 數值比、date 時間比、string `localeCompare`、boolean false<true);null/undefined 一律沉底;stable。
- `formatCell(value, column, locale?)` — format token → 顯示字串:numeric 走 `Intl.NumberFormat`(currency 預設 USD 樣式先固定,future work 再參數化)、date 走 `Intl.DateTimeFormat`;有 `options` 先查 value→label(查不到顯示原值);null/undefined → `''`。
- 分頁計算:`pageCount(total, pageSize)`、`pageToOffset` / `offsetToPage`、cursor「有無下一頁」判斷(有 cursor 即有)。
- 自 data-schema re-export `resolveLabel` 等必要型別,方便單一 import。

## 5. `@rfjs/table-builder-ui`(private React)

打包完全比照 `filter-builder-ui`:`"private": true`、`"type": "module"`、`"exports": { ".": "./src/index.ts" }`、無 build step、`react`/`react-dom ^19` peerDeps、jsdom vitest;加入 web 的 `transpilePackages`。deps:`@rfjs/table-builder`、`@rfjs/web-ui`、`lucide-react`。

### 5.1 資料來源注入

```ts
type TableSource =
  | { kind: 'rows'; rows: Record<string, unknown>[] }                 // 靜態:client 排序/分頁
  | { kind: 'remote';
      request: RequestMeta; response: ResponseMeta;
      fetch: (built: BuiltRequest) => Promise<unknown> };              // transport 注入:工具頁給假 fetcher,真實 app 給 fetch wrapper
```

### 5.2 `useConfigTable(config, source)`

React 狀態機:當前頁/排序/loading/error/rows/total。

- 靜態:engine `sortRows` + slice 分頁。
- 遠端:`buildRequestParams` → `source.fetch` → `extractRows`/`extractTotal`/`extractCursor`;排序改變即重新 fetch 並回第一頁;fetch 失敗顯示錯誤狀態(可重試)。
- cursor 模式:維護游標堆疊(client 端)做上一頁;無總數、不可跳頁。

### 5.3 `<ConfigTable config source labels? locale? />`

- 用 `@rfjs/web-ui/components/table` 原語渲染;`visible: false` 欄位不渲染。
- 標頭:sortable 欄位可點,↑↓ 指示。
- 分頁列:offset/page → 頁碼 + prev/next + 總數;cursor → 僅 prev/next。`pageSizeOptions` 有值才顯示 pageSize 切換下拉,未提供則不顯示。分頁控制元件在本套件內做(web-ui 目前無,先不上移)。
- 儲存格:engine `formatCell`;`align` 未指定按 dataType 預設。
- `pin`:CSS sticky + 邊界陰影(左右各自成組)。
- 空狀態(`emptyText` 或預設)、載入、錯誤三態。
- **labels:`labels?: Partial<TableLabels>` 選填、內建英文預設**(偏離 filter-builder-ui 的必填慣例,理由:result item 內嵌時不必帶全套文案)。

## 6. apps/web 工具「table-builder」

`apps/web/src/tools/table-builder/`:`index.ts`(ToolModule)、`ui.tsx`(`"use client"`)、editor 面板元件、`sample.ts`(範例資料)、`fake-fetcher.ts`、`messages.ts`(en、zh-TW)、co-located specs。

### 6.1 版型(已與使用者用 mockup 定案)

上編輯 / 下全寬預覽:

- **資料來源面板**:靜態 rows ↔ 假 fetcher 切換;fetcher 模式再切 offset / page / cursor。
- **Columns 面板**:每欄一列 — 原生 HTML5 拖拉排序、顯/隱 checkbox、label 編輯、format 下拉(依 dataType 過濾選項)、sortable 開關、pin 切換(無/左/右)。
- **分頁面板**:pageSize、空狀態文字。
- **下方**:`<ConfigTable>` 即時預覽,任何設定變更立即反映。

### 6.2 假 fetcher

同一份範例資料實作三種分頁策略(offset/page/cursor)+ server 端排序模擬 + 模擬延遲(loading 可見)。這同時是 `DataResourceMeta` request/response 契約的活範例。

### 6.3 註冊(本 session 擁有 append 權的共用檔)

- `packages/web-core/src/registry/tools.ts`:`{ id: 'table-builder', category: 'generator', surface: 'web', status: 'preview', relatedPackages: ['@rfjs/table-builder', '@rfjs/data-schema'], tags: ['table', 'builder', 'playground'] }`
- `packages/web-core/src/registry/packages.ts`:`@rfjs/data-schema`、`@rfjs/table-builder` 兩條目(href `/packages/...`)。
- `apps/web/src/tools/index.ts`、`messages.ts`、`index.spec.ts` append。
- `apps/web/next.config.js` `transpilePackages` += `@rfjs/table-builder-ui`。
- `apps/web/package.json` += workspace deps。

## 7. 打包紀律與測試

### 7.1 changeset / README

- changeset:`data-schema`、`table-builder`、`table-builder-ui` 各一份 minor(UI private 也要,version-only);apps 不寫。
- 兩個 publishable 套件補雙語 README(比照 filter-builder 家族)。

### 7.2 測試

| 層 | 內容 |
| --- | --- |
| data-schema 單測 | zod 契約(含 format×dataType 相容、pagination union)、inferFieldsFromRows(巢狀/衝突/日期偵測/錯誤輸入)、buildRequestParams 三策略×排序兩帶法、extract*(path 取值、缺值行為) |
| table-builder 單測 | deriveTableConfig、sortRows(各型別、null 沉底、stable)、formatCell(各 token、options、null)、分頁計算 |
| table-builder-ui 元件測試 | jsdom + testing-library:排序點擊(靜態/遠端兩語義)、三種分頁翻頁(mock fetcher)、空/載入/錯誤狀態、pin sticky 屬性、labels 預設與覆寫 |
| 工具 spec | 註冊完整性(index/messages/registry)、editor 邏輯 |
| e2e | `apps/web/e2e/table-builder.e2e.ts` 一條:工具頁渲染出表格 + 翻頁;預設 port 3002,與並行 session 相撞時 `E2E_PORT=3012` |
| 真渲染驗證 | `next build` + `next start` + light/dark 截圖 |

## 8. Future work(記錄,不實作)

1. **table filter 階段**:`filterable` 已佔位;`RequestMeta` additive 加 filter 帶法;編輯用現成 `filter-builder-ui`(fields 即欄位清單);執行語義跟排序同款 — 靜態走 `data-filter`、遠端帶參數給 server。約一個獨立 session 份量。
2. **FormConfig 骨架衍生**:`DataResourceMeta` → FormConfig 草稿(另 session,避開 form-builder 紅線)。
3. **外部格式轉換器**:JSON Schema / OpenAPI → `DataResourceMeta` 的獨立轉換器(外部格式不是內部真相)。
4. **formatCell 參數化**:currency 幣別、小數位數等 format options。
5. **分頁控制元件上移 web-ui**:若其他 app/工具也需要再做。

## 9. 並行紅線(執行期間全程遵守)

- **絕不動**:`packages/form-builder/**`、`packages/form-builder-ui/**`、`apps/web/src/tools/form-builder/**`。
- 共用檔僅 **append**:`packages/web-core/src/registry/{tools,packages}.ts`、`apps/web/src/tools/{index,messages}.ts`、`apps/web/src/tools/index.spec.ts`、`apps/web/next.config.js`、`apps/web/package.json`、pnpm-workspace 相關。
- 全程在 worktree `.claude/worktrees/feat-data-table` 內;commit/PR 英文 conventional commits;HOLD PR,使用者自行 merge。
