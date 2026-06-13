# @rfjs/retry

## 0.1.1

### Patch Changes

- a72251f: chore(packages): add npm metadata for the public repo

  - Add `repository` (with per-package `directory`), `bugs`, and `homepage` fields so npm package pages link back to the now-public GitHub repo
  - Fill in `keywords` for npm search discoverability
  - Fix pg-toolkit README titles to the published `@rfjs/pg-toolkit` scope

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
