# @rfjs/mongo-query

## 0.1.1

### Patch Changes

- a72251f: chore(packages): add npm metadata for the public repo

  - Add `repository` (with per-package `directory`), `bugs`, and `homepage` fields so npm package pages link back to the now-public GitHub repo
  - Fill in `keywords` for npm search discoverability
  - Fix pg-toolkit README titles to the published `@rfjs/pg-toolkit` scope

- Updated dependencies [333b1b5]
- Updated dependencies [a72251f]
  - @rfjs/data-transform@0.1.1

## 0.1.0

### Minor Changes

- e3aac79: feat: add @rfjs/\* packages — object-utils, data-transform, data-filter, jsonb-query, mongo-query, jwt, retry

  - @rfjs/object-utils: flatten, keysToNested, toJSONString, toFlatString
  - @rfjs/data-transform: typeTransfer, jsonbTypeTransfer, toBoolean, toDateString
  - @rfjs/data-filter: filter match query with JSONPath, alias substitution, filter mapping
  - @rfjs/jsonb-query: PostgreSQL JSONB SQL query builder
  - @rfjs/mongo-query: MongoDB query builder from filter metadata
  - @rfjs/jwt: JWT sign/verify/decode helper
  - @rfjs/retry: retry helper with configurable delay and max attempts

### Patch Changes

- 9fabeb3: chore(packages): cleanup template boilerplate, refactor names, add DateFilterOperator

  - Remove template docs boilerplate from 6 packages
  - Clean redundant per-package config (husky, commitlint, pnpm-lock, pnpm-workspace, tpl-toolkit)
  - Remove per-package .github, .husky, .gitignore (redundant in monorepo)
  - Fix eslint.config.mjs ignores to exclude spec files across 7 packages
  - Fix object-utils eslint errors (flatten, keysToNested, toFlatString)
  - Add missing vitest imports to 8 spec files
  - Shorten function/class names: matchQuery, matchAndMap, resolvePath, TextMatch, NumericMatch, BooleanMatch, createMatchQuery, jsonbTransfer, genJsonbQuery, toJsonbQueryList
  - Add DateFilterOperator support to data-filter with DateMatch class (eq, neq, isnull, isnotnull, gt, gte, lt, lte, range, terms)

- 402bafb: fix(mongo-query): make regex work, block operator injection, clearer errors

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

- a5ee5d7: docs(packages): add README.zh-TW.md and improve README.md across packages

  - Add Traditional Chinese README (README.zh-TW.md) for data-filter, data-transform, jsonb-query, jwt, mongo-query, object-utils, retry
  - Create initial README.md and README.zh-TW.md for tpl-toolkit
  - Improve existing README.md content with better formatting and operator tables

- a11796a: chore(packages): unify npm publish config and trim redundant runtime deps

  - Add `exports` map, `publishConfig.access: "public"`, and `sideEffects: false` to all seven packages so scoped packages publish publicly and consumers can tree-shake
  - Include README.md / README.zh-TW.md in the published `files`
  - Drop unused `tslib` runtime dependency (verified absent from built dist; pg-toolkit keeps it as it is still emitted there)
  - data-filter: remove unused `@rfjs/data-transform` dependency
  - data-transform: replace lodash `_.has` with native `Object.prototype.hasOwnProperty`, dropping `lodash` and `@types/lodash`

- 583a968: refactor(types): drop `any` from the public value types

  - `@rfjs/data-transform`: `ValueType` and `JsonbValueType` no longer include
    `any` (which collapsed the whole union), so consumers get the real
    `string | number | boolean | Date | RegExp | null | undefined` surface. This
    was unblocked now that `@rfjs/jsonb-query` no longer imports these types.
  - `@rfjs/mongo-query`: `toQuery` accepts `ValueType | ValueType[]` and threads
    `ValueType[]` through its handlers (no more `Array<any>`); `LogicalQuery`
    nodes are typed `MgoQueryNode` instead of `any`; `MgoFieldCondition.value`
    accepts an array for `terms`/`nin`. This clears the package's outstanding
    `no-unsafe-*` lint errors.

- Updated dependencies [9fabeb3]
- Updated dependencies [f335e5b]
- Updated dependencies [e3aac79]
- Updated dependencies [a5ee5d7]
- Updated dependencies [a11796a]
- Updated dependencies [9a727d3]
- Updated dependencies [583a968]
  - @rfjs/data-transform@0.1.0
