---
"@rfjs/table-builder-ui": minor
---

New package: shared config-driven data table (React) over `@rfjs/table-builder`. `useConfigTable(config, source)` drives both a static (`rows`) source (in-memory `sortRows` + slice pagination) and a remote source (injected `fetch`, offset/page/cursor pagination, server-sort refetch, error/retry, race-guarded). `<ConfigTable>` renders it with sortable headers, column pinning, per-strategy pagination controls, and empty/loading/error states. Labels are optional (`TableLabels`) with English `DEFAULT_LABELS`.
