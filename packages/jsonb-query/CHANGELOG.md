# @rfjs/jsonb-query

## 0.2.0

### Minor Changes

- 8342ba9: Add three operator families.

  **Added**

  - Key-existence object operators `haskey` / `hasanykey` / `hasallkeys` (jsonb
    `?` / `?|` / `?&`), distinct from `isnull`/`isnotnull` (which test the value).
  - Case-insensitive text operators `icontains` / `istartswith` / `iendswith` /
    `ieq` / `ineq` for `string` conditions.
  - Array emptiness operators `isempty` / `isnotempty` for scalar-element arrays.
  - README "Indexing" section mapping operators to GIN / expression indexes.

- 1aa3795: Add an ORDER BY builder.

  **Added**

  - `buildJsonbOrderBy(column, sorts, options?)` — parameterized, dialect-
    independent `ORDER BY` fragment from sort metadata (per-column `direction`
    default `asc`, optional `nulls` first/last, `paramOffset` to compose after a
    WHERE).
  - `buildNamedJsonbOrderBy(...)` — `:pN` variant for named-binding query layers.
  - `INVALID_SORT` error code for invalid sort `dataType` / `direction` / `nulls`.

- 232870b: Complete elemmatch nesting, typed errors, array `neq`, and empty-group identity.

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

### Patch Changes

- a72251f: chore(packages): add npm metadata for the public repo

  - Add `repository` (with per-package `directory`), `bugs`, and `homepage` fields so npm package pages link back to the now-public GitHub repo
  - Fill in `keywords` for npm search discoverability
  - Fix pg-toolkit README titles to the published `@rfjs/pg-toolkit` scope

## 0.1.0

### Minor Changes

- 646d163: feat(jsonb-query): first public release — parameterized PostgreSQL JSONB query builder

  - Dual dialects from one filter-metadata tree: `legacy` (`#>>` + casts, PostgreSQL 9.4+) and `jsonpath` (`jsonb_path_exists`, PostgreSQL 12+; date comparisons via `jsonb_path_exists_tz`, 13+)
  - Scalar conditions (string/numeric/date/boolean) plus nested objects (`eq`/`neq`/`contains`), scalar arrays (∃-semantics element operators, `containsall`) and arrays of objects (`elemmatch` with nested groups)
  - `and`/`or`/`nor`/`not` group logic aligned with @rfjs/data-filter
  - Fully parameterized output (`$1, $2` + values); `buildNamedJsonbQuery`/`toNamedParams` for named-binding query layers (TypeORM QueryBuilder, Knex)
  - Verified by 124 unit tests and a docker E2E matrix against PostgreSQL 11.16 and 16

- 70701ca: feat(jsonb-query)!: parameterized query builder with legacy/jsonpath dialects

  Replaces the string-interpolated SQL builder with `buildJsonbQuery`, which emits
  parameterized SQL (node-postgres `$1,$2`) and supports both a `legacy` (`#>>`)
  and a `jsonpath` (`jsonb_path_exists`) dialect. Scalar data types
  (string/numeric/date/boolean) are supported in this release; object/array
  support will follow. The previous string-returning API (`toJsonbQuery`,
  `genJsonbQuery`, `JsonbOperatorQuery`, …) is removed.
