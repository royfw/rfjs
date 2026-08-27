# @rfjs/data-filter

## 0.3.0

### Minor Changes

- 78451a2: Put the condition **vocabulary** on the public surface, so a consumer can ask
  "can the engine evaluate this condition?" before evaluating it — against the
  same tables the evaluator dispatches on.

  The gap this closes: a condition can be perfectly well-_shaped_ and still name a
  `dataType` the engine has never heard of. `{ field: 'x', dataType: 'wat',
operator: 'eq', value: 1 }` passes any shape check, and only throws
  `[data-filter] unsupported dataType 'wat'` at evaluation time — which for a
  consumer that validates at authoring time and evaluates later is a 500 at
  runtime instead of a 400 at save time. The operator allowlists existed as real
  `as const` arrays but were not exported; the dataType vocabulary had no runtime
  counterpart at all.

  **New exports**

  - `validateCondition(condition)` / `validateMatchQuery(query)` —
    `{ ok: true } | { ok: false, issues }`, where each issue carries a stable
    `code`, the evaluator's own `message`, and a `path` naming the offending node.
    `validateMatchQuery` walks nested groups and `elemmatch` sub-groups and also
    checks each group's `logic`. A leaf's `field` is checked against the
    evaluator's own path guards (`unsupportedPath`), so a wildcard or `$`-rooted
    path is rejected at authoring time rather than throwing at evaluation; an
    `=` expression field is left to the async api. Vocabulary membership is
    tested against the raw value, never its rendered token — `typeof {}` is
    `'object'`, which would otherwise pass as the legitimate `object` dataType.
  - `supportedOperators(dataType, elementType?)` — what the engine accepts there,
    or `undefined` when the type combination itself is not evaluable.
  - `MATCH_QUERY_DATA_TYPES`, `MATCH_QUERY_ELEMENT_TYPES`, `LOGICAL_OPERATORS`,
    `OPERATORS_BY_DATA_TYPE`, `ELEM_MATCH_OPERATORS`,
    `assertMatchQueryDataType`, and the previously-internal operator module
    (`STRING_OPERATORS`, `NUMERIC_OPERATORS`, `DATE_OPERATORS`,
    `BOOLEAN_OPERATORS`, `OBJECT_OPERATORS`, `*_ARRAY_OPERATORS`,
    `ARRAY_OPERATORS_BY_ELEMENT`, `operatorsForArrayElement`, `assertOperator`).
  - Types `MatchQueryConditionDataType` (= `MatchQueryMetadata['dataType']`),
    `MatchQueryElementType`, `ConditionIssue`, `ConditionIssueCode`,
    `VocabularyResult`.

  **No second copy.** The operator tables _are_ the arrays the matchers pass to
  `assertOperator`, and the dataType/elementType/logic lists are `Object.keys` of
  presence maps typed against `MatchQueryMetadata` / `LogicalOperator` — so a
  dataType added to the union (and therefore to the `never`-exhaustive
  `createMatchQuery` switch) fails to compile until it is listed.
  `createMatchQuery` now gates on `MATCH_QUERY_DATA_TYPES` before dispatching, so
  the exported list is load-bearing rather than descriptive: a dataType in the
  switch but missing from the list stops evaluating.

  **Behaviour**

  - `dataType: 'array'` with an unknown `elementType` now throws
    `[data-filter] unsupported elementType '…' for dataType 'array'` instead of a
    `TypeError` from indexing the operator table blind (only reachable from
    untyped JSON input).
  - Everything else is unchanged; the `unsupported dataType` message is identical.

  Scope is vocabulary only — it does not validate tree _shape_ (that is
  `parseFilterGroup` in `@rfjs/filter-builder`) nor operator/value arity (`range`
  still throws at runtime when not given two values).

- 78451a2: Add the full case-insensitive text operator family for the `string` dataType —
  `icontains`, `istartswith`, `iendswith`, `ieq`, `ineq` (both sides coerced with
  `String(...)` then lower-cased, so a numeric/boolean/date operand never throws),
  matching the vocabulary already exposed by the SQL/JSONB engines so filter trees
  stay portable. The `∃` substring i-ops (`icontains`/`istartswith`/`iendswith`)
  are also allowed on `string`-element arrays (evaluated per-element). Also
  document the `array` membership vocabulary (`terms` = any-membership,
  `containsall` = all-membership, `eq` = single membership, `contains` =
  per-element substring by design) in the README so membership isn't confused with
  substring matching.

## 0.2.1

### Patch Changes

- a72251f: chore(packages): add npm metadata for the public repo

  - Add `repository` (with per-package `directory`), `bugs`, and `homepage` fields so npm package pages link back to the now-public GitHub repo
  - Fill in `keywords` for npm search discoverability
  - Fix pg-toolkit README titles to the published `@rfjs/pg-toolkit` scope

- Updated dependencies [a72251f]
  - @rfjs/data-expr@0.1.1
  - @rfjs/object-utils@0.2.1

## 0.2.0

### Minor Changes

- 87cad34: Add `object`, `array` (scalar element types), and `elemmatch` (arrays of objects) dataTypes to the matcher (purely additive; existing scalar matching is unchanged).

  - `object`: `eq`/`neq` (deep-equal), `contains` (recursive `@>`-style containment), `isnull`/`isnotnull`.
  - `array` + `elementType: string|numeric|date|boolean`: element operators with ∃ ("some element matches") semantics, plus `containsall` (string/numeric/date) and `isnull`/`isnotnull`. `neq` is excluded — use `not` + `eq` for "does not contain".
  - `array` + `elementType: 'object'` + `elemmatch`: the same element must satisfy nested sub-conditions; supports nested groups, nested elemmatch, and nested array/object sub-conditions.

  A wildcard `field` (`users[*].x`) on these dataTypes throws — compose with `elemmatch` instead. Vocabulary is aligned with `@rfjs/jsonb-query`; semantics are in-memory-natural (not result-for-result identical).

- f8bd385: Computed `=` expression slots + jsonpath removal (breaking — pre-1.0 minor).

  **New:** a condition `field`/`value` or a `matchAndMap` mapping `value` starting with `=` is a
  computed JSONata expression (via `@rfjs/data-expr`; no eval, DoS guards default-on). New async
  APIs: `compileMatchQuery` (compile-once predicate), `matchQueryAsync`, `matchAndMapAsync`.
  Sync APIs throw on `=`-slots.

  **Breaking:** the jsonpath engine is removed. Wildcard/jsonpath `field` forms (`users[*].x`,
  `$..x`, `[?(...)]`, slices, unions, `$.` roots) now **throw** — use `dataType: 'array'`/
  `elemmatch`, or an `=` expression. `resolvePathDetail` and the `fallbackToLodash` option are
  removed; `jsonpath-plus` is no longer a dependency.

- b5154c5: Harden the matcher: correctness fixes, faster path resolution, stricter validation, and safer public types.

  **Behavior changes (review before upgrading):**

  - **`neq` on array / wildcard fields now uses "value-absent" semantics** — it matches only when the value is **not present** among the resolved elements. Previously `neq` on a multi-element field could match a row that _did_ contain the value. Single-value fields are unaffected.
  - **`range` now throws** when not given exactly two values (previously a single value silently matched nothing and extra values were ignored).
  - **An unsupported operator now throws** (e.g. `range` on a `boolean` field, or a typo) instead of silently returning "no match". This also closes a prototype-pollution footgun (`toString`/`constructor` as operator names).
  - **Boolean coercion fixed** — the strings `'false'`, `'0'`, `'no'`, `'off'`, `''` now coerce to `false` (previously `Boolean('false')` made them `true`).
  - **Date and numeric `neq` reject unparseable (NaN) values** — a garbage/typo filter value no longer silently passes; `Date` `eq`/`terms` no longer treat two unparseable dates as equal.

  **Improvements:**

  - `resolvePath` skips the JSONPath engine for plain (non-wildcard) paths — roughly 5× faster on the common hot path, behavior preserved.
  - `matchAndMap` defers the per-row deep clone until a row matches, drops a redundant double-clone of the filter/mappings, and de-duplicates by the source row (a row matched by several metadata is emitted once, last mapping wins).
  - `aliasValue` builds its lookup table once per `aliasData` call instead of per aliased leaf; new `buildAliasLookup` export.

  **Types:**

  - `ObjectData` widened to accept nested objects and arrays of objects (the flagship `users[*].name` wildcard case now type-checks).
  - `MatchQueryMetadata` is now a discriminated union (`StringCondition | NumericCondition | DateCondition | BooleanCondition`), so an operator that is invalid for its `dataType` is a compile error. Shaped so future object/array/elemmatch variants can be added without breaking existing ones.

### Patch Changes

- Updated dependencies [d3b9dcb]
- Updated dependencies [0985dc4]
  - @rfjs/data-expr@0.1.0
  - @rfjs/object-utils@0.2.0

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
