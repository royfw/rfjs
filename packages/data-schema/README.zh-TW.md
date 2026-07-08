# @rfjs/data-schema

> English → [README.md](./README.md)

**資料資源中繼資料契約(data resource metadata contract)**:一個小巧、以 zod 驗證的形狀,
描述一個表格型資料資源 —— 它的**欄位**(key/label/dataType/format/options/sortable)、
如何**請求**其中一頁(分頁策略 + 排序編碼),以及如何從回應信封(response envelope)中
**讀出**一頁資料(rows/total/cursor 路徑)。它沒有 UI,也不做任何 fetch 呼叫 —— 它是
[@rfjs/table-builder](../table-builder) 及其下游消費者共同編譯所依據的共享詞彙。

---

## 安裝

```bash
npm i @rfjs/data-schema
```

## 快速開始

```ts
import {
  inferFieldsFromRows,
  buildRequestParams,
  extractRows,
  extractTotal,
  extractCursor,
  type DataResourceMeta,
} from '@rfjs/data-schema';

// 1. 定義(或從樣本資料列推斷)欄位中繼資料
const sampleRows = [
  { id: 1, name: 'Widget', price: 9.99, createdAt: '2024-03-15' },
  { id: 2, name: 'Gadget', price: 19.5, createdAt: '2024-03-16' },
];
const fields = inferFieldsFromRows(sampleRows);
// → [{ key: 'id', label: 'id', dataType: 'numeric' }, { key: 'name', label: 'name', dataType: 'string' }, ...]

const meta: DataResourceMeta = {
  fields,
  request: {
    endpoint: '/api/products',
    pagination: { strategy: 'page', pageParam: 'page', pageSizeParam: 'pageSize' },
    sort: { style: 'split', fieldParam: 'sortBy', dirParam: 'order' },
  },
  response: {
    rowsPath: 'data.items',
    totalPath: 'data.total',
  },
};

// 2. 依指定的頁碼 + 排序狀態建構請求參數
const built = buildRequestParams(meta.request!, {
  pageSize: 20,
  page: 1,
  sort: { key: 'price', direction: 'desc' },
});
// → { endpoint: '/api/products', method: 'GET', params: { page: '1', pageSize: '20', sortBy: 'price', order: 'desc' } }

const res = await fetch(`${built.endpoint}?${new URLSearchParams(built.params)}`, { method: built.method });
const payload = await res.json();
// payload = { data: { items: [{ id: 1, name: 'Widget', ... }], total: 87 } }

// 3. 從回應信封中讀出這一頁
const rows = extractRows(payload, meta.response!); // → payload.data.items
const total = extractTotal(payload, meta.response!); // → 87
const cursor = extractCursor(payload, meta.response!); // → undefined(未設定 cursorPath)
```

`inferFieldsFromRows` 只讀取純物件(plain object)的資料列:巢狀物件會被遞迴走訪
(以 dot path 表示,例如 `'author.name'`),陣列與 `null`/`undefined` 葉節點會被跳過;
若同一個 key 在不同資料列間推斷出不同型別,會回退為 `'string'`。

## 驗證不受信任的中繼資料

來自設定檔、資料庫或使用者輸入的中繼資料,應該透過 zod schema 解析,而不是直接當作
`DataResourceMeta` 信任:

```ts
import { parseDataResourceMeta } from '@rfjs/data-schema';

const meta = parseDataResourceMeta(rawJson); // 形狀或 format 不符時拋出 ZodError
```

`format` 會與 `dataType` 交叉檢查(例如 `'currency'` 只在 `dataType: 'numeric'` 時合法,
`'datetime'` 只在 `dataType: 'date'` 時合法),透過 `superRefine` 實作 —— 因此不一致的組合
會在驗證階段就失敗,而不是靜默地渲染錯誤結果。

## API

### Infer / build / extract

| 匯出 | 簽章 | 說明 |
| --- | --- | --- |
| `inferFieldsFromRows(rows)` | `(unknown) => DataFieldMeta[]` | 從樣本資料列推斷每個 key 的 `dataType`;若 `rows` 不是純物件陣列則拋出例外 |
| `buildRequestParams(request, state)` | `(RequestMeta, PageState) => BuiltRequest` | 將分頁(`offset`/`page`/`cursor`)+ 選用的排序編碼進查詢參數 |
| `extractRows(payload, response)` | `(unknown, ResponseMeta) => unknown[]` | 若 `rowsPath` 處的值不是陣列則拋出例外 |
| `extractTotal(payload, response)` | `(unknown, ResponseMeta) => number \| undefined` | 當 `totalPath` 未設定或解析出非數字時回傳 `undefined` |
| `extractCursor(payload, response)` | `(unknown, ResponseMeta) => string \| undefined` | 當 `cursorPath` 未設定或解析出非字串時回傳 `undefined` |
| `getByPath(obj, path)` | `(unknown, string) => unknown` | dot path 取值器;`''` 會回傳 `obj` 本身 |
| `resolveLabel(label, locale, fallbackLocale?)` | `(LocalizedLabel, string, string?) => string` | 字串直接回傳,或依 locale 對照表查找(附 fallback locale / 第一個值的保底) |

### 驗證(zod)

| 匯出 | 驗證對象 |
| --- | --- |
| `parseDataResourceMeta(input)` | `DataResourceMeta`;形狀不合法時拋出例外 |
| `dataResourceMetaSchema` | 完整契約(`fields` + 選用的 `request`/`response`) |
| `dataFieldMetaSchema` | 單一欄位;交叉檢查 `format` 與 `dataType` |
| `paginationMetaSchema` | 以 `strategy` 區分的 discriminated union |
| `sortMetaSchema` | 以 `style` 區分的 discriminated union |
| `requestMetaSchema`、`responseMetaSchema` | 請求 / 回應中繼資料 |
| `fieldOptionSchema`、`fieldFormatSchema`、`localizedLabelSchema` | 葉節點 schema |

### 核心型別

| 型別 | 形狀 |
| --- | --- |
| `DataFieldMeta` | `{ key, label, dataType, format?, options?, sortable?, filterable? }` |
| `PaginationMeta` | `{ strategy: 'offset', limitParam, offsetParam }` &#124; `{ strategy: 'page', pageParam, pageSizeParam, firstPage? }` &#124; `{ strategy: 'cursor', cursorParam, limitParam }` |
| `SortMeta` | `{ style: 'single', param, encoding: 'colon' \| 'signed' }` &#124; `{ style: 'split', fieldParam, dirParam }` |
| `RequestMeta` | `{ endpoint, method?, pagination, sort? }` |
| `ResponseMeta` | `{ rowsPath, totalPath?, cursorPath? }` |
| `DataResourceMeta` | `{ fields, request?, response? }` |
| `SortState` | `{ key, direction: 'asc' \| 'desc' }` —— 消費端的排序狀態 |
| `PageState` | `{ pageSize, offset?, page?, cursor?, sort? }` —— 消費端的分頁狀態 |
| `BuiltRequest` | `{ endpoint, method, params }` —— `buildRequestParams` 的結果 |
| `ScalarType` | `'string' \| 'numeric' \| 'date' \| 'boolean'` |
| `FieldFormat` | `'integer' \| 'decimal' \| 'percent' \| 'currency'`(僅 numeric)&#124; `'date' \| 'datetime' \| 'time'`(僅 date) |
| `LocalizedLabel` | `string \| Record<string, string>` |

## 家族關係

```
 @rfjs/data-schema           ← 你在這裡
 欄位 / 請求 / 回應中繼資料契約 + infer/build/extract 輔助函式
              ▼
 @rfjs/table-builder
 deriveTableConfig(meta) 將 DataResourceMeta 編譯為 TableConfig,
 並提供 sortRows / formatCell / paginate 等純函式
              ▼
 @rfjs/table-builder-ui              @rfjs/form-builder(result item)
 TableConfig 的 React 渲染器            mode: 'table' 內嵌一個 TableConfig
```

`data-schema` 是最底層的契約:它不認識 React、表格或表單。任何下游若需要描述
「某個資源、帶有這些欄位的一頁資料」,都應該建立在這個套件之上,而不是自行發明形狀。

## 授權

ISC
