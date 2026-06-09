---
"@rfjs/data-filter": minor
---

Harden the matcher: correctness fixes, faster path resolution, stricter validation, and safer public types.

**Behavior changes (review before upgrading):**

- **`neq` on array / wildcard fields now uses "value-absent" semantics** — it matches only when the value is **not present** among the resolved elements. Previously `neq` on a multi-element field could match a row that *did* contain the value. Single-value fields are unaffected.
- **`range` now throws** when not given exactly two values (previously a single value silently matched nothing and extra values were ignored).
- **An unsupported operator now throws** (e.g. `range` on a `boolean` field, or a typo) instead of silently returning "no match". This also closes a prototype-pollution footgun (`toString`/`constructor` as operator names).
- **Boolean coercion fixed** — the strings `'false'`, `'0'`, `'no'`, `'off'`, `''` now coerce to `false` (previously `Boolean('false')` made them `true`).
- **Date and numeric `neq` reject unparseable (NaN) values** — a garbage/typo filter value no longer silently passes; `Date` `eq`/`terms` no longer treat two unparseable dates as equal.

**Improvements:**

- `resolvePath` skips the JSONPath engine for plain (non-wildcard) paths — roughly 5× faster on the common hot path, behavior preserved.
- `matchAndMap` defers the per-row deep clone until a row matches, drops a redundant double-clone of the filter/mappings, and de-duplicates by the source row (a row matched by several metadata is emitted once, last mapping wins).
- `aliasValue` builds its lookup table once per `aliasData` call instead of per aliased leaf; new `buildAliasLookup` export.

**Types:**

- `ObjectData` widened to accept nested objects and arrays of objects (the flagship `users[*].name` wildcard case now type-checks).
- `MatchQueryMetadata` is now a discriminated union (`StringCondition | NumericCondition | DateCondition | BooleanCondition`), so an operator that is invalid for its `dataType` is a compile error. Shaped so future object/array/elemmatch variants can be added without breaking existing ones.
