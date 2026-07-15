# @rfjs/table-builder

> 繁體中文 → [README.zh-TW.md](./README.zh-TW.md)

A **config-driven, read-only data table engine** over [@rfjs/data-schema](../data-schema).
It compiles a resource's field metadata into an editable `TableConfig` (columns, pagination,
default sort), and ships pure functions for client-side sorting, cell formatting, and page
math. It renders nothing itself — [@rfjs/table-builder-ui](../table-builder-ui) is the React
layer that consumes a `TableConfig` and paints it.

---

## Install

```bash
npm i @rfjs/table-builder
```

`@rfjs/data-schema` is a dependency — its core types (`ScalarType`, `LocalizedLabel`,
`DataResourceMeta`, ...) and `resolveLabel`/`getByPath` are re-exported from this package's
root, so most consumers never need to import `@rfjs/data-schema` directly.

## Quick start

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

// 1. Compile field metadata into an editable table config (pageSize defaults to 10)
const config = deriveTableConfig(meta);
// → { columns: [{ key: 'name', ... }, { key: 'price', ... }, { key: 'status', ... }], pagination: { pageSize: 10 } }

// config is freely re-editable from here — reorder config.columns, toggle
// column.visible, set column.pin, etc. It no longer tracks `meta`.

const rows = [
  { name: 'Widget', price: 9.99, status: 'active' },
  { name: 'Gadget', price: 19.5, status: 'inactive' },
];

// 2. Client-side sort (stable; nulls sink to the bottom regardless of direction)
const sorted = sortRows(rows, { key: 'price', direction: 'desc' }, config.columns);

// 3. Format each cell for display (options lookup wins over `format`; locale-aware Intl formatting)
const cell = formatCell(sorted[0].price, config.columns[1], 'en');
// → '$19.50'
const statusCell = formatCell(sorted[0].status, config.columns[2], 'en');
// → 'Inactive'

// 4. Page math for a server-paginated resource
const totalPages = pageCount(87, config.pagination.pageSize); // → 9
const offset = pageToOffset(3, config.pagination.pageSize); // → 20 (page 3, 1-indexed, pageSize 10)
```

## Validate a `TableConfig`

Configs that come from storage or user input (e.g. a saved table layout) should be parsed
rather than trusted:

```ts
import { parseTableConfig } from '@rfjs/table-builder';

const config = parseTableConfig(rawJson); // throws ZodError on shape/format mismatch
```

Same `format` ↔ `dataType` cross-check as `@rfjs/data-schema`'s `dataFieldMetaSchema`
(e.g. `'percent'` only valid on `dataType: 'numeric'`).

## API

### Compile / sort / format / paginate

| Export | Signature | Notes |
| --- | --- | --- |
| `deriveTableConfig(meta)` | `(DataResourceMeta) => TableConfig` | one-way compile: maps `fields` → `columns` (drops `filterable`), defaults `pagination.pageSize` to `10`; deep-copies `label`/`options` so the result never aliases `meta` |
| `sortRows(rows, sort, columns)` | `(Record<string, unknown>[], SortState, TableColumnConfig[]) => Record<string, unknown>[]` | client-side stable sort; comparator chosen from the matching column's `dataType`; nullish values always sink to the bottom; does not mutate the input |
| `formatCell(value, column, locale?)` | `(unknown, TableColumnConfig, string) => string` | `null`/`undefined` → `''`; `column.options` value→label lookup wins over `format`; then `Intl`-based numeric/date formatting per `column.format`; otherwise `String(value)`; `locale` defaults to `'en'` |
| `pageCount(total, pageSize)` | `(number, number) => number` | total pages, always at least `1` |
| `pageToOffset(page, pageSize, firstPage?)` | `(number, number, 0 \| 1) => number` | page number → 0-indexed row offset; `firstPage` defaults to `1` |
| `offsetToPage(offset, pageSize, firstPage?)` | `(number, number, 0 \| 1) => number` | inverse of `pageToOffset` |
| `hasNextCursor(cursor)` | `(string \| undefined) => boolean` | `true` iff `cursor` is defined and non-empty |

### Validation (zod)

| Export | Validates |
| --- | --- |
| `parseTableConfig(input)` | `TableConfig`; throws on invalid shape |
| `tableConfigSchema` | the full config (`columns` (min 1) + `pagination` + optional `defaultSort`/`emptyText`) |
| `tableColumnConfigSchema` | one column; cross-checks `format` against `dataType` |
| `tablePaginationConfigSchema`, `tableDefaultSortSchema` | pagination / default-sort sub-shapes |

### Re-exported from `@rfjs/data-schema`

`resolveLabel`, `getByPath`, and the types `ScalarType`, `LocalizedLabel`, `FieldFormat`,
`FieldOption`, `DataResourceMeta`, `DataFieldMeta`, `SortState` — so consumers of
`table-builder` don't need a direct `@rfjs/data-schema` dependency for these.

### `TableConfig` / `TableColumnConfig`

```ts
interface TableColumnConfig {
  key: string;
  label: LocalizedLabel;
  dataType: ScalarType;
  format?: FieldFormat;
  options?: FieldOption[];
  sortable?: boolean; // default false
  visible?: boolean; // default true — editor show/hide toggle
  pin?: 'left' | 'right';
  align?: 'left' | 'center' | 'right'; // unset -> renderer defaults by dataType (numeric -> right, else left)
}

interface TableConfig {
  columns: TableColumnConfig[]; // array order = column order (drag reorder edits this)
  pagination: { pageSize: number; pageSizeOptions?: number[] };
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  emptyText?: LocalizedLabel; // optional, UI has an English default
}
```

`TableConfig`/`TableColumnConfig` are **frozen names**: [@rfjs/form-builder](../form-builder)
result items will embed `{ mode: 'table', table: TableConfig }`, so these types are a shared
contract, not an implementation detail of this package.

## Family relationship

```
 @rfjs/data-schema
 field/request/response metadata contract
              ▼
 @rfjs/table-builder                 ← you are here
 deriveTableConfig(meta) → TableConfig, plus
 sortRows / formatCell / paginate pure functions
              ▼
 @rfjs/table-builder-ui              @rfjs/form-builder (result item)
 React renderer for TableConfig      mode: 'table' embeds a TableConfig
```

This package is the **logic layer**: it has no React and no rendering. If you need an
actual `<table>` on the page, install `@rfjs/table-builder-ui` and hand it the `TableConfig`
this package produces — don't re-implement rendering on top of the raw config.

## License

ISC
