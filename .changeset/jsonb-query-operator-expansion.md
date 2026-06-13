---
'@rfjs/jsonb-query': minor
---

Add three operator families.

**Added**
- Key-existence object operators `haskey` / `hasanykey` / `hasallkeys` (jsonb
  `?` / `?|` / `?&`), distinct from `isnull`/`isnotnull` (which test the value).
- Case-insensitive text operators `icontains` / `istartswith` / `iendswith` /
  `ieq` / `ineq` for `string` conditions.
- Array emptiness operators `isempty` / `isnotempty` for scalar-element arrays.
- README "Indexing" section mapping operators to GIN / expression indexes.
