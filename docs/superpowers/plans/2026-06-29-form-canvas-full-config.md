# Form-Canvas Full Config (Stream A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the `form-canvas` tool's right-hand editor to full parity with the engine `FieldConfig` — validation, Select options + defaultValue, conditional display (full nested and/or/nor/not tree), dataSource, multi-locale labels, AI note — plus per-kind config for content/spacer. All controls are **new, canvas-native** components (no reuse of the A-builder editors), housed in a wider scrollable settings panel (full-screen sheet on mobile).

**Architecture:** Extend the canvas `Card` model (and `model.ts` mappers) to carry the full config, round-tripping 1:1 with the engine. Replace the cramped `Inspector` with a `SettingsPanel` of collapsible sections; each section is a focused control under `apps/web/src/tools/form-canvas/inspector/`. Controls are pure `(value, onChange)` editors patching a slice of the selected `Card`. The live `ConfigForm` preview + JSON already reflect the `Card`s via `cardsToFormConfig`, so new config shows up automatically.

**Tech Stack:** TypeScript 5.7+, React 19, Vitest + @testing-library/react, Next.js (`apps/web`). Engine types from `@rfjs/form-builder` (built dist).

## Global Constraints

- Worktree `feat-form-canvas-config` (branch off `origin/main` @ 77c34d3, includes the merged collision fix #210). Run `pnpm install` then `pnpm build:packages` once at start (fresh worktree needs `@rfjs/*` dist, else web check-types fails on `@rfjs/jwt`).
- All config round-trips 1:1 with the engine `FieldConfig` — no feature reduction. Conditional is the **full nested** `and/or/nor/not` tree. Locales = the app's configured set (`en`, `zh-TW`).
- Controls are **canvas-native** (built here), not the `@rfjs/form-builder-ui` editors.
- Engine `FieldConfig` fields: `key, label (string | Record<locale,string>), component, dataType, required?, placeholder?, defaultValue?, options?: {label,value}[], width?, validation?: {min,max,minLength,maxLength,pattern,message}, conditional?: ConditionalRule, dataSource?: DataSource, aiNote?` (FieldItem). `ConditionalRule` = `{ logic:'and'|'or'|'nor'|'not', filters: (Condition|ConditionalRule)[] }`, `Condition` = `{ field, dataType, operator, value? }`. `DataSource` = `{ request:{url,method?,headers?,body?}, extract:{dialect:'path'|'jsonata'|'jsonpath', expr}, fallback?, optionLabel?, optionValue? }`.
- Co-locate `*.spec.ts(x)`. New-spec files need jsdom shims (pointer capture / scrollIntoView / ResizeObserver) — copy the block from `packages/form-builder-ui/src/config-form-builder.spec.tsx` top when a control uses a Radix Select; plain `<select>`/inputs don't need it.
- Conventional commits, lowercase subject ≤100 chars; body ends with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. No changeset. Watch `--max-warnings 0` (no unused imports/vars).
- DRY/YAGNI/TDD, commit per task. After each task: `pnpm -F web vitest:run <spec>` + `pnpm -F web check-types`.

---

### Task 1: Extend the `Card` model + mappers (round-trip full config)

**Files:**
- Modify: `apps/web/src/tools/form-canvas/model.ts`
- Modify: `apps/web/src/tools/form-canvas/ui.tsx` (2 label-display sites → `cardLabel` so it compiles)
- Test: `apps/web/src/tools/form-canvas/model.spec.ts`

**Interfaces:**
- Produces: extended `Card` (adds `defaultValue?`, `options?`, `validation?`, `conditional?`, `dataSource?`, `aiNote?`, `locked?`, `size?`, and `label: LocalizedLabel`); `cardLabel(label: LocalizedLabel, locale?: string): string`; mappers round-trip every field.

- [ ] **Step 1: Write the failing test** — append to `apps/web/src/tools/form-canvas/model.spec.ts`:

```ts
import { cardLabel } from "./model";
describe("full-config round-trip", () => {
  const groups: Group[] = [{ id: "g1", title: "G", collapsed: false }];
  const rich: Card = {
    id: "f1", groupId: "g1", kind: "field", label: { en: "Email", "zh-TW": "電郵" },
    key: "email", component: "Select", required: true, placeholder: "pick",
    defaultValue: "a", options: [{ label: "A", value: "a" }, { label: "B", value: "b" }],
    validation: { minLength: 2, pattern: "^.+$", message: "bad" },
    conditional: { logic: "and", filters: [{ field: "role", dataType: "string", operator: "eq", value: "admin" }] },
    dataSource: { request: { url: "/api/x" }, extract: { dialect: "path", expr: "data" }, optionLabel: "name", optionValue: "id" },
    aiNote: "fill carefully", col: 1, span: 6, row: 1,
  };
  it("round-trips every field through FormConfig", () => {
    const back = formConfigToCards(cardsToFormConfig(groups, [rich])).cards[0]!;
    expect(back.label).toEqual({ en: "Email", "zh-TW": "電郵" });
    expect(back.required).toBe(true);
    expect(back.defaultValue).toBe("a");
    expect(back.options).toEqual([{ label: "A", value: "a" }, { label: "B", value: "b" }]);
    expect(back.validation).toEqual({ minLength: 2, pattern: "^.+$", message: "bad" });
    expect(back.conditional!.logic).toBe("and");
    expect(back.dataSource!.request.url).toBe("/api/x");
    expect(back.aiNote).toBe("fill carefully");
  });
  it("round-trips content locked + spacer size", () => {
    const cards: Card[] = [
      { id: "c1", groupId: "g1", kind: "content", label: "Hi", locked: true, col: 1, span: 12, row: 1 },
      { id: "s1", groupId: "g1", kind: "spacer", label: "Spacer", size: "lg", col: 1, span: 12, row: 2 },
    ];
    const back = formConfigToCards(cardsToFormConfig(groups, cards)).cards;
    expect(back.find((c) => c.id === "c1")!.locked).toBe(true);
    expect(back.find((c) => c.id === "s1")!.size).toBe("lg");
  });
  it("cardLabel resolves localized + string labels", () => {
    expect(cardLabel({ en: "Hi", "zh-TW": "嗨" }, "zh-TW")).toBe("嗨");
    expect(cardLabel("Plain", "en")).toBe("Plain");
    expect(cardLabel({ "zh-TW": "嗨" }, "en")).toBe("嗨"); // falls back to first value
  });
});
```

- [ ] **Step 2: Run → fail** — `pnpm -F web vitest:run src/tools/form-canvas/model.spec.ts` → FAIL (fields stripped / `cardLabel` undefined).

- [ ] **Step 3: Implement** — edit `apps/web/src/tools/form-canvas/model.ts`:

Update the import line to add the engine config types:
```ts
import {
  parseFormConfig,
  type FormConfig, type FormItem, type FormSection, type ScalarType,
  type LocalizedLabel, type FieldOption, type FieldValidation, type ConditionalRule, type DataSource,
} from "@rfjs/form-builder";
```

Extend `Card` (replace the interface):
```ts
export interface Card {
  id: string;
  groupId: string;
  kind: Kind;
  label: LocalizedLabel;
  key?: string;
  component?: Component;
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: FieldOption[];
  validation?: FieldValidation;
  conditional?: ConditionalRule;
  dataSource?: DataSource;
  aiNote?: string;
  locked?: boolean; // content
  size?: "sm" | "md" | "lg"; // spacer
  col: number;
  span: number;
  row: number;
}
```

Add the label resolver (export, after the `Card`/`Group` interfaces):
```ts
export function cardLabel(label: LocalizedLabel, locale = "en"): string {
  if (typeof label === "string") return label;
  return label[locale] ?? Object.values(label)[0] ?? "";
}
```

Rewrite `cardToItem` to carry the full config:
```ts
function cardToItem(c: Card): FormItem {
  switch (c.kind) {
    case "field":
      return {
        id: c.id, kind: "field", key: c.key ?? c.id, label: c.label,
        component: c.component ?? "Input", dataType: DATATYPE[c.component ?? "Input"] ?? "string",
        ...(c.required ? { required: true } : {}),
        ...(c.placeholder ? { placeholder: c.placeholder } : {}),
        ...(c.defaultValue !== undefined ? { defaultValue: c.defaultValue } : {}),
        ...(c.options ? { options: c.options } : {}),
        ...(c.validation ? { validation: c.validation } : {}),
        ...(c.conditional ? { conditional: c.conditional } : {}),
        ...(c.dataSource ? { dataSource: c.dataSource } : {}),
        ...(c.aiNote ? { aiNote: c.aiNote } : {}),
      };
    case "content":
      return { id: c.id, kind: "content", text: c.label, ...(c.locked ? { locked: true } : {}) };
    case "ai-note":
      return { id: c.id, kind: "ai-note", text: cardLabel(c.label) };
    case "divider":
      return { id: c.id, kind: "divider" };
    case "spacer":
      return { id: c.id, kind: "spacer", ...(c.size ? { size: c.size } : {}) };
  }
}
```

Rewrite the field/content/spacer branches of `formConfigToCards` to preserve the new fields (replace the `if (item.kind === "field")` block and the else-branches):
```ts
      if (item.kind === "field") {
        const rawComponent = item.component;
        const component = (rawComponent && CANVAS_COMPONENT_SET.has(rawComponent) ? rawComponent : "Input") as Component;
        cards.push({
          ...base, kind: "field", label: item.label, key: item.key, component,
          required: item.required, placeholder: item.placeholder,
          defaultValue: item.defaultValue, options: item.options, validation: item.validation,
          conditional: item.conditional, dataSource: item.dataSource, aiNote: item.aiNote,
        });
      } else if (item.kind === "content") {
        cards.push({ ...base, kind: "content", label: item.text, locked: item.locked });
      } else if (item.kind === "ai-note") {
        cards.push({ ...base, kind: "ai-note", label: item.text });
      } else {
        cards.push({ ...base, kind: item.kind, label: item.kind === "divider" ? "Divider" : "Spacer", ...(item.kind === "spacer" ? { size: item.size } : {}) });
      }
```
(Note: `label: item.label` now preserves the `LocalizedLabel` object/string verbatim; `labelToString` is no longer used for field labels — keep it for the group title only, or remove if it becomes unused.)

In `apps/web/src/tools/form-canvas/ui.tsx`, the two sites that render `card.label` as a string must use `cardLabel`:
- Add `cardLabel` to the existing `./model` import.
- Line ~471 (CanvasCard summary): replace `{card.label}` with `{cardLabel(card.label)}`.
- The Basics "Label" input (Inspector, ~line 532) is replaced in Task 2; for now change its `value={card.label}` to `value={cardLabel(card.label)}` and `onChange={(e) => onChange({ label: e.target.value })}` stays (sets a plain string — valid `LocalizedLabel`).

- [ ] **Step 4: Run → pass** — `pnpm -F web vitest:run src/tools/form-canvas/model.spec.ts` → PASS. Then `pnpm -F web check-types` → clean.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/tools/form-canvas/model.ts apps/web/src/tools/form-canvas/model.spec.ts apps/web/src/tools/form-canvas/ui.tsx
git commit -m "feat(form-canvas): extend Card model to carry full field config

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Settings-panel shell — collapsible `Section` + wider/RWD panel + Basics

**Files:**
- Create: `apps/web/src/tools/form-canvas/inspector/section.tsx`
- Create: `apps/web/src/tools/form-canvas/inspector/settings-panel.tsx` (the `SettingsPanel` — Basics section moved out of `Inspector`)
- Modify: `apps/web/src/tools/form-canvas/ui.tsx` (replace `Inspector` usage with `SettingsPanel`; widen `aside`; mobile sheet; delete the old `Inspector` function + its now-unused `COMPONENTS`/`input` if moved)
- Test: `apps/web/src/tools/form-canvas/inspector/settings-panel.spec.tsx`

**Interfaces:**
- Consumes: `Card`, `Group`, `Component`, `cardLabel` from `../model`.
- Produces: `<Section title defaultOpen?>{children}</Section>`; `<SettingsPanel card groups onChange onRemove />` rendering kind-appropriate sections (Basics for all; field-only sections are wired in later tasks). `INPUT_CLS` shared input class exported from `settings-panel.tsx` for reuse by control tasks.

- [ ] **Step 1: Write the failing test** — `apps/web/src/tools/form-canvas/inspector/settings-panel.spec.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsPanel } from "./settings-panel";
import type { Card } from "../model";

const field: Card = { id: "f1", groupId: "g1", kind: "field", label: "Name", key: "name", component: "Input", col: 1, span: 6, row: 1 };

describe("SettingsPanel", () => {
  it("shows empty hint with no card", () => {
    render(<SettingsPanel card={null} groups={[]} onChange={() => {}} onRemove={() => {}} />);
    expect(screen.getByText(/select a card/i)).toBeTruthy();
  });
  it("edits the basics label", () => {
    const onChange = vi.fn();
    render(<SettingsPanel card={field} groups={[{ id: "g1", title: "G", collapsed: false }]} onChange={onChange} onRemove={() => {}} />);
    fireEvent.change(screen.getByLabelText(/^label$/i), { target: { value: "Full name" } });
    expect(onChange).toHaveBeenCalledWith({ label: "Full name" });
  });
  it("collapses a section when its header is clicked", () => {
    render(<SettingsPanel card={field} groups={[{ id: "g1", title: "G", collapsed: false }]} onChange={() => {}} onRemove={() => {}} />);
    const basics = screen.getByRole("button", { name: /basics/i });
    fireEvent.click(basics); // collapse
    expect(screen.queryByLabelText(/^label$/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail** — `pnpm -F web vitest:run src/tools/form-canvas/inspector/settings-panel.spec.tsx` → FAIL (modules missing).

- [ ] **Step 3: Implement `section.tsx`**:
```tsx
"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";

export function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
        {title}
      </button>
      {open ? <div className="flex flex-col gap-2 border-t border-border p-3">{children}</div> : null}
    </div>
  );
}
```

- [ ] **Step 4: Implement `settings-panel.tsx`** (Basics section; placeholders for field-only sections wired in later tasks):
```tsx
"use client";
import * as React from "react";
import { Trash2 } from "lucide-react";
import { Section } from "./section";
import { cardLabel, type Card, type Group, type Component } from "../model";

export const INPUT_CLS = "h-8 w-full rounded-md border border-input bg-background px-2 text-sm";
const COMPONENTS: Component[] = ["Input", "Textarea", "Select", "Number", "Switch", "DatePicker"];
const COLS = 12;

export function SettingsPanel({
  card, groups, onChange, onRemove,
}: { card: Card | null; groups: Group[]; onChange: (p: Partial<Card>) => void; onRemove: () => void }) {
  if (!card) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/20 p-6 text-center text-sm text-muted-foreground">
        Select a card to edit its config
      </div>
    );
  }
  const isField = card.kind === "field";
  return (
    <div className="flex flex-col gap-3">
      <Section title="Basics">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Label
          <input className={INPUT_CLS} value={cardLabel(card.label)} onChange={(e) => onChange({ label: e.target.value })} />
        </label>
        {isField ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Key
              <input className={`${INPUT_CLS} font-mono`} value={card.key ?? ""} onChange={(e) => onChange({ key: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Component
              <select className={INPUT_CLS} value={card.component ?? "Input"} onChange={(e) => onChange({ component: e.target.value as Component })}>
                {COMPONENTS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Placeholder
              <input className={INPUT_CLS} value={card.placeholder ?? ""} onChange={(e) => onChange({ placeholder: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={Boolean(card.required)} onChange={(e) => onChange({ required: e.target.checked })} />
              Required
            </label>
          </>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Width (cols)
            <select className={INPUT_CLS} value={card.span} onChange={(e) => onChange({ span: Number(e.target.value) })}>
              {Array.from({ length: COLS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Group
            <select className={INPUT_CLS} value={card.groupId} onChange={(e) => onChange({ groupId: e.target.value })}>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </label>
        </div>
      </Section>

      {/* Field-only sections (Validation, Options, Conditional, Data Source, Labels, AI Note) are
          added in later tasks. Content/Spacer sections too. */}

      <button
        type="button"
        onClick={onRemove}
        className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
        Delete card
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Wire into `ui.tsx`** — replace the `Inspector` usage and widen + mobile-sheet the panel. Replace the existing `<aside className="shrink-0 lg:w-80"><Inspector …/></aside>` block with:
```tsx
            <aside className="shrink-0 lg:w-[420px]">
              {/* Mobile: full-screen sheet when a card is selected; Desktop: inline column. */}
              <div
                className={
                  selectedCard
                    ? "fixed inset-0 z-30 overflow-y-auto bg-background p-4 lg:static lg:z-auto lg:bg-transparent lg:p-0"
                    : "hidden lg:block"
                }
              >
                {selectedCard ? (
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="mb-3 text-xs text-muted-foreground hover:text-foreground lg:hidden"
                  >
                    ← Back to canvas
                  </button>
                ) : null}
                <SettingsPanel
                  card={selectedCard}
                  groups={groups}
                  onChange={(p) => selectedCard && updateCard(selectedCard.id, p)}
                  onRemove={() => {
                    if (!selectedCard) return;
                    setCards((cs) => resolveCards(cs.filter((c) => c.id !== selectedCard.id) as Card[], "", COLS) as Card[]);
                    setSelected(null);
                  }}
                />
              </div>
            </aside>
```
Add the import `import { SettingsPanel } from "./inspector/settings-panel";`. Delete the old `Inspector` function and any of its now-unused locals (the module-level `COMPONENTS` in ui.tsx if it's now only used there — check; if `CanvasCard` still needs it, keep). Keep `cardLabel` import (Task 1). Run `pnpm -F web check-types` and remove any newly-unused symbols.

- [ ] **Step 6: Run tests + typecheck** — `pnpm -F web vitest:run src/tools/form-canvas/inspector/settings-panel.spec.tsx src/tools/form-canvas/ui.spec.tsx` → PASS; `pnpm -F web check-types` → clean.

- [ ] **Step 7: Commit**
```bash
git add apps/web/src/tools/form-canvas/inspector/ apps/web/src/tools/form-canvas/ui.tsx
git commit -m "feat(form-canvas): settings panel shell with collapsible sections

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Validation control

**Files:**
- Create: `apps/web/src/tools/form-canvas/inspector/validation.tsx`
- Modify: `settings-panel.tsx` (render `<ValidationSection>` for fields)
- Test: `apps/web/src/tools/form-canvas/inspector/validation.spec.tsx`

**Interfaces:**
- Consumes: `Card`, `INPUT_CLS`. Engine `FieldValidation`.
- Produces: `<ValidationSection card onChange />` editing `card.validation`. Numeric `min`/`max` shown when `dataType` is numeric (component Number); `minLength`/`maxLength`/`pattern` for string-ish; `message` always.

- [ ] **Step 1: Write the failing test** — `validation.spec.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ValidationSection } from "./validation";
import type { Card } from "../model";

const numField: Card = { id: "f", groupId: "g", kind: "field", label: "Age", key: "age", component: "Number", col: 1, span: 6, row: 1 };
const strField: Card = { ...numField, component: "Input", label: "Name", key: "name" };

describe("ValidationSection", () => {
  it("sets min for a numeric field", () => {
    const onChange = vi.fn();
    render(<ValidationSection card={numField} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/^min$/i), { target: { value: "18" } });
    expect(onChange).toHaveBeenCalledWith({ validation: { min: 18 } });
  });
  it("sets pattern + message for a string field, merging existing validation", () => {
    const onChange = vi.fn();
    render(<ValidationSection card={{ ...strField, validation: { minLength: 2 } }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/pattern/i), { target: { value: "^a" } });
    expect(onChange).toHaveBeenCalledWith({ validation: { minLength: 2, pattern: "^a" } });
  });
  it("shows minLength (string) not min for a string field", () => {
    render(<ValidationSection card={strField} onChange={() => {}} />);
    expect(screen.queryByLabelText(/^min$/i)).toBeNull();
    expect(screen.getByLabelText(/min length/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run → fail** — `pnpm -F web vitest:run src/tools/form-canvas/inspector/validation.spec.tsx` → FAIL.

- [ ] **Step 3: Implement `validation.tsx`**:
```tsx
"use client";
import * as React from "react";
import type { FieldValidation } from "@rfjs/form-builder";
import { INPUT_CLS } from "./settings-panel";
import type { Card } from "../model";

export function ValidationSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  const v = card.validation ?? {};
  const numeric = card.component === "Number";
  const set = (patch: Partial<FieldValidation>) => {
    const next: FieldValidation = { ...v, ...patch };
    // drop keys set back to undefined/empty
    (Object.keys(next) as (keyof FieldValidation)[]).forEach((k) => {
      if (next[k] === undefined || next[k] === "") delete next[k];
    });
    onChange({ validation: Object.keys(next).length ? next : undefined });
  };
  const numField = (key: "min" | "max" | "minLength" | "maxLength", label: string) => (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input
        type="number" className={INPUT_CLS} value={v[key] ?? ""}
        onChange={(e) => set({ [key]: e.target.value === "" ? undefined : Number(e.target.value) } as Partial<FieldValidation>)}
      />
    </label>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {numeric ? numField("min", "Min") : numField("minLength", "Min length")}
      {numeric ? numField("max", "Max") : numField("maxLength", "Max length")}
      {!numeric ? (
        <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">
          Pattern (regex)
          <input className={`${INPUT_CLS} font-mono`} value={v.pattern ?? ""} onChange={(e) => set({ pattern: e.target.value || undefined })} />
        </label>
      ) : null}
      <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">
        Error message
        <input className={INPUT_CLS} value={v.message ?? ""} onChange={(e) => set({ message: e.target.value || undefined })} />
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Wire into `settings-panel.tsx`** — import `{ ValidationSection }` and, inside the field-only area (after Basics), add:
```tsx
      {isField ? <Section title="Validation" defaultOpen={false}><ValidationSection card={card} onChange={onChange} /></Section> : null}
```

- [ ] **Step 5: Run → pass + typecheck** — `pnpm -F web vitest:run src/tools/form-canvas/inspector/validation.spec.tsx` → PASS; `pnpm -F web check-types` clean.

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/tools/form-canvas/inspector/validation.tsx apps/web/src/tools/form-canvas/inspector/validation.spec.tsx apps/web/src/tools/form-canvas/inspector/settings-panel.tsx
git commit -m "feat(form-canvas): field validation control

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Options + defaultValue control

**Files:**
- Create: `apps/web/src/tools/form-canvas/inspector/options.tsx`
- Modify: `settings-panel.tsx` (render `<OptionsSection>` for Select fields)
- Test: `apps/web/src/tools/form-canvas/inspector/options.spec.tsx`

**Interfaces:**
- Consumes: `Card`, `INPUT_CLS`. Engine `FieldOption`.
- Produces: `<OptionsSection card onChange />` editing `card.options` (add/remove `{label,value}` rows) + a `defaultValue` `<select>` populated from options.

- [ ] **Step 1: Write the failing test** — `options.spec.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OptionsSection } from "./options";
import type { Card } from "../model";

const sel: Card = { id: "f", groupId: "g", kind: "field", label: "Role", key: "role", component: "Select", options: [{ label: "Admin", value: "admin" }], col: 1, span: 6, row: 1 };

describe("OptionsSection", () => {
  it("adds an option row", () => {
    const onChange = vi.fn();
    render(<OptionsSection card={sel} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /add option/i }));
    expect(onChange).toHaveBeenCalledWith({ options: [{ label: "Admin", value: "admin" }, { label: "", value: "" }] });
  });
  it("edits an option label", () => {
    const onChange = vi.fn();
    render(<OptionsSection card={sel} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue("Admin"), { target: { value: "Administrator" } });
    expect(onChange).toHaveBeenCalledWith({ options: [{ label: "Administrator", value: "admin" }] });
  });
  it("removes an option row", () => {
    const onChange = vi.fn();
    render(<OptionsSection card={sel} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /remove option/i }));
    expect(onChange).toHaveBeenCalledWith({ options: undefined });
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `options.tsx`**:
```tsx
"use client";
import * as React from "react";
import { Plus, X } from "lucide-react";
import type { FieldOption } from "@rfjs/form-builder";
import { INPUT_CLS } from "./settings-panel";
import type { Card } from "../model";

export function OptionsSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  const options = card.options ?? [];
  const setOptions = (next: FieldOption[]) => onChange({ options: next.length ? next : undefined });
  const update = (i: number, patch: Partial<FieldOption>) => setOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  return (
    <div className="flex flex-col gap-2">
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input aria-label={`option label ${i}`} className={INPUT_CLS} value={o.label} onChange={(e) => update(i, { label: e.target.value })} />
          <input aria-label={`option value ${i}`} className={`${INPUT_CLS} font-mono`} value={String(o.value)} onChange={(e) => update(i, { value: e.target.value })} />
          <button type="button" aria-label="remove option" className="text-muted-foreground hover:text-destructive" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button type="button" aria-label="add option" className="inline-flex items-center gap-1.5 self-start rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setOptions([...options, { label: "", value: "" }])}>
        <Plus className="size-3.5" /> Add option
      </button>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Default value
        <select className={INPUT_CLS} value={String(card.defaultValue ?? "")} onChange={(e) => onChange({ defaultValue: e.target.value || undefined })}>
          <option value="">— none —</option>
          {options.map((o, i) => <option key={i} value={String(o.value)}>{o.label || String(o.value)}</option>)}
        </select>
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Wire** — in `settings-panel.tsx`, import `{ OptionsSection }` and render for Select fields:
```tsx
      {isField && card.component === "Select" ? <Section title="Options" defaultOpen={false}><OptionsSection card={card} onChange={onChange} /></Section> : null}
```

- [ ] **Step 5: Run → pass + typecheck.**

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/tools/form-canvas/inspector/options.tsx apps/web/src/tools/form-canvas/inspector/options.spec.tsx apps/web/src/tools/form-canvas/inspector/settings-panel.tsx
git commit -m "feat(form-canvas): Select options + defaultValue control

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: AI Note + Content(locked) + Spacer(size) controls

**Files:**
- Create: `apps/web/src/tools/form-canvas/inspector/misc-sections.tsx` (small per-kind controls grouped in one file)
- Modify: `settings-panel.tsx`
- Test: `apps/web/src/tools/form-canvas/inspector/misc-sections.spec.tsx`

**Interfaces:**
- Produces: `<AiNoteSection card onChange />` (field; `card.aiNote` textarea), `<ContentSection card onChange />` (content; locked checkbox — label is edited in Basics), `<SpacerSection card onChange />` (spacer; size select).

- [ ] **Step 1: Write the failing test** — `misc-sections.spec.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiNoteSection, ContentSection, SpacerSection } from "./misc-sections";
import type { Card } from "../model";

const f: Card = { id: "f", groupId: "g", kind: "field", label: "X", key: "x", component: "Input", col: 1, span: 6, row: 1 };
const c: Card = { id: "c", groupId: "g", kind: "content", label: "Hi", col: 1, span: 12, row: 1 };
const s: Card = { id: "s", groupId: "g", kind: "spacer", label: "Spacer", col: 1, span: 12, row: 1 };

describe("misc sections", () => {
  it("AiNote sets aiNote", () => {
    const onChange = vi.fn();
    render(<AiNoteSection card={f} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/ai note/i), { target: { value: "hint" } });
    expect(onChange).toHaveBeenCalledWith({ aiNote: "hint" });
  });
  it("Content toggles locked", () => {
    const onChange = vi.fn();
    render(<ContentSection card={c} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/locked/i));
    expect(onChange).toHaveBeenCalledWith({ locked: true });
  });
  it("Spacer sets size", () => {
    const onChange = vi.fn();
    render(<SpacerSection card={s} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/size/i), { target: { value: "lg" } });
    expect(onChange).toHaveBeenCalledWith({ size: "lg" });
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `misc-sections.tsx`**:
```tsx
"use client";
import * as React from "react";
import { INPUT_CLS } from "./settings-panel";
import type { Card } from "../model";

export function AiNoteSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      AI note (not shown to fillers)
      <textarea className={`${INPUT_CLS} h-16 py-1.5`} value={card.aiNote ?? ""} onChange={(e) => onChange({ aiNote: e.target.value || undefined })} />
    </label>
  );
}
export function ContentSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <input type="checkbox" checked={Boolean(card.locked)} onChange={(e) => onChange({ locked: e.target.checked || undefined })} />
      Locked (preset, not editable by filler)
    </label>
  );
}
export function SpacerSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      Size
      <select className={INPUT_CLS} value={card.size ?? "md"} onChange={(e) => onChange({ size: e.target.value as "sm" | "md" | "lg" })}>
        <option value="sm">sm</option><option value="md">md</option><option value="lg">lg</option>
      </select>
    </label>
  );
}
```

- [ ] **Step 4: Wire** — in `settings-panel.tsx`, import the three and render by kind:
```tsx
      {isField ? <Section title="AI Note" defaultOpen={false}><AiNoteSection card={card} onChange={onChange} /></Section> : null}
      {card.kind === "content" ? <Section title="Content"><ContentSection card={card} onChange={onChange} /></Section> : null}
      {card.kind === "spacer" ? <Section title="Spacer"><SpacerSection card={card} onChange={onChange} /></Section> : null}
```

- [ ] **Step 5: Run → pass + typecheck.**

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/tools/form-canvas/inspector/misc-sections.tsx apps/web/src/tools/form-canvas/inspector/misc-sections.spec.tsx apps/web/src/tools/form-canvas/inspector/settings-panel.tsx
git commit -m "feat(form-canvas): ai-note, content-locked, spacer-size controls

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Multi-locale Labels control

**Files:**
- Create: `apps/web/src/tools/form-canvas/inspector/labels.tsx`
- Modify: `settings-panel.tsx` (add a Labels section; the Basics "Label" stays as a quick single-value editor for the default locale)
- Test: `apps/web/src/tools/form-canvas/inspector/labels.spec.tsx`

**Interfaces:**
- Consumes: `Card`, `INPUT_CLS`, `cardLabel`. `LocalizedLabel`.
- Produces: `<LabelsSection card onChange locales />` — per-locale inputs; editing any locale produces a `Record<locale,string>` label (or a plain string when only the default locale is set). `LOCALES = ["en", "zh-TW"]` constant exported here.

- [ ] **Step 1: Write the failing test** — `labels.spec.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LabelsSection } from "./labels";
import type { Card } from "../model";

const f: Card = { id: "f", groupId: "g", kind: "field", label: "Name", key: "n", component: "Input", col: 1, span: 6, row: 1 };

describe("LabelsSection", () => {
  it("setting zh-TW on a string label produces a record keeping en", () => {
    const onChange = vi.fn();
    render(<LabelsSection card={f} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/zh-TW/i), { target: { value: "姓名" } });
    expect(onChange).toHaveBeenCalledWith({ label: { en: "Name", "zh-TW": "姓名" } });
  });
  it("editing en on a record updates that locale", () => {
    const onChange = vi.fn();
    render(<LabelsSection card={{ ...f, label: { en: "Name", "zh-TW": "姓名" } }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/^en$/i), { target: { value: "Full name" } });
    expect(onChange).toHaveBeenCalledWith({ label: { en: "Full name", "zh-TW": "姓名" } });
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `labels.tsx`**:
```tsx
"use client";
import * as React from "react";
import type { LocalizedLabel } from "@rfjs/form-builder";
import { INPUT_CLS } from "./settings-panel";
import type { Card } from "../model";

export const LOCALES = ["en", "zh-TW"] as const;

function toRecord(label: LocalizedLabel): Record<string, string> {
  return typeof label === "string" ? { en: label } : { ...label };
}

export function LabelsSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  const rec = toRecord(card.label);
  const set = (loc: string, value: string) => {
    const next = { ...rec, [loc]: value };
    if (!value) delete next[loc];
    // collapse to a plain string when only the default locale remains
    const keys = Object.keys(next);
    onChange({ label: keys.length === 1 && keys[0] === "en" ? next.en! : next });
  };
  return (
    <div className="flex flex-col gap-2">
      {LOCALES.map((loc) => (
        <label key={loc} className="flex flex-col gap-1 text-xs text-muted-foreground">
          {loc}
          <input aria-label={loc} className={INPUT_CLS} value={rec[loc] ?? ""} onChange={(e) => set(loc, e.target.value)} />
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Wire** — in `settings-panel.tsx` add (for all kinds with a label, i.e. field/content/ai-note):
```tsx
      {card.kind !== "divider" && card.kind !== "spacer" ? <Section title="Labels (i18n)" defaultOpen={false}><LabelsSection card={card} onChange={onChange} /></Section> : null}
```

- [ ] **Step 5: Run → pass + typecheck.** Verify the Preview tab still renders (`pnpm -F web vitest:run src/tools/form-canvas/ui.spec.tsx`).

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/tools/form-canvas/inspector/labels.tsx apps/web/src/tools/form-canvas/inspector/labels.spec.tsx apps/web/src/tools/form-canvas/inspector/settings-panel.tsx
git commit -m "feat(form-canvas): multi-locale label control

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Conditional editor (full nested and/or/nor/not tree)

**Files:**
- Create: `apps/web/src/tools/form-canvas/inspector/conditional.tsx`
- Modify: `settings-panel.tsx`
- Test: `apps/web/src/tools/form-canvas/inspector/conditional.spec.tsx`

**Interfaces:**
- Consumes: `Card`, `INPUT_CLS`. Engine `ConditionalRule` = `{ logic, filters }`, where a filter is a `Condition` (`{ field, dataType, operator, value? }`) or a nested `ConditionalRule`.
- Produces: `<ConditionalSection card siblingKeys onChange />` — recursive editor. Each group: a logic `<select>` (and/or/nor/not), `+ condition` and `+ group` buttons, and a remove button (non-root). Each condition: field `<select>` (from `siblingKeys`), operator `<select>`, value `<input>`. Toggle "enabled" — when no conditional, an "Add condition" button creates `{ logic:'and', filters: [] }`.

- [ ] **Step 1: Write the failing test** — `conditional.spec.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConditionalSection } from "./conditional";
import type { Card } from "../model";

const f: Card = { id: "f", groupId: "g", kind: "field", label: "Manager", key: "manager", component: "Input", col: 1, span: 6, row: 1 };

describe("ConditionalSection", () => {
  it("enabling adds an empty and-group", () => {
    const onChange = vi.fn();
    render(<ConditionalSection card={f} siblingKeys={["role"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /enable condition/i }));
    expect(onChange).toHaveBeenCalledWith({ conditional: { logic: "and", filters: [] } });
  });
  it("adds a condition row to the root group", () => {
    const onChange = vi.fn();
    render(<ConditionalSection card={{ ...f, conditional: { logic: "and", filters: [] } }} siblingKeys={["role"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /add condition/i }));
    expect(onChange).toHaveBeenCalledWith({ conditional: { logic: "and", filters: [{ field: "role", dataType: "string", operator: "eq", value: "" }] } });
  });
  it("changes the root logic", () => {
    const onChange = vi.fn();
    render(<ConditionalSection card={{ ...f, conditional: { logic: "and", filters: [] } }} siblingKeys={["role"]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/group logic/i), { target: { value: "or" } });
    expect(onChange).toHaveBeenCalledWith({ conditional: { logic: "or", filters: [] } });
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `conditional.tsx`**:
```tsx
"use client";
import * as React from "react";
import { Plus, X } from "lucide-react";
import type { ConditionalRule } from "@rfjs/form-builder";
import { INPUT_CLS } from "./settings-panel";
import type { Card } from "../model";

type Condition = { field: string; dataType: string; operator: string; value?: unknown };
type Filter = Condition | ConditionalRule;
const LOGICS = ["and", "or", "nor", "not"] as const;
const OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in"] as const;
const isGroup = (f: Filter): f is ConditionalRule => typeof (f as ConditionalRule).logic === "string";

function GroupEditor({ group, siblingKeys, onChange, onRemove, depth }: {
  group: ConditionalRule; siblingKeys: string[]; onChange: (g: ConditionalRule) => void; onRemove?: () => void; depth: number;
}) {
  const filters = group.filters as Filter[];
  const setFilter = (i: number, f: Filter) => onChange({ ...group, filters: filters.map((x, j) => (j === i ? f : x)) });
  const removeFilter = (i: number) => onChange({ ...group, filters: filters.filter((_, j) => j !== i) });
  const addCondition = () => onChange({ ...group, filters: [...filters, { field: siblingKeys[0] ?? "", dataType: "string", operator: "eq", value: "" }] });
  const addGroup = () => onChange({ ...group, filters: [...filters, { logic: "and", filters: [] }] });
  return (
    <div className={`flex flex-col gap-2 ${depth > 0 ? "border-l border-border pl-3" : ""}`}>
      <div className="flex items-center gap-2">
        <select aria-label="group logic" className={`${INPUT_CLS} w-20`} value={group.logic} onChange={(e) => onChange({ ...group, logic: e.target.value as ConditionalRule["logic"] })}>
          {LOGICS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        {onRemove ? <button type="button" aria-label="remove group" className="text-muted-foreground hover:text-destructive" onClick={onRemove}><X className="size-4" /></button> : null}
      </div>
      {filters.map((f, i) =>
        isGroup(f) ? (
          <GroupEditor key={i} group={f} siblingKeys={siblingKeys} depth={depth + 1} onChange={(g) => setFilter(i, g)} onRemove={() => removeFilter(i)} />
        ) : (
          <div key={i} className="flex items-center gap-1.5">
            <select aria-label={`field ${i}`} className={INPUT_CLS} value={f.field} onChange={(e) => setFilter(i, { ...f, field: e.target.value })}>
              {siblingKeys.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <select aria-label={`operator ${i}`} className={`${INPUT_CLS} w-24`} value={f.operator} onChange={(e) => setFilter(i, { ...f, operator: e.target.value })}>
              {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <input aria-label={`value ${i}`} className={INPUT_CLS} value={String(f.value ?? "")} onChange={(e) => setFilter(i, { ...f, value: e.target.value })} />
            <button type="button" aria-label="remove condition" className="text-muted-foreground hover:text-destructive" onClick={() => removeFilter(i)}><X className="size-4" /></button>
          </div>
        ),
      )}
      <div className="flex gap-2">
        <button type="button" aria-label="add condition" className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={addCondition}><Plus className="size-3.5" /> condition</button>
        <button type="button" aria-label="add group" className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={addGroup}><Plus className="size-3.5" /> group</button>
      </div>
    </div>
  );
}

export function ConditionalSection({ card, siblingKeys, onChange }: { card: Card; siblingKeys: string[]; onChange: (p: Partial<Card>) => void }) {
  const rule = card.conditional;
  if (!rule) {
    return (
      <button type="button" aria-label="enable condition" className="inline-flex items-center gap-1.5 self-start rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => onChange({ conditional: { logic: "and", filters: [] } })}>
        <Plus className="size-3.5" /> Enable conditional display
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <GroupEditor group={rule} siblingKeys={siblingKeys} depth={0} onChange={(g) => onChange({ conditional: g })} />
      <button type="button" className="self-start text-xs text-muted-foreground hover:text-destructive" onClick={() => onChange({ conditional: undefined })}>Remove conditional</button>
    </div>
  );
}
```

- [ ] **Step 4: Wire** — in `settings-panel.tsx`, compute sibling keys and render for fields. The panel needs sibling field keys; pass them from `ui.tsx` via a new optional prop `siblingKeys?: string[]` on `SettingsPanel` (default `[]`), and in `ui.tsx` compute `cards.filter(c => c.kind === 'field' && c.id !== selectedCard?.id).map(c => c.key!).filter(Boolean)`. In the panel:
```tsx
      {isField ? <Section title="Conditional" defaultOpen={false}><ConditionalSection card={card} siblingKeys={siblingKeys} onChange={onChange} /></Section> : null}
```

- [ ] **Step 5: Run → pass + typecheck.**

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/tools/form-canvas/inspector/conditional.tsx apps/web/src/tools/form-canvas/inspector/conditional.spec.tsx apps/web/src/tools/form-canvas/inspector/settings-panel.tsx apps/web/src/tools/form-canvas/ui.tsx
git commit -m "feat(form-canvas): nested conditional display editor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: DataSource editor

**Files:**
- Create: `apps/web/src/tools/form-canvas/inspector/data-source.tsx`
- Modify: `settings-panel.tsx`
- Test: `apps/web/src/tools/form-canvas/inspector/data-source.spec.tsx`

**Interfaces:**
- Consumes: `Card`, `INPUT_CLS`. Engine `DataSource`.
- Produces: `<DataSourceSection card onChange />` — url / method / dialect / expr / optionLabel / optionValue / fallback. Empty url clears the whole `dataSource`.

- [ ] **Step 1: Write the failing test** — `data-source.spec.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataSourceSection } from "./data-source";
import type { Card } from "../model";

const f: Card = { id: "f", groupId: "g", kind: "field", label: "Country", key: "country", component: "Select", col: 1, span: 6, row: 1 };

describe("DataSourceSection", () => {
  it("setting url creates a dataSource with default extract", () => {
    const onChange = vi.fn();
    render(<DataSourceSection card={f} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: "/api/c" } });
    expect(onChange).toHaveBeenCalledWith({ dataSource: { request: { url: "/api/c" }, extract: { dialect: "path", expr: "" } } });
  });
  it("clearing url removes the dataSource", () => {
    const ds: Card = { ...f, dataSource: { request: { url: "/api/c" }, extract: { dialect: "path", expr: "data" } } };
    const onChange = vi.fn();
    render(<DataSourceSection card={ds} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ dataSource: undefined });
  });
  it("sets optionLabel preserving url/extract", () => {
    const ds: Card = { ...f, dataSource: { request: { url: "/api/c" }, extract: { dialect: "path", expr: "data" } } };
    const onChange = vi.fn();
    render(<DataSourceSection card={ds} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/option label/i), { target: { value: "name" } });
    expect(onChange).toHaveBeenCalledWith({ dataSource: { request: { url: "/api/c" }, extract: { dialect: "path", expr: "data" }, optionLabel: "name" } });
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `data-source.tsx`**:
```tsx
"use client";
import * as React from "react";
import type { DataSource } from "@rfjs/form-builder";
import { INPUT_CLS } from "./settings-panel";
import type { Card } from "../model";

const DIALECTS = ["path", "jsonata", "jsonpath"] as const;
const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;

export function DataSourceSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  const ds = card.dataSource;
  const setUrl = (url: string) => {
    if (!url) return onChange({ dataSource: undefined });
    const next: DataSource = ds ? { ...ds, request: { ...ds.request, url } } : { request: { url }, extract: { dialect: "path", expr: "" } };
    onChange({ dataSource: next });
  };
  const patch = (mut: (d: DataSource) => DataSource) => {
    if (!ds) return;
    onChange({ dataSource: mut(ds) });
  };
  const opt = (key: "optionLabel" | "optionValue" | "fallback", value: string) =>
    patch((d) => { const n = { ...d }; if (value) n[key] = value; else delete n[key]; return n; });
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        URL
        <input className={INPUT_CLS} value={ds?.request.url ?? ""} onChange={(e) => setUrl(e.target.value)} />
      </label>
      {ds ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Method
              <select className={INPUT_CLS} value={ds.request.method ?? "GET"} onChange={(e) => patch((d) => ({ ...d, request: { ...d.request, method: e.target.value as DataSource["request"]["method"] } }))}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Dialect
              <select className={INPUT_CLS} value={ds.extract.dialect} onChange={(e) => patch((d) => ({ ...d, extract: { ...d.extract, dialect: e.target.value as DataSource["extract"]["dialect"] } }))}>
                {DIALECTS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Extract expr
            <input className={`${INPUT_CLS} font-mono`} value={ds.extract.expr} onChange={(e) => patch((d) => ({ ...d, extract: { ...d.extract, expr: e.target.value } }))} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">Option label<input aria-label="option label" className={INPUT_CLS} value={ds.optionLabel ?? ""} onChange={(e) => opt("optionLabel", e.target.value)} /></label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">Option value<input aria-label="option value" className={INPUT_CLS} value={ds.optionValue ?? ""} onChange={(e) => opt("optionValue", e.target.value)} /></label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Fallback<input className={INPUT_CLS} value={ds.fallback ?? ""} onChange={(e) => opt("fallback", e.target.value)} /></label>
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Wire** — in `settings-panel.tsx`, render for Select fields (and content, which also supports dataSource):
```tsx
      {isField && card.component === "Select" ? <Section title="Data Source" defaultOpen={false}><DataSourceSection card={card} onChange={onChange} /></Section> : null}
```

- [ ] **Step 5: Run → pass + typecheck.**

- [ ] **Step 6: Full verification + manual check** — `pnpm -F web vitest:run src/tools/form-canvas` (all form-canvas specs) + `pnpm -F web check-types`. Then `pnpm --filter web exec next dev -p 3338`, open `/en/tools/form-canvas`, select a Select field, and confirm each section appears + edits flow into the JSON tab and the Preview.

- [ ] **Step 7: Commit**
```bash
git add apps/web/src/tools/form-canvas/inspector/data-source.tsx apps/web/src/tools/form-canvas/inspector/data-source.spec.tsx apps/web/src/tools/form-canvas/inspector/settings-panel.tsx
git commit -m "feat(form-canvas): dataSource editor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review notes

- **Spec coverage:** Card model (Unit 1) = Task 1; settings panel shell (Unit 3 shell) = Task 2; the per-section controls (Unit 3) = Tasks 3-8 (validation, options+defaultValue, ai-note/content/spacer, i18n labels, nested conditional, dataSource). Collision (Unit 2) shipped separately in #210.
- **No feature reduction:** conditional is the full nested `and/or/nor/not` tree (Task 7); i18n labels cover en + zh-TW (Task 6); dataSource is complete (Task 8). All round-trip via Task 1's mappers.
- **Placeholder scan:** none — every step has complete code.
- **Type consistency:** `Card` extended in Task 1 is consumed by every control; `INPUT_CLS` exported from `settings-panel.tsx` (Task 2) reused by Tasks 3-8; `cardLabel` (Task 1) used in `ui.tsx` + Labels (Task 6); `SettingsPanel` `siblingKeys` prop added in Task 7. Each control's `(card, onChange)` signature is uniform.
- **Lint:** controls drop empty values to `undefined` so the emitted FormConfig stays clean and round-trips. Watch unused imports when wiring sections into `settings-panel.tsx`.
