# Templates

This directory contains standalone TypeScript project templates distributed by the `start-ts-by` CLI (https://github.com/royfw/start-ts-by). Each template is a fully functional project with its own `package.json` and `node_modules`.

## Registry

Templates are registered in `registry.json` and consumed by `start-ts-by` during project scaffolding.

## Template Types

| Category | Templates | Purpose |
|----------|-----------|---------|
| **apps** | `app-esbuild`, `app-tsdown`, `fastify-esbuild`, `fastify-tsdown`, `fastify-gql-tsdown`, `koa-esbuild` | Standalone applications (REST API, GraphQL, Koa) |
| **libs** | `lib-esbuild`, `lib-tsdown`, `lib-rollup`, `lib-rolldown` | NPM-publishable TypeScript libraries |
| **bins** | `bin-tsdown` | CLI tools with binary entry point |
| **orm** | `orm-drizzle`, `orm-kysely`, `orm-prisma`, `orm-typeorm` | ORM wrapper libraries with migration/seed scripts |
| **docs** | `docs-docsify`, `docs-vitepress` | Documentation sites |
| **bullmq** | `bull-api`, `lib-queue` | BullMQ job queue infrastructure |
| **monorepo** | `turbo` | Turborepo monorepo scaffold |

## Build Tool Mapping

| Build Tool | Templates |
|------------|-----------|
| **esbuild** | `app-esbuild`, `fastify-esbuild`, `koa-esbuild`, `lib-esbuild`, `bull-api` |
| **tsdown** | `app-tsdown`, `fastify-tsdown`, `fastify-gql-tsdown`, `lib-tsdown`, `bin-tsdown` |
| **rollup** | `lib-rollup`, `docs-docsify`, `docs-vitepress` |
| **rolldown** | `lib-rolldown` |

## Working with Templates

Templates are **independent projects** — they are NOT part of the root pnpm workspace. Always run commands inside the template directory:

```bash
cd templates/apps/fastify-tsdown
pnpm install
pnpm dev        # start dev server
pnpm build      # production build
pnpm test       # run tests
pnpm typecheck  # TypeScript type check
```

## Common Conventions

### TypeScript

- `tsconfig.json` — main config with all `compilerOptions`
- `tsconfig.build.json` — extends `tsconfig.json`, excludes test files
- `@` path alias maps to `src/` (via `tsconfig-paths` at runtime)
- **Exception**: `koa-esbuild` does NOT use `strict: true` (decorator framework incompatibility with `routing-controllers` + `tsyringe` + `class-transformer`)
- `orm-typeorm` uses `useDefineForClassFields: false` and has an additional `tsconfig.typeorm.json` for TypeORM CLI

### Testing

- **Vitest** — all templates use Vitest for unit tests
- Config: `vitest.config.mts` in template root
- Test files: `src/**/*.spec.ts`

### Linting & Formatting

- **ESLint v9** (flat config) — `eslint.config.mts`
- **Prettier** — `.prettierrc`
- **lint-staged** — configured in `package.json` `lint-staged` field
- **Husky** — git hooks via `prepare` script

### Commit Conventions

- **Commitizen** + **commitlint** — conventional commits via `pnpm commit`
- `commitlint.config.js` in each template

### Dependencies

- **pnpm** enforced via `preinstall` script (`only-allow pnpm`)
- Node >= 18, pnpm >= 10.24.0 (see `engines` field)

## Key Files Per Template

| File | Purpose |
|------|---------|
| `package.json` | Scripts, dependencies, engine constraints |
| `tsconfig.json` | TypeScript compiler options |
| `tsconfig.build.json` | Build-specific excludes |
| `vitest.config.mts` | Vitest configuration |
| `eslint.config.mts` | ESLint flat config |
| `.prettierrc` | Prettier settings |
| `commitlint.config.js` | Commit message linting rules |
| Build config | `esbuild.build.ts`, `rolldown.config.ts`, `rollup.config.js`, etc. |
| `scripts/` | Migration, seed, or custom utility scripts (ORM templates) |

## Adding a New Template

1. Create directory under appropriate category (`apps/`, `libs/`, etc.)
2. Add `package.json`, `tsconfig.json`, and build config
3. Register in `registry.json` with name, description, and path
4. Run `pnpm install` inside the template to verify it works
5. Test: `pnpm build && pnpm test && pnpm typecheck`
