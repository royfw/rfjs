---
"@rfjs/sql-filter": minor
"@rfjs/pg-filter": minor
---

Reject a non-scalar value on a single-value column operator instead of coercing it.

The column leaf renderer used to pass any value through `String(...)`, so a hand-built
`FilterGroup` (one that bypasses `@rfjs/filter-builder`) with `value: ['a', 'b']` on a
scalar operator compiled to `LIKE '%a,b%'` — valid SQL that runs, matches nothing, and
signals nothing.

`renderColumnCondition` now throws `ColumnQueryError` with the new `NON_SCALAR_VALUE`
code when an operator of arity `one` (`eq`, `neq`, `contains`, `startswith`, `endswith`,
`icontains`, `istartswith`, `iendswith`, `ieq`, `ineq`, `gt`, `gte`, `lt`, `lte`)
receives anything other than a `string`, `number`, `boolean`, `bigint`, `Date` or `null`.
The list-taking operators are unaffected: `terms` still takes a non-empty array, `range`
a `[lo, hi]` pair, and `isnull`/`isnotnull` still take no value at all.

**Behavior change:** input that previously compiled to a silently-wrong query now throws
at build time. `@rfjs/pg-filter` inherits the guard for its `target: 'column'` leaves —
it has no separate check of its own — and `NON_SCALAR_VALUE` is a new member of the
`ColumnQueryErrorCode` union.

Closes #288.
