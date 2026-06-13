---
'@rfjs/jsonb-query': minor
---

Complete elemmatch nesting, typed errors, array `neq`, and empty-group identity.

**Added**
- Object and scalar-array conditions are now supported inside `elemmatch`. In the
  `jsonpath` dialect, non-path-expressible leaves (object conditions,
  scalar-array `containsall`) fall back to a SQL `EXISTS` sub-select for that
  fragment.
- `neq` is now valid on scalar array elements: "value not present" (∀), the
  negation of `eq`. Missing / non-array fields count as not-present.
- `JsonbQueryError` (with a stable `code`) is thrown for all caller-input errors
  and is exported from the package entry point.

**Changed**
- Empty filter groups now render their boolean identity (`and`/`nor` → `true`,
  `or`/`not` → `false`) instead of an empty string. Previously an empty inner
  group was silently dropped; it now contributes its identity, which can change
  results for filters that relied on the old drop behavior.
