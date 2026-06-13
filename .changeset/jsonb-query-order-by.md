---
'@rfjs/jsonb-query': minor
---

Add an ORDER BY builder.

**Added**
- `buildJsonbOrderBy(column, sorts, options?)` — parameterized, dialect-
  independent `ORDER BY` fragment from sort metadata (per-column `direction`
  default `asc`, optional `nulls` first/last, `paramOffset` to compose after a
  WHERE).
- `buildNamedJsonbOrderBy(...)` — `:pN` variant for named-binding query layers.
- `INVALID_SORT` error code for invalid sort `dataType` / `direction` / `nulls`.
