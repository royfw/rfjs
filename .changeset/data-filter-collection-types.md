---
"@rfjs/data-filter": minor
---

Add `object`, `array` (scalar element types), and `elemmatch` (arrays of objects) dataTypes to the matcher (purely additive; existing scalar matching is unchanged).

- `object`: `eq`/`neq` (deep-equal), `contains` (recursive `@>`-style containment), `isnull`/`isnotnull`.
- `array` + `elementType: string|numeric|date|boolean`: element operators with ∃ ("some element matches") semantics, plus `containsall` (string/numeric/date) and `isnull`/`isnotnull`. `neq` is excluded — use `not` + `eq` for "does not contain".
- `array` + `elementType: 'object'` + `elemmatch`: the same element must satisfy nested sub-conditions; supports nested groups, nested elemmatch, and nested array/object sub-conditions.

A wildcard `field` (`users[*].x`) on these dataTypes throws — compose with `elemmatch` instead. Vocabulary is aligned with `@rfjs/jsonb-query`; semantics are in-memory-natural (not result-for-result identical).
