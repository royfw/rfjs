# @rfjs/tpl-toolkit

## 0.0.3

### Patch Changes

- a72251f: chore(packages): add npm metadata for the public repo

  - Add `repository` (with per-package `directory`), `bugs`, and `homepage` fields so npm package pages link back to the now-public GitHub repo
  - Fill in `keywords` for npm search discoverability
  - Fix pg-toolkit README titles to the published `@rfjs/pg-toolkit` scope

## 0.0.2

### Patch Changes

- a5ee5d7: docs(packages): add README.zh-TW.md and improve README.md across packages

  - Add Traditional Chinese README (README.zh-TW.md) for data-filter, data-transform, jsonb-query, jwt, mongo-query, object-utils, retry
  - Create initial README.md and README.zh-TW.md for tpl-toolkit
  - Improve existing README.md content with better formatting and operator tables

- 68c34ac: fix(tpl-toolkit): resolve createVitestConfig @ alias against the consumer cwd

  `createVitestConfig` resolved its `@` alias with `path.resolve(__dirname, './src')`.
  In the published ESM build `__dirname` is undefined, so consuming the factory
  from a template's `vitest.config.mts` threw `ReferenceError: __dirname is not
defined`. Even where `__dirname` was shimmed it pointed at
  `node_modules/@rfjs/tpl-toolkit/...` rather than the template's own `src`.

  - Resolve the `@` alias against `process.cwd()` (the template running Vitest)
  - Add tests covering the alias resolution and override behaviour (the package previously had none)
  - Add an ESLint `no-restricted-globals` rule banning `__dirname`/`__filename` in this ESM package

## 0.0.1

### Patch Changes

- ccb5c4f: fix: remove preinstall/prepare scripts that blocked installation via npm/yarn
- 62ed627: feat: add @rfjs/tpl-toolkit package for shared template utilities

  - createVitestConfig() factory for Vitest configuration
  - defaultLintStagedConfig exports for lint-staged setup
  - Three export paths: ., ./vitest, ./lint-staged

- 3e988a5: feat: add build plugins and tsdown config factory

  - copyFilesPlugin, tsdownDevNodemonPlugin, copyPackageJsonPlugin exports via ./plugins
  - createTsdownConfig() factory via ./tsdown-config for app/lib/bin/orm/bullmq template types

## 0.0.1-alpha.3

### Patch Changes

- 3e988a5: feat: add build plugins and tsdown config factory

  - copyFilesPlugin, tsdownDevNodemonPlugin, copyPackageJsonPlugin exports via ./plugins
  - createTsdownConfig() factory via ./tsdown-config for app/lib/bin/orm/bullmq template types

## 0.0.1-alpha.2

### Patch Changes

- ccb5c4f: fix: remove preinstall/prepare scripts that blocked installation via npm/yarn

## 0.0.1-alpha.1

### Patch Changes

- 62ed627: feat: add @rfjs/tpl-toolkit package for shared template utilities

  - createVitestConfig() factory for Vitest configuration
  - defaultLintStagedConfig exports for lint-staged setup
  - Three export paths: ., ./vitest, ./lint-staged
