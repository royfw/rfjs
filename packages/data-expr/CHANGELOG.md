# @rfjs/data-expr

## 0.1.1

### Patch Changes

- a72251f: chore(packages): add npm metadata for the public repo

  - Add `repository` (with per-package `directory`), `bugs`, and `homepage` fields so npm package pages link back to the now-public GitHub repo
  - Fill in `keywords` for npm search discoverability
  - Fix pg-toolkit README titles to the published `@rfjs/pg-toolkit` scope

## 0.1.0

### Minor Changes

- d3b9dcb: Initial release. Safe JSON expression engine wrapping JSONata (no JS eval): `compile`/`evaluate` with compile-once reuse, timeout/depth DoS guards on by default, `strict`/`onUndefined` undefined-result handling, `isExpression`/`stripExpressionPrefix` slot helpers, and typed `DataExprError`s.
