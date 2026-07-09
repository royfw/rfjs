# @rfjs/data-schema

> 繁體中文 → [README.zh-TW.md](./README.zh-TW.md)

The **data resource metadata contract**: a small, zod-validated shape that describes a
tabular data resource — its **fields** (key/label/dataType/format/options/sortable), how to
**request** a page of it (pagination strategy + sort encoding), and how to **read** a page
back out of a response envelope (rows/total/cursor paths). It has no UI and no fetch call of
its own — it's the shared vocabulary that [@rfjs/table-builder](../table-builder) and its
consumers compile against.

---

## Install

```bash
npm i @rfjs/data-schema
```

## Quick start

```ts
import {
  inferFieldsFromRows,
  buildRequestParams,
  extractRows,
  extractTotal,
  extractCursor,
  type DataResourceMeta,
} from '@rfjs/data-schema';

// 1. Define (or infer) field metadata from sample rows
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

// 2. Build request params for a given page + sort state
const built = buildRequestParams(meta.request!, {
  pageSize: 20,
  page: 1,
  sort: { key: 'price', direction: 'desc' },
});
// → { endpoint: '/api/products', method: 'GET', params: { page: '1', pageSize: '20', sortBy: 'price', order: 'desc' } }

const res = await fetch(`${built.endpoint}?${new URLSearchParams(built.params)}`, { method: built.method });
const payload = await res.json();
// payload = { data: { items: [{ id: 1, name: 'Widget', ... }], total: 87 } }

// 3. Read the page back out of the response envelope
const rows = extractRows(payload, meta.response!); // → payload.data.items
const total = extractTotal(payload, meta.response!); // → 87
const cursor = extractCursor(payload, meta.response!); // → undefined (no cursorPath configured)
```

`inferFieldsFromRows` only reads plain-object rows: nested objects are walked (dot paths,
e.g. `'author.name'`), arrays and `null`/`undefined` leaves are skipped, and a key whose
inferred type disagrees across rows falls back to `'string'`.

## Validate untrusted metadata

Metadata that comes from a config file, a database, or user input should be parsed through
the zod schema rather than trusted as `DataResourceMeta`:

```ts
import { parseDataResourceMeta } from '@rfjs/data-schema';

const meta = parseDataResourceMeta(rawJson); // throws ZodError on shape/format mismatch
```

`format` is cross-checked against `dataType` (e.g. `'currency'` is only valid on
`dataType: 'numeric'`, `'datetime'` only on `dataType: 'date'`) via `superRefine`, so an
inconsistent combination fails validation instead of silently rendering wrong.

## API

### Infer / build / extract

| Export | Signature | Notes |
| --- | --- | --- |
| `inferFieldsFromRows(rows)` | `(unknown) => DataFieldMeta[]` | infers `dataType` per key from sample rows; throws if `rows` isn't an array of plain objects |
| `buildRequestParams(request, state)` | `(RequestMeta, PageState) => BuiltRequest` | encodes pagination (`offset`/`page`/`cursor`) + optional sort into query params |
| `extractRows(payload, response)` | `(unknown, ResponseMeta) => unknown[]` | throws if the value at `rowsPath` isn't an array |
| `extractTotal(payload, response)` | `(unknown, ResponseMeta) => number \| undefined` | `undefined` when `totalPath` is unset or resolves to a non-number |
| `extractCursor(payload, response)` | `(unknown, ResponseMeta) => string \| undefined` | `undefined` when `cursorPath` is unset or resolves to a non-string |
| `getByPath(obj, path)` | `(unknown, string) => unknown` | dot-path getter; `''` returns `obj` itself |
| `resolveLabel(label, locale, fallbackLocale?)` | `(LocalizedLabel, string, string?) => string` | string passthrough, or locale-map lookup with fallback / first-value fallback |

### Validation (zod)

| Export | Validates |
| --- | --- |
| `parseDataResourceMeta(input)` | `DataResourceMeta`; throws on invalid shape |
| `dataResourceMetaSchema` | the full contract (`fields` + optional `request`/`response`) |
| `dataFieldMetaSchema` | one field; cross-checks `format` against `dataType` |
| `paginationMetaSchema` | discriminated union on `strategy` |
| `sortMetaSchema` | discriminated union on `style` |
| `requestMetaSchema`, `responseMetaSchema` | request/response metadata |
| `fieldOptionSchema`, `fieldFormatSchema`, `localizedLabelSchema` | leaf schemas |

### Core types

| Type | Shape |
| --- | --- |
| `DataFieldMeta` | `{ key, label, dataType, format?, options?, sortable?, filterable? }` |
| `PaginationMeta` | `{ strategy: 'offset', limitParam, offsetParam }` &#124; `{ strategy: 'page', pageParam, pageSizeParam, firstPage? }` &#124; `{ strategy: 'cursor', cursorParam, limitParam }` |
| `SortMeta` | `{ style: 'single', param, encoding: 'colon' \| 'signed' }` &#124; `{ style: 'split', fieldParam, dirParam }` |
| `RequestMeta` | `{ endpoint, method?, pagination, sort? }` |
| `ResponseMeta` | `{ rowsPath, totalPath?, cursorPath? }` |
| `DataResourceMeta` | `{ fields, request?, response? }` |
| `SortState` | `{ key, direction: 'asc' \| 'desc' }` — consumer-facing sort state |
| `PageState` | `{ pageSize, offset?, page?, cursor?, sort? }` — consumer-facing page state |
| `BuiltRequest` | `{ endpoint, method, params }` — the result of `buildRequestParams` |
| `ScalarType` | `'string' \| 'numeric' \| 'date' \| 'boolean'` |
| `FieldFormat` | `'integer' \| 'decimal' \| 'percent' \| 'currency'` (numeric only) &#124; `'date' \| 'datetime' \| 'time'` (date only) |
| `LocalizedLabel` | `string \| Record<string, string>` |

## Family relationship

```
 @rfjs/data-schema           ← you are here
 field/request/response metadata contract + infer/build/extract helpers
              ▼
 @rfjs/table-builder
 deriveTableConfig(meta) compiles DataResourceMeta → TableConfig, plus
 sortRows / formatCell / paginate pure functions
              ▼
 @rfjs/table-builder-ui              @rfjs/form-builder (result item)
 React renderer for TableConfig      mode: 'table' embeds a TableConfig
```

`data-schema` is the base contract: it doesn't know about React, tables, or forms. Anything
downstream that needs to talk about "a page of rows from a resource with these fields"
builds on this package instead of inventing its own shape.

## License

ISC
