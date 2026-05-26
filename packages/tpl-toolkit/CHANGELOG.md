# @rfjs/tpl-toolkit

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
