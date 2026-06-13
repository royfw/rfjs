# @rfjs/data-label

## 0.1.1

### Patch Changes

- a72251f: chore(packages): add npm metadata for the public repo

  - Add `repository` (with per-package `directory`), `bugs`, and `homepage` fields so npm package pages link back to the now-public GitHub repo
  - Fill in `keywords` for npm search discoverability
  - Fix pg-toolkit README titles to the published `@rfjs/pg-toolkit` scope

- Updated dependencies [a72251f]
  - @rfjs/object-utils@0.2.1

## 0.1.0

### Minor Changes

- 2fa846f: Initial release. Compose display label strings from data paths with optional value translation and a safe `${path}` template (plus a `render` hook for custom engines). Depends on `@rfjs/object-utils` for path resolution.

### Patch Changes

- Updated dependencies [0985dc4]
  - @rfjs/object-utils@0.2.0
