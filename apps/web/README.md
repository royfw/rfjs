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
| `/playground`, `/playground/[slug]` | Playground index (real) + tool placeholders |
| `/templates` | Templates gallery (placeholder) |

All navigation is driven by the `@rfjs/web-core` registries via `lib/nav.ts`.
Per-package tool/detail pages are designed and built individually in later phases.

## Internationalization

Bilingual via [next-intl](https://next-intl.dev): English (`en`, default) and Traditional Chinese (`zh-TW`).

- Routing: `[locale]` segment (`/en/...`, `/zh-TW/...`); config in `i18n/routing.ts`, middleware in `middleware.ts`.
- Strings: `messages/en.json` + `messages/zh-TW.json`. UI chrome under `Common`/`Home`/`Features`/`Pages`; tool & package copy under `Tools`/`Packages` keyed by tool id / package slug.
- The `@rfjs/web-core` registries hold language-neutral structure only; all display copy is translated. A test (`lib/i18n-content.spec.ts`) fails if any registry entry is missing a string in either locale.
- Switch language via the header switcher; switch theme independently (next-themes).

## Known issues

- **next-themes inline-script warning (dev only).** next-themes' `ThemeProvider`
  injects an anti-flash inline `<script>`; React 19 flags it with "Encountered a
  script tag while rendering React component" (the script is only needed in the
  server-rendered HTML, where it does execute before hydration). It is **dev-only**
  — absent from production builds — and does not affect theming or cause a flash.
  Our setup matches next-themes' documented App Router pattern, and
  `next-themes@0.4.6` (latest) has no option to render the script server-only.
  Tracking upstream for a React 19 fix; no action needed.
