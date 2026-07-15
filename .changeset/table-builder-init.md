---
"@rfjs/table-builder": minor
---

New package: config-driven read-only data table engine over @rfjs/data-schema — `TableConfig`/`TableColumnConfig` types + zod schema, `deriveTableConfig` to compile a `DataResourceMeta` into an editable table config, plus the pure functions that drive rendering: `sortRows` (dataType-aware, nullish-last, stable), `formatCell` (Intl number/date + options lookup), and pagination math (`pageCount`/`pageToOffset`/`offsetToPage`/`hasNextCursor`).
