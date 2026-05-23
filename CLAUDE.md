# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**rfjs** is a Turborepo monorepo that serves as a template collection for the `start-ts-by` CLI (npm package). It contains production-ready TypeScript project templates for various use cases — apps, libraries, CLIs, docs sites, ORM wrappers, and full monorepo scaffolds.

The repo has three content types:
1. **Apps** (`apps/`) — runnable demo applications (api, web, orm-app)
2. **Packages/Libs** (`packages/`, `libs/`) — shared libraries published to npm
3. **Templates** (`templates/`) — standalone project templates distributed via `start-ts-by` CLI, registered in `templates/registry.json`

## Environment

- **Node**: >=18 (see `.nvmrc` for current version)
- **Package manager**: pnpm >=10.24.0 (enforced by `preinstall` script and `.npmrc` strict settings)
- **TypeScript**: 5.7+

## Common Commands

All root-level commands delegate to Turborepo. Run from repo root unless noted.

```bash
pnpm install              # install dependencies (use --frozen-lockfile in CI)
pnpm build                # build all apps and packages
pnpm build:packages       # build only @rfjs/* packages
pnpm dev                  # start all dev servers
pnpm test                 # run all tests
pnpm lint                 # lint all packages
pnpm typecheck            # type check all packages
pnpm format               # prettier write
pnpm commit               # commitizen (conventional commits)
```

### Per-package commands

Each package/app has its own `package.json` with tasks. Common patterns:
- `pnpm --filter <pkg-name> <command>` — run a command in a specific package
- `pnpm -F api dev` — start the api app dev server
- `pnpm -F @rfjs/pg-toolkit test` — test a specific library

### Testing

Tests use **Vitest** across the monorepo. Each package has its own `vitest.config.mts` (unit) and `vitest.config.e2e.mts` (E2E).

```bash
pnpm test                 # run all tests via turbo
pnpm -F <pkg> vitest:run  # run unit tests for a package
pnpm -F <pkg> vitest:e2e:run  # run E2E tests for a package
pnpm -F <pkg> vitest      # interactive watch mode
```

### Docs

Each app/lib has VitePress docs in its `docs/` folder:
```bash
pnpm -F <pkg> docs:dev    # start docs dev server
pnpm -F <pkg> docs:build  # build docs static site
```

## Repository Structure

```
apps/                     # Demo applications
  api/                    # Fastify REST API (esbuild)
  orm-app/                # ORM integration demo (tsdown) — consumes all 4 ORM libs
  web/                    # Next.js web app (turbopack)

packages/                 # Shared internal packages + publishable libs
  eslint-config/          # Shared ESLint config (@repo/eslint-config)
  typescript-config/      # Shared tsconfig (@repo/typescript-config)
  ui/                     # Shared React component library (@repo/ui)
  pg-toolkit/             # PostgreSQL utilities — published to npm (@rfjs/pg-toolkit)

libs/                     # ORM wrapper libraries (private, consumed by orm-app)
  orm-drizzle/            # Drizzle ORM wrapper
  orm-kysely/             # Kysely ORM wrapper
  orm-prisma/             # Prisma ORM wrapper
  orm-typeorm/            # TypeORM wrapper

templates/                # Standalone project templates (start-ts-by CLI)
  apps/                   # App templates: app-esbuild, app-tsdown, fastify-*, koa-esbuild
  bins/                   # CLI templates: bin-tsdown
  libs/                   # Library templates: lib-esbuild, lib-rollup, lib-tsdown, lib-rolldown
  docs/                   # Docs templates: docs-docsify, docs-vitepress
  monorepo/               # Monorepo template: turbo/stack/base
  bullmq/                 # BullMQ templates: bull-api, lib-queue
  orm/                    # ORM templates: orm-drizzle, orm-kysely, orm-prisma, orm-typeorm
  registry.json           # Template registry for start-ts-by CLI
```

## Template Architecture

Each template in `templates/` is a **standalone project** with its own `package.json`, `node_modules`, and build config. They are NOT part of the pnpm workspace. Templates are registered in `templates/registry.json` and consumed by the `start-ts-by` CLI.

When modifying a template, work inside the template's directory directly (e.g., `templates/apps/fastify-gql-tsdown/`). Use `pnpm install` and `pnpm dev/test/build` within that directory.

### Template build tools
- **esbuild**: `app-esbuild`, `fastify-esbuild`, `koa-esbuild`, `lib-esbuild`
- **tsdown**: `app-tsdown`, `fastify-tsdown`, `fastify-gql-tsdown`, `lib-tsdown`, `bin-tsdown`
- **Rollup**: `lib-rollup`
- **Rolldown**: `lib-rolldown`

## API App Architecture

The `apps/api/` follows a layered Fastify architecture:
- `src/delivery/` — HTTP layer (routes, modules)
- `src/infrastructures/` — Fastify app setup, plugin registration, server bootstrap
- `src/helpers/` — Fastify route helpers, pino transport config
- `src/utils/` — Shared utilities

## CI/CD

- **GitLab CI** (`.gitlab-ci.yml`): Includes shared DevOps toolkit for build/deploy, changeset versioning, and npm publish
- **GitHub Actions** (`.github/workflows/`): Additional CI workflows for deploy and npm release
- **Deploy branches**: `deploy/dev`, `deploy/prod` trigger Kubernetes deployment
- **Release branches**: `release/stable`, `release/alpha|beta|rc` trigger versioning
- **Publish**: `publish/npmjs` branch (manual trigger) publishes to npm

## Versioning and Changesets

- Uses **Changesets** for version management (`pnpm changeset:add` to create a changeset)
- Currently in **pre-release mode** with `alpha` tag (see `.changeset/pre.json`)
- Changelog: `@changesets/changelog-git` (commit-message-based)
- Release workflow: `pnpm changeset:add` → commit → push to `release/*` branch → version + publish

## Git Hooks

- **pre-commit**: runs `turbo run lint-staged test --affected`
- **commit-msg**: runs `commitlint --edit` (conventional commits)
