---
"@rfjs/mongo-query": patch
---

fix(mongo-query): make regex work, block operator injection, clearer errors

- The `regex` condition produced a plain string (the typed `MgoDataType`
  pipeline can never yield a `RegExp`), so MongoDB treated it as an exact match.
  `toQuery` now coerces string patterns to a real `RegExp` and passes existing
  `RegExp` values through.
- A `field` whose name starts with `$` was used directly as a query key,
  allowing a top-level MongoDB operator to be injected. Such field names are now
  rejected.
- An unknown `condition` previously failed with a cryptic
  "... is not a function"; it now throws `Unknown condition: "..."`.
- Removed `any` from the public `ValueType`, which surfaced a latent bug:
  `EqQuery`'s index signature was typed as the bare value instead of
  `{ $eq: ValueType }`. Both are fixed.
- Added a test suite for `toQuery` (previously untested).
