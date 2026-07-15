# web — rfjs web playground

Package showcase, interactive playgrounds, and developer data tools for the
`@rfjs/*` ecosystem. Not a blog or docs site (that's royfw.dev).

## Stack

Next.js App Router · TypeScript strict · Tailwind CSS v4 · shadcn/ui
(components live in `@rfjs/web-ui`) · registry data in `@rfjs/web-core`.

## PWA

Installable on modern Chromium/Safari via `app/manifest.ts` + app icons
generated at build with `next/og` `ImageResponse` (`app/icon-{192,512}.png`,
at dotted paths so they bypass the next-intl middleware). No service worker /
offline caching yet — that's a later phase (4b, Serwist).

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

> **Source layout**: app source lives under `src/` (`src/app/`, `src/components/`,
> `src/lib/`, etc.). Registry data stays in `packages/web-core` as before.

## Routes

| Route | State |
|-------|-------|
| `/` | Home — polished intro page |
| `/packages`, `/packages/[slug]` | Package showcase — index lists all `@rfjs/*` packages; detail shows install command, npm/GitHub links, and related tools |
| `/tools`, `/tools/[slug]` | Tools index lists web-native quick tools (internal) **and** workbench apps as cross-site links. All six quick tools are live: type-converter, object-flatten, data-filter-tester, mongo-query-generator, jsonb-query-generator (jwt-decoder ships with Phase 6) |
| `/playground` | Redirects to `/tools` (the playground concept moved to the workbench app) |
| `/templates` | Templates gallery (placeholder) |

All navigation is driven by the `@rfjs/web-core` registries via `lib/nav.ts`.

## Cross-site links

Tools that are workbench apps link across to the workbench (separate Next.js app).
The base URL is controlled by:

```
NEXT_PUBLIC_WORKBENCH_URL=http://localhost:3001   # default in dev
```

Set this in `.env.local` (or your deploy environment) to point at the deployed workbench.

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
