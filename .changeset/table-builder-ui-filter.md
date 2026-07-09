---
"@rfjs/table-builder-ui": minor
---

`<ConfigTable>` gains a built-in, collapsible runtime filter (reuses `@rfjs/filter-builder-ui`'s `FilterTreeEditor` over the columns marked `filterable`); static-rows sources are filtered in-memory via `runLiveMatch`. New helpers `columnsToFilterSchema`, `DEFAULT_FILTER_TREE_LABELS`, and filter-related `TableLabels` keys.
