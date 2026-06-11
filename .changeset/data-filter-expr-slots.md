---
"@rfjs/data-filter": minor
---

Computed `=` expression slots + jsonpath removal (breaking — pre-1.0 minor).

**New:** a condition `field`/`value` or a `matchAndMap` mapping `value` starting with `=` is a
computed JSONata expression (via `@rfjs/data-expr`; no eval, DoS guards default-on). New async
APIs: `compileMatchQuery` (compile-once predicate), `matchQueryAsync`, `matchAndMapAsync`.
Sync APIs throw on `=`-slots.

**Breaking:** the jsonpath engine is removed. Wildcard/jsonpath `field` forms (`users[*].x`,
`$..x`, `[?(...)]`, slices, unions, `$.` roots) now **throw** — use `dataType: 'array'`/
`elemmatch`, or an `=` expression. `resolvePathDetail` and the `fallbackToLodash` option are
removed; `jsonpath-plus` is no longer a dependency.
