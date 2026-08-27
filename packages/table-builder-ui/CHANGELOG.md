# @rfjs/table-builder-ui

## 0.1.1

### Patch Changes

- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
  - @rfjs/filter-builder@0.2.0
  - @rfjs/pg-filter@0.1.0
  - @rfjs/filter-builder-ui@0.0.2

## 0.1.0

### Minor Changes

- 9bf3b3d: Add `makeHttpFetcher(request)` — a RequestMeta-driven HTTP transport for a remote `TableSource.fetch` (GET querystring / POST body serialization, filter under the configured param).
- 696edef: `<ConfigTable>` gains a built-in, collapsible runtime filter (reuses `@rfjs/filter-builder-ui`'s `FilterTreeEditor` over the columns marked `filterable`); static-rows sources are filtered in-memory via `runLiveMatch`. New helpers `columnsToFilterSchema`, `DEFAULT_FILTER_TREE_LABELS`, and filter-related `TableLabels` keys.
- 48e6e74: New package: shared config-driven data table (React) over `@rfjs/table-builder`. `useConfigTable(config, source)` drives both a static (`rows`) source (in-memory `sortRows` + slice pagination) and a remote source (injected `fetch`, offset/page/cursor pagination, server-sort refetch, error/retry, race-guarded). `<ConfigTable>` renders it with sortable headers, column pinning, per-strategy pagination controls, and empty/loading/error states. Labels are optional (`TableLabels`) with English `DEFAULT_LABELS`.
- 39695f4: remote sources gain filtering: `TableSource.fields`, `fieldsToFilterSchema`, apply-triggered refetch carrying the compiled pg-filter group, and controlled filter-tree props on `ConfigTable`

### Patch Changes

- 1036caf: Move `makeHttpFetcher` into `@rfjs/data-schema` — the RequestMeta-driven HTTP transport is pure fetch logic and belongs to the engine. `@rfjs/table-builder-ui` re-exports it, so its public API is unchanged.
- Updated dependencies [246901f]
- Updated dependencies [f3fc709]
- Updated dependencies [3b4cc8f]
- Updated dependencies [f2c1372]
- Updated dependencies [d246663]
- Updated dependencies [1036caf]
- Updated dependencies [f2c1372]
- Updated dependencies [1aa5a4c]
- Updated dependencies [9855008]
- Updated dependencies [e8ff5da]
- Updated dependencies [11a5caa]
- Updated dependencies [6ee5368]
- Updated dependencies [54b3b32]
  - @rfjs/data-schema@0.1.0
  - @rfjs/filter-builder@0.1.0
  - @rfjs/web-ui@0.1.0
  - @rfjs/pg-filter@0.0.1
  - @rfjs/table-builder@0.1.0
  - @rfjs/filter-builder-ui@0.0.1
