# Task 3 Report: seeded/framed first-run and empty state

## Changes

### 1. Empty state — `packages/form-builder-ui/src/config-form-builder.tsx`
- When `builder.config.fields.length === 0`, the field-list area renders a `<p data-testid="empty-state-hint">` with "No fields yet — add one from the palette above" instead of an empty DnD list.
- The preview panel (`data-testid="config-form-preview"`) also shows a muted placeholder ("Preview will appear here once you add fields") and suppresses the `<ConfigForm>` (and therefore its Submit button) when empty.

### 2. Framing/polish — `packages/form-builder-ui/src/config-form-builder.tsx`
- Field-list area wrapped in `rounded-lg border bg-card p-4`.
- Preview panel border upgraded from `rounded-md border-input` to `rounded-lg border bg-card p-4`.
- No new deps added; all existing `data-testid`/`aria-label`/`role` hooks preserved.

### 3. Seed sample — `apps/web/src/tools/form-builder/ui.tsx`
- `SAMPLE_CONFIG` constant: Name (Input, string, required), Email (Input, string), Role (Select, string, options Admin/User).
- Passed as `initialConfig` to `<ConfigFormBuilder>`. `locales={["en","zh-TW"]}` retained.

## TDD evidence
- 3 new tests in `config-form-builder.spec.tsx`:
  - `shows the empty-state hint when there are no fields` — asserts `data-testid="empty-state-hint"` and `/no fields yet/i`.
  - `does not show the empty-state hint when fields are present` — asserts hint is absent.
  - `preview panel has a placeholder and no Submit when fields are empty` — asserts preview text and no Submit button.

## Test results
- `pnpm -F @rfjs/form-builder-ui vitest:run`: **39 passed, 0 failed** (5 test files)
- `pnpm -F web vitest:run`: **73 passed, 0 failed** (23 test files) — registry/nav/i18n tests unaffected; the MISSING_MESSAGE IntlError on `Operators` is a pre-existing noise from `_filter-builder` tests, not caused by this task.

## Check-types
- `pnpm -F @rfjs/form-builder-ui check-types`: clean
- `pnpm -F web check-types`: clean

## Files modified
- `packages/form-builder-ui/src/config-form-builder.tsx` — empty state + framing
- `packages/form-builder-ui/src/config-form-builder.spec.tsx` — 3 new TDD tests
- `apps/web/src/tools/form-builder/ui.tsx` — seed config

## Concerns
None. The web's pre-existing IntlError for `Operators` is not introduced by this task.
