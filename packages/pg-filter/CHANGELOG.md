# @rfjs/pg-filter

## 0.1.0

### Minor Changes

- 78451a2: buildPgFilter now accepts an optional `paramOffset` so its `$N` placeholders can start after an app-owned WHERE fragment (RLS, multi-tenancy, visibility pushdown).

## 0.0.1

### Patch Changes

- f2c1372: Column-target leaves transitively gain the new sql-filter operators
  (endswith/terms/range/iX); no API change.
- Updated dependencies [f2c1372]
  - @rfjs/sql-filter@0.1.0
