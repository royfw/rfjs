# Data Filter Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a dedicated `data-filter-builder` tool in `apps/web` — a visual in-memory filter builder over sample JSON with live matched results — per `docs/superpowers/specs/2026-06-18-data-filter-builder-design.md`.

**Architecture:** A `"use client"` tool that wires existing pieces: `@rfjs/filter-builder` (schema inference, live match, canonical tree ↔ FilterGroup), `@rfjs/filter-builder-ui` `FilterTreeEditor`, and `@rfjs/web-ui` primitives. New code is the layout shell plus two presentational sub-components (metadata strip, data panel). The `data-filter` engine is fixed — no toggle.

**Tech Stack:** Next.js (React 19), TypeScript, Tailwind v4 + `@rfjs/web-ui` (Seam tokens), Vitest + @testing-library/react, next-intl.

## Global Constraints

- Tool surface is `web`; reuse the existing registry id `data-filter-builder` (do not invent a new id).
- All controls use `@rfjs/web-ui` primitives — no native `<select>`/`<input>`/`<textarea>`.
- Files use double quotes and `"use client"` for interactive components (match `apps/web/src/tools/*` convention).
- i18n: every visible string goes through `useTranslations`; add keys to both `en` and `zh-TW` in the tool's `messages.ts`.
- Each task ends green: `pnpm -F web check-types`, `pnpm -F web lint`, `pnpm -F web test` must pass before commit.

## File Structure

```
apps/web/src/tools/data-filter-builder/
  index.ts                 # ToolModule descriptor { id: "data-filter-builder", Component }
  messages.ts              # LocaleMessages (en + zh-TW): Tools["data-filter-builder"] + ToolUI keys
  ui.tsx                   # "use client" — DataFilterBuilder: state + data flow + layout A
  ui/metadata-strip.tsx    # field chips + per-field type editor (Select) + include toggle + "infer"
  ui/data-panel.tsx        # collapsible drawer → tabs: matched (Table) / raw (Table) / canonical JSON
  metadata-strip.spec.tsx
  data-panel.spec.tsx
packages/web-core/src/registry/tools.ts   # flip data-filter-builder: surface web, status preview, +@rfjs/filter-builder
apps/web/src/tools/index.ts               # register tool module
apps/web/src/tools/messages.ts (aggregator, sibling of index.ts)  # register messages
apps/web/src/tools/index.spec.ts          # update expected web-tool id set
```

---

### Task 1: Register the tool (catalog + module + messages)

**Files:**
- Modify: `packages/web-core/src/registry/tools.ts` (the `data-filter-builder` entry)
- Create: `apps/web/src/tools/data-filter-builder/index.ts`, `messages.ts`, and a stub `ui.tsx`
- Modify: `apps/web/src/tools/index.ts`, the messages aggregator, `apps/web/src/tools/index.spec.ts`

**Interfaces:**
- Produces: `tool: ToolModule` (`{ id: "data-filter-builder", Component }`); `messages: LocaleMessages`.

- [ ] **Step 1: Update the failing registry expectation**

In `apps/web/src/tools/index.spec.ts`, add `"data-filter-builder"` to the expected web-tool id set asserted by "registers exactly the expected web tools".

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm -F web test -- src/tools/index.spec.ts`
Expected: FAIL (component/registry id sets don't include `data-filter-builder`).

- [ ] **Step 3: Flip the registry entry**

In `packages/web-core/src/registry/tools.ts`, change the `data-filter-builder` object to:
```ts
{
  id: 'data-filter-builder',
  category: 'filter',
  surface: 'web',
  status: 'preview',
  relatedPackages: ['@rfjs/data-filter', '@rfjs/filter-builder'],
  tags: ['builder', 'playground'],
},
```

- [ ] **Step 4: Create the module + stub UI + messages**

`apps/web/src/tools/data-filter-builder/ui.tsx`:
```tsx
"use client";
export function DataFilterBuilder() {
  return <div data-slot="data-filter-builder" />;
}
```
`apps/web/src/tools/data-filter-builder/index.ts`:
```ts
import type { ToolModule } from "@/tools/types";

import { DataFilterBuilder } from "./ui";

export const tool: ToolModule = { id: "data-filter-builder", Component: DataFilterBuilder };
```
`apps/web/src/tools/data-filter-builder/messages.ts` — `LocaleMessages` with `Tools["data-filter-builder"].{title,description}` and an initially small `ToolUI` block, for both `en` and `zh-TW` (title e.g. "Data Filter Builder" / "資料過濾建構器").

- [ ] **Step 5: Wire into the aggregators**

Add `import { tool as dataFilterBuilder } from "./data-filter-builder";` and include `dataFilterBuilder` in `toolModules` (`apps/web/src/tools/index.ts`). Do the mirror registration in the messages aggregator (the sibling file that merges each tool's `messages`).

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm -F web test && pnpm -F web check-types && pnpm -F web lint`
Expected: PASS (registry + message-aggregator coverage tests green).

- [ ] **Step 7: Commit**

```bash
git add packages/web-core/src/registry/tools.ts apps/web/src/tools/data-filter-builder apps/web/src/tools/index.ts apps/web/src/tools/messages.ts apps/web/src/tools/index.spec.ts
git commit -m "feat(web): register data-filter-builder tool (stub)"
```

---

### Task 2: Metadata strip (field chips + type editor)

**Files:**
- Create: `apps/web/src/tools/data-filter-builder/ui/metadata-strip.tsx`, `metadata-strip.spec.tsx`

**Interfaces:**
- Consumes: `FieldSchema` from `@rfjs/filter-builder`; `Select*`/`Button` from `@rfjs/web-ui`.
- Produces: `MetadataStrip({ schema, onChange, onInfer, labels })` where `onChange(next: FieldSchema[])`, `onInfer()` triggers field inference, `labels` carries i18n strings. Renders one chip per field showing `path` + a `Select` of `dataType` and an include toggle.

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetadataStrip } from "./metadata-strip";

const schema = [{ path: "age", dataType: "numeric", include: true, kind: "jsonb" }] as any;

describe("MetadataStrip", () => {
  it("renders a chip per field", () => {
    render(<MetadataStrip schema={schema} onChange={vi.fn()} onInfer={vi.fn()} labels={{ infer: "infer" }} />);
    expect(screen.getByText("age")).toBeDefined();
  });
  it("invokes onInfer", () => {
    const onInfer = vi.fn();
    render(<MetadataStrip schema={schema} onChange={vi.fn()} onInfer={onInfer} labels={{ infer: "infer" }} />);
    fireEvent.click(screen.getByText("infer"));
    expect(onInfer).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm -F web test -- src/tools/data-filter-builder/metadata-strip.spec.tsx` → FAIL (module not found).

- [ ] **Step 3: Implement `metadata-strip.tsx`**

A `"use client"` component: map `schema` to chips (fixed-size, per the spec's `118×26` look — but rely on `@rfjs/web-ui` tokens/classes, not raw values where a primitive exists); each chip pairs the field path with a `Select` bound to `dataType` (options: string/numeric/date/boolean/object/array) that calls `onChange` with the updated field; an include toggle (`Checkbox`); and a trailing `Button variant="ghost"` calling `onInfer`. Do not expose jsonb/column `kind`.

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Commit** — `feat(web): data-filter-builder metadata strip`.

---

### Task 3: Data panel (collapsible, matched/raw/JSON tabs)

**Files:**
- Create: `apps/web/src/tools/data-filter-builder/ui/data-panel.tsx`, `data-panel.spec.tsx`

**Interfaces:**
- Consumes: `Table*`, `Button`, `Textarea` from `@rfjs/web-ui`.
- Produces: `DataPanel({ rows, matched, canonicalJson, onCanonicalChange, error, labels })`. Collapsed by default showing `原始 N · 命中 M`; expands to a full-width section with tabs `matched` / `raw` (each a `Table` over the row objects' keys) and a `json` tab (`Textarea` bound to `canonicalJson`, `onCanonicalChange` for reverse-parse, shows `error` inline).

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataPanel } from "./data-panel";

const labels = { data: "data", raw: "raw", matched: "matched", json: "json" };

describe("DataPanel", () => {
  it("shows counts and expands", () => {
    render(<DataPanel rows={[{ name: "Ada" }]} matched={[{ name: "Ada" }]} canonicalJson="{}" onCanonicalChange={vi.fn()} error={null} labels={labels} />);
    fireEvent.click(screen.getByText(/data/i));
    expect(screen.getByRole("columnheader", { name: "name" })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL (module not found).

- [ ] **Step 3: Implement `data-panel.tsx`** — collapsible (local `open` state), tabs via simple state, `Table` built from `Object.keys(rows[0] ?? {})`, JSON tab uses `Textarea` (`font-mono`). Count line uses `matched.length`/`rows.length`.

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Commit** — `feat(web): data-filter-builder data panel`.

---

### Task 4: Assemble `DataFilterBuilder` (state + data flow + layout A)

**Files:**
- Modify: `apps/web/src/tools/data-filter-builder/ui.tsx`
- Create: `apps/web/src/tools/data-filter-builder/ui.spec.tsx`

**Interfaces:**
- Consumes: `inferSchema`, `emptyGroup`, `addInferredField`, `mergeFieldsFromTree`, `treeToFilterGroup`, `parseFilterGroup`, `filterGroupToTree`, `runLiveMatch` from `@rfjs/filter-builder`; `FilterTreeEditor` from `@rfjs/filter-builder-ui`; `MetadataStrip`, `DataPanel`.

- [ ] **Step 1: Write the failing test** — render `DataFilterBuilder`, assert the builder + a known sample field render.

```tsx
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { DataFilterBuilder } from "./ui";
import { messages } from "./messages";

describe("DataFilterBuilder", () => {
  it("renders the builder over the default sample", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages.en as any}>
        <DataFilterBuilder />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("name")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL (stub renders nothing).

- [ ] **Step 3: Implement the assembly** — port the data-filter-only logic from the existing `query-builder/ui/index.tsx` (drop the engine toggle and all non-`data-filter` branches): default SAMPLE JSON, `inferSchema`, `emptyGroup`, `FilterTreeEditor` (engineId fixed `"data-filter"`), `runLiveMatch(rows, tree)`, `treeToFilterGroup` → canonical JSON, `parseFilterGroup`/`filterGroupToTree` for reverse edit. Lay out per spec Direction A: app bar, `MetadataStrip`, the `FilterTreeEditor` as the centered hero, `DataPanel` collapsible. Use Seam tokens + `@rfjs/web-ui` primitives.

- [ ] **Step 4: Run tests** → PASS; then `pnpm -F web check-types && pnpm -F web lint`.

- [ ] **Step 5: Commit** — `feat(web): assemble data-filter-builder (layout + live match)`.

---

### Task 5: Complete i18n + full verification

**Files:**
- Modify: `apps/web/src/tools/data-filter-builder/messages.ts` (all `ToolUI` keys used by the components)

- [ ] **Step 1:** Fill every label key referenced in Tasks 2–4 for both `en` and `zh-TW`.
- [ ] **Step 2:** Run `pnpm -F web test && pnpm -F web check-types && pnpm -F web lint` → all PASS.
- [ ] **Step 3:** Run `pnpm -F web build` → succeeds (RSC boundaries OK).
- [ ] **Step 4: Commit** — `feat(web): data-filter-builder i18n + verify build`.

---

### Task 6: Visual polish pass (frontend-design)

**Files:** `apps/web/src/tools/data-filter-builder/**`

**REQUIRED SUB-SKILL:** Use the `frontend-design` skill for this task.

- [ ] **Step 1:** Using the approved mockup (`.superpowers/brainstorm/<session>/content/layout-v2.html`, option A) as reference, refine spacing, the nested-group framing/badges, chip sizing, the data-drawer expand interaction, and overall hierarchy — staying within Seam tokens and the `@rfjs/web-ui` primitives.
- [ ] **Step 2:** Re-run `pnpm -F web check-types && lint && test && build` → all PASS.
- [ ] **Step 3: Commit** — `style(web): polish data-filter-builder visuals`.

---

## Self-Review

- **Spec coverage:** IA/registry → Task 1; metadata converter → Task 2; data panel (matched/raw/JSON, reverse-parse) → Task 3; layout A + data flow + customizations → Task 4; i18n + build → Task 5; visual polish (frontend-design) → Task 6. ✓
- **Placeholders:** none — each task has concrete files, test code, and commit.
- **Type consistency:** `FieldSchema`, `runLiveMatch`, `treeToFilterGroup`, `parseFilterGroup`, `filterGroupToTree` are the exact names used in the current `query-builder/ui/index.tsx`. Component prop names (`schema/onChange/onInfer`, `rows/matched/canonicalJson/onCanonicalChange`) are consistent across Tasks 2–4.
