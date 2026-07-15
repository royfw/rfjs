# @rfjs/table-builder

## 0.1.0

### Minor Changes

- 1aa5a4c: `TableColumnConfig` gains an optional `filterable` flag (carried through by `deriveTableConfig` from `DataFieldMeta.filterable`) so a column can be marked as available to a table's runtime filter.
- 9855008: New package: config-driven read-only data table engine over @rfjs/data-schema — `TableConfig`/`TableColumnConfig` types + zod schema, `deriveTableConfig` to compile a `DataResourceMeta` into an editable table config, plus the pure functions that drive rendering: `sortRows` (dataType-aware, nullish-last, stable), `formatCell` (Intl number/date + options lookup), and pagination math (`pageCount`/`pageToOffset`/`offsetToPage`/`hasNextCursor`).
- e8ff5da: add `tableConfigToResourceMeta(config, request?, response?)` — reverse projection from a TableConfig back to a DataResourceMeta (display-only column keys dropped), so the inferred/edited data description becomes a referenceable artifact

### Patch Changes

- Updated dependencies [246901f]
- Updated dependencies [f3fc709]
- Updated dependencies [1036caf]
  - @rfjs/data-schema@0.1.0
