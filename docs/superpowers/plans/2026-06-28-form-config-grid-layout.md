# Form-Config Grid Layout (make Direction-C "real") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `@rfjs/form-builder` with native 12-column grid coordinates so the Direction-C 2D canvas (`form-canvas` tool) edits a *real* `FormConfig` — its Preview becomes the real `ConfigForm` (true validation / conditional / dataSource) and its JSON becomes a valid `FormConfig`, with zero layout fidelity loss.

**Architecture:** Add an optional `layout?: { columns, placements[] }` descriptor to `FormSection` (additive, backward-compatible). Items keep living in `section.rows[].items[]` (so `collectFieldItems` / validation / conditional / dataSource keep working untouched); `layout.placements` position items by their stable `id` on a CSS grid. `ConfigForm` gains a grid-mode branch that honors `{colStart, colSpan, row}`. The canvas tool maps its `{groups, cards}` to/from this `FormConfig` 1:1 and renders the engine's `ConfigForm` for preview.

**Tech Stack:** TypeScript 5.7+, Zod, React 19, Vitest, Next.js (apps/web), pnpm/Turborepo. `@rfjs/form-builder` builds to **dist** (must rebuild after engine edits); `@rfjs/form-builder-ui` and the `form-canvas` tool are source-consumed via Next `transpilePackages`.

## Global Constraints

- Work in worktree `feat-form-config-grid` (branch `feat-form-config-grid`, off `origin/main`). Run `pnpm install` once at start; run `pnpm -F @rfjs/form-builder build` after **every** engine (`packages/form-builder`) source change before UI/app typecheck or tests.
- The change to `FormConfig` is **additive and backward-compatible**: existing configs (no `layout`) must keep rendering exactly as today. Do not change `FieldWidth`, `FormSection.columns`, or the flow renderer path.
- `config-schema.ts` uses default strip-mode `z.object` — any new persisted key **must** be mirrored into the schema or it is silently dropped. Every new key gets a round-trip test.
- Co-locate `*.spec.ts(x)` next to source (vitest glob `src/**/*.spec.ts`). Conventional-commit messages, subject ≤ 100 chars, lowercase subject, no `Direction`/PascalCase start. End commit bodies with the `Co-Authored-By` trailer.
- No changeset (these are private/preview surfaces; `@rfjs/form-builder` is `preview`). DRY, YAGNI, TDD, commit per task.

---

### Task 1: Engine — persist grid layout on `FormSection` (types + schema + round-trip)

**Files:**
- Modify: `packages/form-builder/src/types.ts` (add `GridPlacement`, `SectionLayout`; add `layout?` to `FormSection`)
- Modify: `packages/form-builder/src/config-schema.ts` (mirror the new shape into the zod schema)
- Test: `packages/form-builder/src/config-schema.spec.ts` (add round-trip + rejection tests; create the file if absent)

**Interfaces:**
- Produces:
  - `interface GridPlacement { itemId: string; colStart: number; colSpan: number; row: number; rowSpan?: number }`
  - `interface SectionLayout { columns: number; placements: GridPlacement[] }`
  - `FormSection.layout?: SectionLayout`
  - `parseFormConfig(input: unknown): FormConfig` (unchanged signature; now preserves `section.layout`)

- [ ] **Step 1: Write the failing test**

Append to `packages/form-builder/src/config-schema.spec.ts` (create the file with the standard header `import { describe, it, expect } from 'vitest';` and `import { parseFormConfig } from './config-schema';` if it does not exist):

```ts
describe('FormConfig grid layout', () => {
  const gridConfig = {
    version: 1,
    sections: [
      {
        id: 's1',
        title: 'Account',
        rows: [{ id: 's1_row', items: [
          { id: 'i_name', kind: 'field', key: 'name', label: 'Name', component: 'Input', dataType: 'string' },
        ] }],
        layout: {
          columns: 12,
          placements: [{ itemId: 'i_name', colStart: 1, colSpan: 6, row: 1 }],
        },
      },
    ],
  };

  it('round-trips a section.layout (col/span/row survive strip-mode)', () => {
    const parsed = parseFormConfig(gridConfig);
    expect(parsed.sections![0]!.layout).toEqual({
      columns: 12,
      placements: [{ itemId: 'i_name', colStart: 1, colSpan: 6, row: 1 }],
    });
  });

  it('rejects a placement with colSpan < 1', () => {
    const bad = structuredClone(gridConfig);
    bad.sections[0]!.layout!.placements[0]!.colSpan = 0;
    expect(() => parseFormConfig(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/form-builder vitest:run src/config-schema.spec.ts`
Expected: FAIL — the round-trip test fails because `layout` is stripped (`parsed.sections[0].layout` is `undefined`).

- [ ] **Step 3: Add the types**

In `packages/form-builder/src/types.ts`, add immediately above `export interface FormRow`:

```ts
/** Explicit 12-column-grid placement of a single item (positioned by its `id`). */
export interface GridPlacement {
  itemId: string;   // FormItem.id this placement positions
  colStart: number; // 1-based grid column start
  colSpan: number;  // column span (>= 1)
  row: number;      // 1-based grid row
  rowSpan?: number; // optional row span (default 1)
}

/** Opt-in grid layout for a section. When present, the section renders as a
 *  single CSS grid of `columns` columns and items are positioned by placement.
 *  When absent, the section keeps the existing flow (rows + width) behaviour. */
export interface SectionLayout {
  columns: number;
  placements: GridPlacement[];
}
```

Then change the `FormSection` line to add the optional field:

```ts
export interface FormSection { id: string; title?: LocalizedLabel; rows: FormRow[]; columns?: 1 | 2 | 3 | 4; layout?: SectionLayout; }
```

- [ ] **Step 4: Mirror the shape into the zod schema**

In `packages/form-builder/src/config-schema.ts`, add these two schemas immediately above `const formRowSchema = ...`:

```ts
const gridPlacementSchema = z.object({
  itemId: z.string().min(1),
  colStart: z.number().int().min(1).max(48),
  colSpan: z.number().int().min(1).max(48),
  row: z.number().int().min(1),
  rowSpan: z.number().int().min(1).optional(),
});
const sectionLayoutSchema = z.object({
  columns: z.number().int().min(1).max(48),
  placements: z.array(gridPlacementSchema),
});
```

Then add `layout` to `formSectionSchema`:

```ts
const formSectionSchema = z.object({
  id: z.string().min(1),
  title: localizedLabelSchema.optional(),
  rows: z.array(formRowSchema),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  layout: sectionLayoutSchema.optional(),
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -F @rfjs/form-builder vitest:run src/config-schema.spec.ts`
Expected: PASS (both new tests + any pre-existing ones).

- [ ] **Step 6: Build the engine + typecheck**

Run: `pnpm -F @rfjs/form-builder build && pnpm -F @rfjs/form-builder check-types`
Expected: build succeeds, no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/form-builder/src/types.ts packages/form-builder/src/config-schema.ts packages/form-builder/src/config-schema.spec.ts
git commit -m "feat(form-builder): add optional grid layout to FormSection

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Renderer — `ConfigForm` grid-mode branch honoring placements

**Files:**
- Modify: `packages/form-builder-ui/src/config-form.tsx` (generalize `renderItem` to take a placement; add a grid-mode section branch)
- Test: `packages/form-builder-ui/src/config-form.spec.tsx` (add a grid-layout rendering test)

**Interfaces:**
- Consumes: `GridPlacement`, `SectionLayout`, `FormSection.layout` from Task 1; `parseFormConfig` unchanged.
- Produces: when a section has `layout`, each item wrapper carries `style.gridColumn = "<colStart> / span <colSpan>"` and `style.gridRow = "<row>"`, inside a section `<div data-testid="form-grid">` whose `gridTemplateColumns` is `repeat(<columns>, minmax(0, 1fr))`.

- [ ] **Step 1: Write the failing test**

Append to `packages/form-builder-ui/src/config-form.spec.tsx`:

```tsx
describe('grid-layout sections', () => {
  const cfg = {
    version: 1,
    sections: [
      {
        id: 's1',
        rows: [{ id: 'r1', items: [
          { id: 'i_a', kind: 'field', key: 'a', label: 'A', component: 'Input', dataType: 'string' },
          { id: 'i_b', kind: 'field', key: 'b', label: 'B', component: 'Input', dataType: 'string' },
        ] }],
        layout: { columns: 12, placements: [
          { itemId: 'i_a', colStart: 1, colSpan: 7, row: 1 },
          { itemId: 'i_b', colStart: 8, colSpan: 5, row: 1 },
        ] },
      },
    ],
  };

  it('renders a layout section as one grid, positioning items by placement', () => {
    const { container } = render(<ConfigForm config={cfg as any} onSubmit={() => {}} />);
    const grid = container.querySelector('[data-testid="form-grid"]') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(12, minmax(0, 1fr))');
    const a = container.querySelector('[data-item="i_a"]') as HTMLElement;
    const b = container.querySelector('[data-item="i_b"]') as HTMLElement;
    expect(a.style.gridColumn).toBe('1 / span 7');
    expect(b.style.gridColumn).toBe('8 / span 5');
    expect(a.style.gridRow).toBe('1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run src/config-form.spec.tsx`
Expected: FAIL — `[data-testid="form-grid"]` is null (no grid-mode branch yet).

- [ ] **Step 3: Add a placement-style helper + a `data-item` hook to `renderItem`**

In `packages/form-builder-ui/src/config-form.tsx`, just below the existing `FULL_SPAN` constant (around line 98), add:

```tsx
  // Explicit grid placement → inline grid-area style (grid-mode sections, Task 2).
  const placementStyle = (p: { colStart: number; colSpan: number; row: number; rowSpan?: number }): React.CSSProperties => ({
    gridColumn: `${p.colStart} / span ${p.colSpan}`,
    gridRow: p.rowSpan ? `${p.row} / span ${p.rowSpan}` : String(p.row),
    minWidth: 0,
  });
```

Change the `renderItem` signature and field-branch wrapper so it accepts an optional placement. Replace the `renderItem(item, flow, cols)` signature line with:

```tsx
  function renderItem(item: FormItem, flow: 'v1' | 'section', cols: number, place?: { colStart: number; colSpan: number; row: number; rowSpan?: number }) {
```

Inside `renderItem`, the field branch builds `data-width`/`style`. Replace the field wrapper opening `<div ...>` (the one with `data-width={dataWidth}`) with one that prefers the placement style and tags the item id:

```tsx
      <div
        key={item.key}
        className="flex min-w-0 flex-col gap-1.5"
        data-width={dataWidth}
        data-item={item.id}
        style={place ? placementStyle(place) : fieldSpanStyle(item.width, flow, cols)}
      >
```

For the non-field branches (`divider`, `spacer`, `content`), when `place` is provided they must use the placement style instead of `FULL_SPAN`. Change each of those three `style={FULL_SPAN}` / `style={{ ...FULL_SPAN, height }}` usages to honor `place`:

```tsx
    // divider:
      return <hr key={item.id} data-item={item.id} className="w-full border-input" style={place ? placementStyle(place) : FULL_SPAN} />;
    // spacer:
      return <div key={item.id} data-item={item.id} style={{ ...(place ? placementStyle(place) : FULL_SPAN), height }} />;
    // content:
      return (
        <div key={item.id} data-item={item.id} className="text-sm" style={place ? placementStyle(place) : FULL_SPAN}>
```

- [ ] **Step 4: Add the grid-mode section branch**

In the `sections.map((section) => { ... })` body, replace the `return ( <React.Fragment ...> ... </React.Fragment> )` so that a section WITH `layout` renders one grid. Insert this branch right after `const sectionCols = section.columns ?? 1;`:

```tsx
        if (isV2 && section.layout) {
          const layout = section.layout;
          const byId = new Map(layout.placements.map((p) => [p.itemId, p]));
          const items = section.rows.flatMap((r) => r.items);
          return (
            <React.Fragment key={section.id}>
              {section.title && (
                <h3 className="font-semibold text-sm" style={{ gridColumn: '1 / -1' }}>
                  {resolveLabel(section.title, locale)}
                </h3>
              )}
              <div
                data-testid="form-grid"
                className="grid gap-4"
                style={{ gridColumn: '1 / -1', gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}
              >
                {items.map((item) => renderItem(item, 'section', layout.columns, byId.get(item.id)))}
              </div>
            </React.Fragment>
          );
        }
```

(The existing flow branch below it is unchanged and handles sections without `layout`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run src/config-form.spec.tsx`
Expected: PASS, including the new `grid-layout sections` test and all pre-existing tests (flow path untouched).

- [ ] **Step 6: Typecheck**

Run: `pnpm -F @rfjs/form-builder-ui check-types`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/form-builder-ui/src/config-form.tsx packages/form-builder-ui/src/config-form.spec.tsx
git commit -m "feat(form-builder-ui): render grid-layout sections by placement

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Canvas — pure `cardsToFormConfig` / `formConfigToCards` mappers

**Files:**
- Create: `apps/web/src/tools/form-canvas/model.ts` (pure mapping functions + the canvas types, moved out of `ui.tsx`)
- Modify: `apps/web/src/tools/form-canvas/ui.tsx` (import the moved types from `./model` — no behavior change yet)
- Test: `apps/web/src/tools/form-canvas/model.spec.ts`

**Interfaces:**
- Consumes: `FormConfig`, `parseFormConfig` from `@rfjs/form-builder`; the existing `Card`/`Group`/`Kind`/`Component` shapes (move them into `model.ts` and re-export).
- Produces:
  - `cardsToFormConfig(groups: Group[], cards: Card[]): FormConfig`
  - `formConfigToCards(config: FormConfig): { groups: Group[]; cards: Card[] }`
  - re-exported types `Card`, `Group`, `Kind`, `Component`

- [ ] **Step 1: Move the canvas types into `model.ts` and add the mappers**

Create `apps/web/src/tools/form-canvas/model.ts`:

```ts
import { parseFormConfig, type FormConfig, type FormItem, type FormSection, type ScalarType } from "@rfjs/form-builder";

export type Kind = "field" | "content" | "divider" | "spacer" | "ai-note";
export type Component = "Input" | "Textarea" | "Select" | "Number" | "Switch" | "DatePicker";

export interface Card {
  id: string;
  groupId: string;
  kind: Kind;
  label: string;
  key?: string;
  component?: Component;
  required?: boolean;
  placeholder?: string;
  col: number;
  span: number;
  row: number;
}
export interface Group {
  id: string;
  title: string;
  collapsed: boolean;
}

const CANVAS_COLUMNS = 12;

// Component → engine dataType (controls validation/coercion downstream).
const DATATYPE: Record<Component, ScalarType> = {
  Input: "string",
  Textarea: "string",
  Select: "string",
  Number: "numeric",
  Switch: "boolean",
  DatePicker: "date",
};

function cardToItem(c: Card): FormItem {
  switch (c.kind) {
    case "field":
      return {
        id: c.id,
        kind: "field",
        key: c.key ?? c.id,
        label: c.label,
        component: c.component ?? "Input",
        dataType: DATATYPE[c.component ?? "Input"],
        ...(c.required ? { required: true } : {}),
        ...(c.placeholder ? { placeholder: c.placeholder } : {}),
      };
    case "content":
      return { id: c.id, kind: "content", text: c.label };
    case "ai-note":
      return { id: c.id, kind: "ai-note", text: c.label };
    case "divider":
      return { id: c.id, kind: "divider" };
    case "spacer":
      return { id: c.id, kind: "spacer" };
  }
}

export function cardsToFormConfig(groups: Group[], cards: Card[]): FormConfig {
  const sections: FormSection[] = groups.map((g) => {
    const groupCards = cards
      .filter((c) => c.groupId === g.id)
      .sort((a, b) => a.row - b.row || a.col - b.col);
    return {
      id: g.id,
      title: g.title,
      rows: [{ id: `${g.id}_row`, items: groupCards.map(cardToItem) }],
      layout: {
        columns: CANVAS_COLUMNS,
        placements: groupCards.map((c) => ({ itemId: c.id, colStart: c.col, colSpan: c.span, row: c.row })),
      },
    };
  });
  return { version: 1, sections };
}

function labelToString(label: unknown): string {
  if (typeof label === "string") return label;
  if (label && typeof label === "object") return String(Object.values(label as Record<string, string>)[0] ?? "");
  return "";
}

export function formConfigToCards(config: FormConfig): { groups: Group[]; cards: Card[] } {
  const groups: Group[] = [];
  const cards: Card[] = [];
  for (const section of config.sections ?? []) {
    groups.push({ id: section.id, title: labelToString(section.title) || "Section", collapsed: false });
    const byId = new Map((section.layout?.placements ?? []).map((p) => [p.itemId, p]));
    for (const item of section.rows.flatMap((r) => r.items)) {
      const p = byId.get(item.id);
      const base = { id: item.id, groupId: section.id, col: p?.colStart ?? 1, span: p?.colSpan ?? 6, row: p?.row ?? 1 };
      if (item.kind === "field") {
        cards.push({ ...base, kind: "field", label: labelToString(item.label), key: item.key, component: item.component as Component, required: item.required, placeholder: item.placeholder });
      } else if (item.kind === "content" || item.kind === "ai-note") {
        cards.push({ ...base, kind: item.kind, label: labelToString(item.text) });
      } else {
        cards.push({ ...base, kind: item.kind, label: item.kind === "divider" ? "Divider" : "Spacer" });
      }
    }
  }
  return { groups, cards };
}

// Parse JSON text → canvas model (throws on invalid FormConfig).
export function jsonToCards(text: string): { groups: Group[]; cards: Card[] } {
  return formConfigToCards(parseFormConfig(JSON.parse(text)));
}
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/tools/form-canvas/model.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cardsToFormConfig, formConfigToCards, type Card, type Group } from "./model";

const groups: Group[] = [{ id: "g1", title: "Account", collapsed: false }];
const cards: Card[] = [
  { id: "c1", groupId: "g1", kind: "field", label: "Name", key: "name", component: "Input", required: true, col: 1, span: 7, row: 1 },
  { id: "c2", groupId: "g1", kind: "field", label: "Age", key: "age", component: "Number", col: 8, span: 5, row: 1 },
];

describe("canvas <-> FormConfig", () => {
  it("emits a FormConfig whose section.layout keeps exact col/span/row", () => {
    const cfg = cardsToFormConfig(groups, cards);
    expect(cfg.sections![0]!.layout).toEqual({
      columns: 12,
      placements: [
        { itemId: "c1", colStart: 1, colSpan: 7, row: 1 },
        { itemId: "c2", colStart: 8, colSpan: 5, row: 1 },
      ],
    });
    expect(cfg.sections![0]!.rows[0]!.items[1]).toMatchObject({ key: "age", component: "Number", dataType: "numeric" });
  });

  it("round-trips canvas -> FormConfig -> canvas without losing placement", () => {
    const back = formConfigToCards(cardsToFormConfig(groups, cards));
    expect(back.cards).toHaveLength(2);
    expect(back.cards[1]).toMatchObject({ id: "c2", col: 8, span: 5, row: 1, component: "Number" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `pnpm -F web vitest:run src/tools/form-canvas/model.spec.ts`
Expected first run: FAIL only if `model.ts` is incomplete; with Step 1 in place it should PASS. If it fails to resolve `@rfjs/form-builder` types, run `pnpm -F @rfjs/form-builder build` first.

- [ ] **Step 4: Point `ui.tsx` at the moved types (no behavior change)**

In `apps/web/src/tools/form-canvas/ui.tsx`, delete the local `type Kind`, `type Component`, `interface Card`, `interface Group` declarations and import them from `./model` instead:

```tsx
import type { Card, Group, Kind, Component } from "./model";
```

Leave the existing `serialize`/`parse`/`PreviewForm` as-is for now (Task 4 replaces them). Keep `COMPONENTS` (the array) local to `ui.tsx`.

- [ ] **Step 5: Typecheck**

Run: `pnpm -F web check-types`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/tools/form-canvas/model.ts apps/web/src/tools/form-canvas/model.spec.ts apps/web/src/tools/form-canvas/ui.tsx
git commit -m "feat(web): canvas <-> FormConfig mappers (model.ts)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Canvas — real `ConfigForm` preview + real `FormConfig` JSON

**Files:**
- Modify: `apps/web/src/tools/form-canvas/ui.tsx` (swap mock preview → `ConfigForm`; swap `serialize`/`applyJson` → real `FormConfig` via `model.ts`; delete the mock `PreviewForm`/`PreviewField` + the old local `serialize`/`parse`)
- Test: `apps/web/src/tools/form-canvas/ui.spec.tsx` (create — preview renders a real control; JSON tab shows a `FormConfig`)

**Interfaces:**
- Consumes: `cardsToFormConfig`, `jsonToCards`, `formConfigToCards` from `./model` (Task 3); `ConfigForm` from `@rfjs/form-builder-ui`.
- Produces: the `form-canvas` tool's Preview tab renders `<ConfigForm>`; JSON tab serializes a real `FormConfig` and edits rebuild the canvas via `jsonToCards`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/tools/form-canvas/ui.spec.tsx` (include the jsdom pointer/scroll shims used by the other form specs — copy the shim block from `packages/form-builder-ui/src/config-form-builder.spec.tsx` top):

```tsx
// (jsdom shims for radix pointer capture / scrollIntoView / ResizeObserver — copy from config-form-builder.spec.tsx)
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { FormCanvasTool } from "./ui";

describe("FormCanvasTool preview", () => {
  it("Preview tab renders the real ConfigForm with a labelled control", () => {
    render(<FormCanvasTool />);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    // The seed has a "Name" field → real <Label> + a real input render.
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByRole("button", { name: /submit/i })).toBeTruthy();
  });

  it("JSON tab shows a FormConfig (version + sections)", () => {
    render(<FormCanvasTool />);
    fireEvent.click(screen.getByRole("button", { name: /^json$/i }));
    const ta = screen.getByLabelText(/config json/i) as HTMLTextAreaElement;
    const parsed = JSON.parse(ta.value);
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.sections)).toBe(true);
    expect(parsed.sections[0].layout.columns).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F web vitest:run src/tools/form-canvas/ui.spec.tsx`
Expected: FAIL — the mock preview has no Submit button / no real `FormConfig` JSON yet.

- [ ] **Step 3: Wire the real config + preview into `ui.tsx`**

In `apps/web/src/tools/form-canvas/ui.tsx`:

1. Add imports at the top:

```tsx
import { ConfigForm } from "@rfjs/form-builder-ui";
import { cardsToFormConfig, jsonToCards } from "./model";
```

2. Delete the old local `serialize(groups, cards)` and `parse(obj)` functions and the `PreviewForm` + `PreviewField` components (they are replaced).

3. Inside `FormCanvasTool`, derive the live config once per render (place near the other derived values such as `selectedCard`):

```tsx
  const formConfig = cardsToFormConfig(groups, cards);
```

4. Replace `applyJson` body with the real parser:

```tsx
  function applyJson(text: string) {
    try {
      const { groups: g, cards: c } = jsonToCards(text);
      setGroups(g);
      setCards(c);
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "invalid config");
    }
  }
```

5. Replace `copyJson`'s and the textarea's serialized value to use the real config — change both `JSON.stringify(serialize(groups, cards), null, 2)` occurrences to:

```tsx
JSON.stringify(formConfig, null, 2)
```

6. Replace the Preview tab body (`tab === "preview" ? ( <PreviewForm .../> )`) with the engine renderer:

```tsx
      ) : tab === "preview" ? (
        <div className="rounded-xl border border-border bg-card/30 p-6">
          <ConfigForm config={formConfig} locale="en" onSubmit={() => {}} />
        </div>
      ) : (
```

7. Remove the now-unused `isWidePreview` / `useMediaQuery` only if they are no longer referenced (the mock preview was their sole consumer). If `useMediaQuery` becomes unused, delete it and its import-free helper to keep the file clean.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F web vitest:run src/tools/form-canvas/ui.spec.tsx`
Expected: PASS — Preview shows "Name" + a Submit button; JSON is a real `FormConfig` with `sections[0].layout.columns === 12`.

- [ ] **Step 5: Full typecheck + the tool registry spec (guards against regressions)**

Run: `pnpm -F @rfjs/form-builder build && pnpm -F web check-types && pnpm -F web vitest:run src/tools/index.spec.ts`
Expected: no type errors; registry spec (4 tests) green.

- [ ] **Step 6: Manual visual check (optional but recommended)**

Run: `pnpm --filter web exec next dev -p 3336` then open `http://localhost:3336/en/tools/form-canvas`, switch to Preview (real form with working validation on Submit) and JSON (real `FormConfig`). Drag a card, confirm Preview reflects the new layout.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/tools/form-canvas/ui.tsx apps/web/src/tools/form-canvas/ui.spec.tsx
git commit -m "feat(web): form-canvas previews real ConfigForm + emits real FormConfig

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Out of scope (follow-up plans)

These are deliberately deferred — the engine already supports them; they only need canvas inspector UI:

- **Inspector field config**: `conditional` (FilterMatchQuery), `validation` (min/max/length/pattern), Select/Radio `options[]` + `defaultValue`. (Cheap wins; one follow-up plan.)
- **Localized labels + locales**: `label: string | Record<locale,string>` editing, multi-locale preview.
- **Remote `dataSource` editing UI** in the canvas inspector + threading a `fetcher` into the preview `ConfigForm`.
- **Overlap / rowSpan policy**: the canvas currently allows overlapping cards and has no `rowSpan`; decide and enforce a clean-model policy (schema or a normalize pass).
- **Decide A's fate** (keep `form-builder` as the simple/linear tool vs retire it).

## Self-Review notes

- **Spec coverage:** Tasks 1–2 = EXTEND engine (types+schema) + renderer (the report's recommended path, steps 1–3). Task 3–4 = make the canvas real (report step 4). Behavioral subsystems (validation/conditional/dataSource) are reused unchanged — confirmed layout-independent by the review.
- **Strip-mode guard:** Task 1 Step 1 round-trip test + Step 4 schema mirror — the report's #1 risk is covered.
- **Backward compatibility:** grid branch is gated on `section.layout` presence; all flow tests in `config-form.spec.tsx` stay green (Task 2 Step 5).
- **Type consistency:** `GridPlacement`/`SectionLayout`/`FormSection.layout` defined in Task 1 and consumed verbatim in Tasks 2–3; `cardsToFormConfig`/`formConfigToCards`/`jsonToCards` defined in Task 3 and consumed in Task 4.
