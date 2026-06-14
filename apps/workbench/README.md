# workbench — rfjs application platform

Admin-style workbench for dataset-driven applications composing the
`@rfjs/*` packages. Quick single-purpose tools live on apps/web; this
app hosts the stateful, dataset-first experiences.

Spec: `docs/superpowers/specs/2026-06-13-workbench-and-web-convergence-design.md`

## PWA

Installable on modern Chromium/Safari via `app/manifest.ts` + build-time
generated icons (`app/icon-{192,512}.png` via `next/og`). No service worker /
offline yet — deferred to a later phase (4b, Serwist).

## Develop

```bash
pnpm -F workbench dev          # http://localhost:3001
pnpm -F workbench build
pnpm -F workbench lint
pnpm -F workbench check-types
pnpm -F workbench test
```

## Routes

| Route | State |
|-------|-------|
| `/` | Redirects to `/dashboard` |
| `/dashboard` | Shell placeholder (Phase 1) |
| `/datasets` | Shell placeholder — Dexie-backed management arrives in a later phase |
| `/apps`, `/apps/[slug]` | Registry-driven index (`surface: 'workbench'`); apps arrive in a later phase |
| `/admin` | Reserved — unlocks with demo auth in a later phase |

## Internationalization

Same pattern as apps/web: next-intl, `[locale]` segment, `en` + `zh-TW`
messages in `messages/`.
