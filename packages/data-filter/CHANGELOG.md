# @rfjs/data-filter

## 0.1.0

### Minor Changes

- 9fabeb3: chore(packages): cleanup template boilerplate, refactor names, add DateFilterOperator

  - Remove template docs boilerplate from 6 packages
  - Clean redundant per-package config (husky, commitlint, pnpm-lock, pnpm-workspace, tpl-toolkit)
  - Remove per-package .github, .husky, .gitignore (redundant in monorepo)
  - Fix eslint.config.mjs ignores to exclude spec files across 7 packages
  - Fix object-utils eslint errors (flatten, keysToNested, toFlatString)
  - Add missing vitest imports to 8 spec files
  - Shorten function/class names: matchQuery, matchAndMap, resolvePath, TextMatch, NumericMatch, BooleanMatch, createMatchQuery, jsonbTransfer, genJsonbQuery, toJsonbQueryList
  - Add DateFilterOperator support to data-filter with DateMatch class (eq, neq, isnull, isnotnull, gt, gte, lt, lte, range, terms)

- e3aac79: feat: add @rfjs/\* packages — object-utils, data-transform, data-filter, jsonb-query, mongo-query, jwt, retry

  - @rfjs/object-utils: flatten, keysToNested, toJSONString, toFlatString
  - @rfjs/data-transform: typeTransfer, jsonbTypeTransfer, toBoolean, toDateString
  - @rfjs/data-filter: filter match query with JSONPath, alias substitution, filter mapping
  - @rfjs/jsonb-query: PostgreSQL JSONB SQL query builder
  - @rfjs/mongo-query: MongoDB query builder from filter metadata
  - @rfjs/jwt: JWT sign/verify/decode helper
  - @rfjs/retry: retry helper with configurable delay and max attempts

### Patch Changes

- a9f69ec: fix(data-filter): literal prefix/suffix matching and no input mutation

  - `startswith` / `endswith` built a `RegExp` from the raw filter value, so values
    containing regex metacharacters matched incorrectly and an invalid pattern
    (e.g. `(`) threw `SyntaxError`. They now compare literally with
    `String.prototype.startsWith` / `endsWith`.
  - `matchAndMap` wrote mapping results onto the caller's original objects via the
    shared `data[dataKey]` reference; it now operates on the deep clone so input
    is never mutated.
  - `aliasData` mutated and returned its input object; it now resolves placeholders
    on a clone and returns a new object.
  - Fixed the README alias placeholder syntax (`${field.path}` / `$field.path`,
    not `{{field.path}}`).

- 030e3e7: fix(data-filter): repair ESM build crash from lodash namespace import

  `lodash` is CommonJS and stays external in the ESM bundle. The source used
  `import * as _ from 'lodash'`, which resolves every lodash method to
  `undefined` under Node's ESM/CJS interop — so the published `dist/index.mjs`
  threw `TypeError: _.get is not a function` on the first lodash-backed call
  (e.g. `resolvePath` with a comma path, `matchAndMap`'s `cloneDeep`). The unit
  tests did not catch it because they run against the TypeScript source, not the
  built artifact.

  - Switch all nine source files to the default import `import _ from 'lodash'`
  - Add an ESLint `no-restricted-syntax` rule banning the lodash namespace import so the regression cannot return

- 48390ce: refactor(data-filter): type Match operator/value params, drop redundant unions

  - The public `TextMatch` / `NumericMatch` / `DateMatch` / `BooleanMatch`
    constructors now take `value: ValueType` instead of `any`.
  - Their `operator` params drop the redundant `| DefaultFilterOperator`
    (already included in each per-type operator union), and
    `MatchQueryMetadata.operator` is expressed as a flat, non-overlapping union —
    clearing the package's `no-redundant-type-constituents` lint errors. The
    resulting types are unchanged.

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

- Updated dependencies [9fabeb3]
- Updated dependencies [e3aac79]
- Updated dependencies [a5ee5d7]
- Updated dependencies [a11796a]
  - @rfjs/object-utils@0.1.0
