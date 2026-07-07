# Form-Canvas Full Config + No-Overlap Drag — Design

**Date:** 2026-06-29
**Status:** Approved (pending spec review)
**Tool:** `apps/web/src/tools/form-canvas` (the Direction-C 2D-canvas form builder)

## Goal

Bring the `form-canvas` tool to **full feature parity with the engine** and fix the canvas overlap bug:

1. **Full per-item config** — the right-hand editor can configure everything `@rfjs/form-builder`'s `FieldConfig` supports (validation, conditional display, Select/Radio options + defaultValue, dataSource, multi-locale labels, AI note), plus per-kind config for content/spacer. All controls are **canvas-native (newly built)** — no reuse of the A-builder's editors — so the two can be reviewed/compared later.
2. **No-overlap drag/resize** — cards on the grid can never occupy the same cells. Dragging or resizing a card **pushes** colliding cards out of the way and **compacts upward** (react-grid-layout behaviour), live and smooth.

No features are reduced. To fit the full editors, the cramped 320px inspector is replaced by a wider, scrollable **settings panel** (full-screen sheet on mobile).

## Background (current state, post-#209)

- `apps/web/src/tools/form-canvas/ui.tsx` — `FormCanvasTool`: holds `{groups, cards}` state; cards are `{id, groupId, kind, label, key?, component?, required?, placeholder?, col, span, row}`. Drag is raw pointer (`beginDrag` → `cellAt` → `patch`) with **no collision check**. The `Inspector` (~320px) edits only label/key/component/required/placeholder/width/group. Tabs: Canvas | Preview | JSON. Preview renders the real `@rfjs/form-builder-ui` `ConfigForm`; JSON is a real `FormConfig`.
- `apps/web/src/tools/form-canvas/model.ts` — `cardsToFormConfig` / `formConfigToCards` / `jsonToCards` map cards ↔ `FormConfig` (section `layout.placements` carry `{colStart,colSpan,row}`).
- Engine `FieldConfig` (from `@rfjs/form-builder` `types.ts`): `key, label (string | Record<locale,string>), component, dataType, required?, placeholder?, defaultValue?, options?: {label,value}[], width?, validation?: {min,max,minLength,maxLength,pattern,message}, conditional?: ConditionalRule, dataSource?: DataSource`. `ConditionalRule` is a nested `FilterMatchQuery` (`{logic: and|or|nor|not, filters: (Condition | Group)[]}`). `DataSource` = `{request:{url,method?,headers?,body?}, extract:{dialect,expr}, fallback?, optionLabel?, optionValue?}`.

## Architecture & Units

Three independent units plus wiring; each has one responsibility, a clear interface, and is independently testable.

### Unit 1 — `model.ts` Card model extension (pure)

Extend `Card` with optional fields mirroring `FieldConfig`, so the canvas can hold and round-trip full config:

```ts
// added to Card (all optional; field-only unless noted):
label: string | Record<string, string>;   // was string — now localizable
defaultValue?: unknown;
options?: { label: string; value: string | number }[];
validation?: { min?: number; max?: number; minLength?: number; maxLength?: number; pattern?: string; message?: string };
conditional?: ConditionalRule;             // engine type
dataSource?: DataSource;                    // engine type
aiNote?: string;
size?: "sm" | "md" | "lg";                 // spacer only
locked?: boolean;                           // content only
```

`cardToItem` / `cardsToFormConfig` / `formConfigToCards` extended to round-trip every field 1:1 with the engine `FieldItem`/`ContentItem`/`SpacerItem`. `dataType` stays component-derived. Unit-tested: round-trip of a fully-configured field (validation+conditional+options+dataSource+localized label), content text, spacer size.

### Unit 2 — `layout-grid.ts` collision/compaction (pure, NEW file)

A dependency-free module implementing react-grid-layout-style resolution on the canvas's `{col, span, row}` model (per group, `columns = 12`).

```ts
export interface GridItem { id: string; col: number; span: number; row: number; rowSpan?: number }
// Resolve overlaps after `moved` was placed at its new col/row; the moved item is pinned,
// others are pushed down out of its way, then the whole set is compacted upward (gravity).
export function resolveCollisions(items: GridItem[], movedId: string, columns: number): GridItem[];
// Compact upward only (no pinned item) — used to tidy after a delete.
export function compact(items: GridItem[], columns: number): GridItem[];
```

Algorithm (RGL-derived):
- **collides(a,b)** = horizontal overlap (`a.col < b.col+b.span && a.col+a.span > b.col`) AND vertical overlap (`a.row < b.row+ (b.rowSpan??1) && a.row+(a.rowSpan??1) > b.row`).
- **resolveCollisions**: while any item (other than `movedId`, processed in row order) collides with the moved/placed set, push it down by 1 row until clear; then `compact` everything **except** the pinned moved item upward (each item rises to the lowest free row that doesn't collide with already-placed items, scanning top-to-bottom).
- **compact**: sort by (row, col); each item rises to the minimum row ≥ 1 with no collision against already-placed items.

Pure, deterministic, fully unit-tested (overlap push, multi-item cascade, upward gravity, resize-induced push, no-op when already clean).

### Unit 3 — Settings panel + canvas-native config controls (UI)

Replace `Inspector` with `SettingsPanel`:
- **Desktop:** when a card is selected, the right column is a **~420px, scrollable** panel. (Container widens from `lg:w-80` to `lg:w-[420px]`; the canvas column flexes.)
- **Mobile (< lg):** the panel is a **full-screen sheet** (slide-over) with a close button; the canvas stays full-width underneath. Uses `@rfjs/web-ui` Sheet/Dialog primitives if available, else a fixed-overlay fallback.
- **Collapsible sections** (a small local `<Section title>` accordion), shown by selected-item kind:
  - **field:** Basics (label/key/component/required/width/group/placeholder) · **Validation** (min/max/minLength/maxLength/pattern/message — numeric vs text inputs shown by `dataType`) · **Options** (Select/Radio: add/remove `{label,value}` rows + `defaultValue` selector) · **Conditional** (full nested `and/or/nor/not` tree editor — see below) · **Data Source** (url/method/dialect/expr/optionLabel/optionValue/fallback) · **Labels** (per-locale tabs for `routing.locales` = en/zh-TW) · **AI Note** (textarea)
  - **content:** Text (multi-locale) · Locked toggle
  - **spacer:** Size (sm/md/lg)
  - **divider:** (no config)

All controls are **new, canvas-native** components living under `apps/web/src/tools/form-canvas/inspector/` (one file per section: `basics.tsx`, `validation.tsx`, `options.tsx`, `conditional.tsx`, `data-source.tsx`, `labels.tsx`, etc.), each a focused unit taking `(value, onChange)` and editing a slice of the `Card`. The **conditional** editor is a recursive component rendering the `ConditionalRule` tree: each group has a logic select (and/or/nor/not) + add-condition / add-group buttons; each condition is field-select (from sibling field keys) + operator-select + value input; nesting indents. Built fresh (not the A `ConditionalEditor`).

### Wiring (`ui.tsx`)

- `beginDrag` move: after computing the dragged card's tentative `{groupId, col, row}`, build the target group's `GridItem[]`, call `resolveCollisions(items, draggedId, 12)`, and `setCards` with the resolved positions (merged back by id). Runs every `pointermove` → smooth.
- `beginDrag` resize: after computing the new `span`, same `resolveCollisions` pass (a widened card pushes neighbours).
- Delete: run `compact` on the affected group.
- `Inspector` usage replaced by `SettingsPanel`; `updateCard` already exists and patches by id.
- Selection still via click; the panel opens for the selected card.

## Data Flow

Edit in a panel control → `onChange(partialCard)` → `updateCard(id, patch)` → `setCards`. Every render derives `formConfig = cardsToFormConfig(groups, cards)`; Preview (`ConfigForm`) and JSON reflect it live. Dragging → `resolveCollisions` → `setCards`. JSON edits → `jsonToCards` (Zod-validated) → `setGroups`/`setCards`.

## Error Handling

- Invalid JSON / FormConfig → caught in `applyJson`, shown as `jsonError` (unchanged).
- Non-canvas component on import → normalized to `Input` (existing guard); now also: unknown extra config (validation etc.) round-trips through because the Card carries it.
- Collision resolver is total (never throws; clamps rows ≥ 1); a card pushed past a sensible max still resolves (grid grows downward).
- Conditional referencing a deleted field key → preview's `evaluateConditional` already tolerates missing keys; editor shows the raw key.

## Testing Strategy

- **`layout-grid.spec.ts`** (pure): overlap push, cascade, upward gravity, resize push, delete-compact, already-clean no-op.
- **`model.spec.ts`** (extend): round-trip a fully-configured field; content text + locked; spacer size; localized label.
- **inspector control specs**: each control emits the right `Card` patch (e.g. options add/remove, validation numeric, conditional add-group/add-condition produces correct nested `ConditionalRule`).
- **`ui.spec.tsx`** (integration): selecting a card opens the panel; editing options → Preview's `ConfigForm` Select shows them; setting a conditional → Preview hides/shows the dependent field; dragging a card onto another does not produce overlapping placements (assert no two placements share a cell).
- **RWD**: panel stacks/sheets under lg (assert layout class/structure).

## File Structure

```
apps/web/src/tools/form-canvas/
  ui.tsx                      # FormCanvasTool — wire resolveCollisions + SettingsPanel
  model.ts                    # extend Card + mappers (Unit 1)
  model.spec.ts               # + new round-trip cases
  layout-grid.ts              # NEW — collision/compaction (Unit 2)
  layout-grid.spec.ts         # NEW
  inspector/
    settings-panel.tsx        # NEW — panel/sheet shell + section routing by kind
    section.tsx               # NEW — collapsible <Section>
    basics.tsx                # (existing fields, moved here)
    validation.tsx            # NEW
    options.tsx               # NEW
    conditional.tsx           # NEW — recursive nested editor
    data-source.tsx           # NEW
    labels.tsx                # NEW — per-locale tabs
    *.spec.tsx                # co-located
```

## Decomposition (for the implementation plan)

Two largely-independent streams sharing only the Card-model extension:

- **Stream B (collision)** — Unit 2 + its wiring. Small, self-contained, ships a visible fix. Good first plan.
- **Stream A (full config)** — Unit 1 (Card model) → settings-panel shell → each section control (validation → options → labels → conditional → dataSource → content/spacer) → integration. Larger; the model extension lands first since the controls depend on it.

The implementation plan may split these into two phases or two plans; each produces working, tested software on its own.

## Non-Goals

- No new engine changes (engine already supports all of this; this is canvas-side only).
- No A-builder editor reuse (explicit: build canvas-native, review/compare later).
- Locales limited to the app's configured set (`routing.locales`: en, zh-TW).
