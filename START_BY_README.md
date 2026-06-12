# Turborepo Template

## Get Started by TurboRepo

### install pnpm

- [pnpm.io/zh-TW/installation](https://pnpm.io/zh-TW/installation)

``` sh
corepack enable pnpm

corepack prepare pnpm@latest-9 --activate
corepack use pnpm@latest-9

# clean local corepack cache
corepack cache clean
```

use `pnpm`
```sh
pnpm -v # 9.0.0
pnpm install --frozen-lockfile
```

## Release get CHANGELOG\.md by standard-version

```sh
# Frist Release
# npx
npx standard-version --first-release

########## Release patch
npx standard-version --release-as patch

########## Release minor
npx standard-version --release-as minor

########## Release major
npx standard-version --release-as major
```

---

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `web`: the rfjs web playground — a [Next.js](https://nextjs.org/) app
- `api`: a Fastify REST API
- `orm-app`: an ORM integration demo
- `@rfjs/web-ui`: design tokens, Tailwind preset, and shadcn components for `web`
- `@rfjs/web-core`: tool/package registry and zod schemas for `web`
- `@rfjs/*`: published utility libraries (`data-filter`, `data-transform`, `object-utils`, …)

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

```
cd {project}
pnpm build
```

### Develop

To develop all apps and packages, run the following command:

```
cd {project}
pnpm dev
```

---

## Turborepo Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turbo.build/repo/docs/core-concepts/monorepos/running-tasks)
- [Caching](https://turbo.build/repo/docs/core-concepts/caching)
- [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [Filtering](https://turbo.build/repo/docs/core-concepts/monorepos/filtering)
- [Configuration Options](https://turbo.build/repo/docs/reference/configuration)
- [CLI Usage](https://turbo.build/repo/docs/reference/command-line-reference)
