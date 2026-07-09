# @rfjs/table-builder

> English → [README.md](./README.md)

建立在 [@rfjs/data-schema](../data-schema) 之上的**設定驅動、唯讀的資料表格引擎**。
它把資源的欄位中繼資料編譯成可編輯的 `TableConfig`(欄位、分頁、預設排序),並提供
用於前端排序、儲存格格式化、頁碼計算的純函式。它本身不做任何渲染 ——
[@rfjs/table-builder-ui](../table-builder-ui) 才是消費 `TableConfig` 並把它畫出來的 React 層。

---

## 安裝

```bash
npm i @rfjs/table-builder
```

`@rfjs/data-schema` 是相依套件 —— 它的核心型別(`ScalarType`、`LocalizedLabel`、
`DataResourceMeta` 等)以及 `resolveLabel`/`getByPath` 都會從本套件的根重新匯出,
因此大多數消費者不需要直接 import `@rfjs/data-schema`。

## 快速開始

```ts
import { deriveTableConfig, sortRows, formatCell, pageCount, pageToOffset } from '@rfjs/table-builder';
import type { DataResourceMeta } from '@rfjs/data-schema';

const meta: DataResourceMeta = {
  fields: [
    { key: 'name', label: 'Name', dataType: 'string', sortable: true },
    { key: 'price', label: 'Price', dataType: 'numeric', format: 'currency', sortable: true },
    {
      key: 'status',
      label: 'Status',
      dataType: 'string',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
  ],
};

// 1. 把欄位中繼資料編譯成可編輯的表格設定(pageSize 預設為 10)
const config = deriveTableConfig(meta);
// → { columns: [{ key: 'name', ... }, { key: 'price', ... }, { key: 'status', ... }], pagination: { pageSize: 10 } }

// 從這裡開始 config 可自由再編輯 —— 重新排序 config.columns、
// 切換 column.visible、設定 column.pin 等,它不再與 `meta` 同步。

const rows = [
  { name: 'Widget', price: 9.99, status: 'active' },
  { name: 'Gadget', price: 19.5, status: 'inactive' },
];

// 2. 前端排序(穩定排序;不論方向為何,null 值一律沉到最底)
const sorted = sortRows(rows, { key: 'price', direction: 'desc' }, config.columns);

// 3. 將每個儲存格格式化為顯示用字串(options 對照優先於 format;locale 感知的 Intl 格式化)
const cell = formatCell(sorted[0].price, config.columns[1], 'en');
// → '$19.50'
const statusCell = formatCell(sorted[0].status, config.columns[2], 'en');
// → 'Inactive'

// 4. 伺服端分頁資源的頁碼運算
const totalPages = pageCount(87, config.pagination.pageSize); // → 9
const offset = pageToOffset(3, config.pagination.pageSize); // → 20(第 3 頁,1 起始,pageSize 10)
```

## 驗證 `TableConfig`

來自儲存層或使用者輸入的設定(例如已儲存的表格版面)應該經過解析,而不是直接信任:

```ts
import { parseTableConfig } from '@rfjs/table-builder';

const config = parseTableConfig(rawJson); // 形狀或 format 不符時拋出 ZodError
```

與 `@rfjs/data-schema` 的 `dataFieldMetaSchema` 相同的 `format` ↔ `dataType` 交叉檢查
(例如 `'percent'` 只在 `dataType: 'numeric'` 時合法)。

## API

### 編譯 / 排序 / 格式化 / 分頁

| 匯出 | 簽章 | 說明 |
| --- | --- | --- |
| `deriveTableConfig(meta)` | `(DataResourceMeta) => TableConfig` | 單向編譯:把 `fields` 映射為 `columns`(捨棄 `filterable`),`pagination.pageSize` 預設為 `10`;深拷貝 `label`/`options`,結果絕不與 `meta` 共用參照 |
| `sortRows(rows, sort, columns)` | `(Record<string, unknown>[], SortState, TableColumnConfig[]) => Record<string, unknown>[]` | 前端穩定排序;比較器依對應欄位的 `dataType` 選擇;null/undefined 值一律沉到最底;不會修改輸入陣列 |
| `formatCell(value, column, locale?)` | `(unknown, TableColumnConfig, string) => string` | `null`/`undefined` → `''`;`column.options` 的 value→label 對照優先於 `format`;其次依 `column.format` 做 `Intl` 數字/日期格式化;都沒有則回傳 `String(value)`;`locale` 預設為 `'en'` |
| `pageCount(total, pageSize)` | `(number, number) => number` | 總頁數,至少為 `1` |
| `pageToOffset(page, pageSize, firstPage?)` | `(number, number, 0 \| 1) => number` | 頁碼 → 0 起始的資料列 offset;`firstPage` 預設為 `1` |
| `offsetToPage(offset, pageSize, firstPage?)` | `(number, number, 0 \| 1) => number` | `pageToOffset` 的反函式 |
| `hasNextCursor(cursor)` | `(string \| undefined) => boolean` | 當 `cursor` 有定義且非空字串時回傳 `true` |

### 驗證(zod)

| 匯出 | 驗證對象 |
| --- | --- |
| `parseTableConfig(input)` | `TableConfig`;形狀不合法時拋出例外 |
| `tableConfigSchema` | 完整設定(`columns`(至少 1 筆)+ `pagination` + 選用的 `defaultSort`/`emptyText`) |
| `tableColumnConfigSchema` | 單一欄位;交叉檢查 `format` 與 `dataType` |
| `tablePaginationConfigSchema`、`tableDefaultSortSchema` | 分頁 / 預設排序子形狀 |

### 從 `@rfjs/data-schema` 重新匯出

`resolveLabel`、`getByPath`,以及型別 `ScalarType`、`LocalizedLabel`、`FieldFormat`、
`FieldOption`、`DataResourceMeta`、`DataFieldMeta`、`SortState` —— 讓 `table-builder` 的
消費者不需要為了這些直接相依 `@rfjs/data-schema`。

### `TableConfig` / `TableColumnConfig`

```ts
interface TableColumnConfig {
  key: string;
  label: LocalizedLabel;
  dataType: ScalarType;
  format?: FieldFormat;
  options?: FieldOption[];
  sortable?: boolean; // 預設 false
  visible?: boolean; // 預設 true —— 編輯器的顯示/隱藏切換
  pin?: 'left' | 'right';
  align?: 'left' | 'center' | 'right'; // 未設定 -> 由渲染器依 dataType 決定預設(numeric -> right,其餘 -> left)
}

interface TableConfig {
  columns: TableColumnConfig[]; // 陣列順序 = 欄位順序(拖曳排序即編輯此陣列)
  pagination: { pageSize: number; pageSizeOptions?: number[] };
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  emptyText?: LocalizedLabel; // 選用,UI 有英文預設值
}
```

`TableConfig`/`TableColumnConfig` 是**凍結命名**:[@rfjs/form-builder](../form-builder)
的 result item 將會內嵌 `{ mode: 'table', table: TableConfig }`,所以這些型別是共享契約,
不是本套件的實作細節。

## 家族關係

```
 @rfjs/data-schema
 欄位 / 請求 / 回應中繼資料契約
              ▼
 @rfjs/table-builder                 ← 你在這裡
 deriveTableConfig(meta) → TableConfig,
 並提供 sortRows / formatCell / paginate 等純函式
              ▼
 @rfjs/table-builder-ui              @rfjs/form-builder(result item)
 TableConfig 的 React 渲染器            mode: 'table' 內嵌一個 TableConfig
```

本套件是**邏輯層**:沒有 React、也不做渲染。如果你需要在頁面上畫出實際的 `<table>`,
請安裝 `@rfjs/table-builder-ui`,把本套件產出的 `TableConfig` 交給它 ——
不要在原始 config 上自行重新實作渲染邏輯。

## 授權

ISC
