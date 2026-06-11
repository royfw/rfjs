# web — rfjs web playground

Package showcase, interactive playgrounds, and developer data tools for the
`@rfjs/*` ecosystem. Not a blog or docs site (that's royfw.dev).

## Stack

Next.js App Router · TypeScript strict · Tailwind CSS v4 · shadcn/ui
(components live in `@rfjs/web-ui`) · registry data in `@rfjs/web-core`.

## Develop

```bash
pnpm -F web dev          # http://localhost:3000
pnpm -F web build
pnpm -F web lint
pnpm -F web check-types
```

## Add a tool / package to the site

Edit the registries in `packages/web-core/src/registry/` (`tools.ts`,
`packages.ts`). Schemas in `schemas.ts` validate entries;
`pnpm -F @rfjs/web-core test` checks cross-references. Homepage, sidebar,
tools index, and sitemap are all driven by these registries.

## Routes

| Route | State |
|-------|-------|
| `/` | Home — polished intro page |
| `/packages`, `/packages/[slug]` | Package showcase (index real, detail placeholder) |
| `/tools`, `/tools/[slug]` | Tools index (real) + detail placeholders |
| `/playground` | Playground index |
| `/templates` | Templates gallery (placeholder) |

All navigation is driven by the `@rfjs/web-core` registries via `lib/nav.ts`.
Per-package tool/detail pages are designed and built individually in later phases.
