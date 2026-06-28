# Task 3 Report — Canvas `cardsToFormConfig` / `formConfigToCards` mappers

## Status: DONE

## Commits
- `6506b59` feat(web): canvas <-> FormConfig mappers (model.ts)

## Steps completed

### Type comparison (`ui.tsx` vs brief)
The local `Kind`, `Component`, `Card`, `Group` declarations in `ui.tsx` matched the brief's `model.ts` exactly — field names, types, optional markers all identical. No NEEDS_CONTEXT stop required.

### Step 1 — `model.ts` created
`apps/web/src/tools/form-canvas/model.ts` created verbatim per the brief:
- Re-exports `Kind`, `Component`, `Card`, `Group`
- `DATATYPE` mapping: `Input/Textarea/Select → string`, `Number → numeric`, `Switch → boolean`, `DatePicker → date`
- `cardsToFormConfig` — maps groups → `FormSection[]` with `rows` + `section.layout.placements` (col/span/row preserved 1:1)
- `formConfigToCards` — inverse, reads placements from `layout.placements` by itemId
- `jsonToCards` — parses raw JSON text via `parseFormConfig` + `formConfigToCards`

Imports verified against built `@rfjs/form-builder` dist: `FormConfig`, `FormSection`, `FormItem`, `ScalarType`, `parseFormConfig` all exported. `FieldComponent` is a superset of canvas `Component`, so no cast issues.

### Step 2 — `model.spec.ts` created
`apps/web/src/tools/form-canvas/model.spec.ts` created verbatim per the brief.

### Step 3 — Tests pass
`pnpm -F web vitest:run src/tools/form-canvas/model.spec.ts` → 2/2 passed.

### Step 4 — `ui.tsx` type-move
Deleted local `type Kind`, `type Component`, `interface Card`, `interface Group`. Added `import type { Card, Group, Kind, Component } from "./model";`. `COMPONENTS` array and all behavior (`serialize`/`parse`/`PreviewForm`) left unchanged.

### Step 5 — Typecheck
`pnpm -F web check-types` → no errors.

### Step 6 — Commit
Single commit `6506b59` with 3 files (model.ts + model.spec.ts + ui.tsx).

## Concerns
None. Types matched exactly, imports resolved cleanly, both tests pass, typecheck clean.
