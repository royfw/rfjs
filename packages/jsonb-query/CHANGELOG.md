# @rfjs/jsonb-query

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
