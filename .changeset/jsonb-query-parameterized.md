---
"@rfjs/jsonb-query": minor
---

feat(jsonb-query)!: parameterized query builder with legacy/jsonpath dialects

Replaces the string-interpolated SQL builder with `buildJsonbQuery`, which emits
parameterized SQL (node-postgres `$1,$2`) and supports both a `legacy` (`#>>`)
and a `jsonpath` (`jsonb_path_exists`) dialect. Scalar data types
(string/numeric/date/boolean) are supported in this release; object/array
support will follow. The previous string-returning API (`toJsonbQuery`,
`genJsonbQuery`, `JsonbOperatorQuery`, …) is removed.
