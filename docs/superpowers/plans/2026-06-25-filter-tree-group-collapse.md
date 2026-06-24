# Filter-tree Group Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every group node in `FilterTreeEditor` collapsible to a one-line summary (with a hover/focus detail tooltip), as pure view state.

**Architecture:** All logic lives in `@rfjs/filter-builder-ui`'s `FilterTreeEditor` (recursive component). Each instance holds its own `collapsed` `useState` — collapse is never written into `BuilderGroup`. The collapsed header shows the logic badge + a non-zero count summary; the summary is wrapped in the shared Radix `Tooltip` (portaled, so the panel's `overflow` can't clip it) showing an indented preview of the subtree. Four optional `FilterTreeLabels` fields carry the new copy (English fallback in-component), then the 5 web builders + workbench explorer pass localized strings.

**Tech Stack:** React 19, TypeScript, `@rfjs/web-ui` (Radix `Tooltip`, `Button`, `Select`), `lucide-react`, Vitest + Testing Library, next-intl.

## Global Constraints

- `@rfjs/filter-builder-ui` is consumed via Next `transpilePackages` (src, not dist) → **no dist rebuild**; Tailwind already `@source`-scans it → new utility classes generate.
- Collapse is **view state only** — it MUST NOT be added to `BuilderGroup`/the tree; compile + live-match read the tree and must stay unaffected.
- New `FilterTreeLabels` fields are **optional with in-component English fallback** so no caller breaks at the type level.
- All user-facing copy is bilingual (en + zh-TW); zh-TW is Traditional Chinese.
- Summary shows **non-zero parts only**, joined by ` · `; empty group → the `collapsedEmpty` label.
- Co-locate tests; `eslint . --max-warnings 0` (no unused imports). `apps/web` scripts: `vitest:run`, `check-types`, `lint`, `build`.

---

## File Structure

- `packages/filter-builder-ui/src/filter-tree-editor.tsx` — core change (collapse state, chevron, summary, tooltip, `previewLines` helper, extended `FilterTreeLabels`).
- `packages/filter-builder-ui/src/filter-tree-editor.spec.tsx` — new collapse tests.
- `apps/web/src/tools/{data-filter-builder,jsonb-query-builder,sql-filter-builder,mongo-query-builder,pg-filter-builder}/messages.ts` — 4 new strings each (en + zh-TW).
- `apps/web/src/tools/{…}/ui.tsx` (same 5) — pass the 4 new fields in `treeLabels`.
- `apps/workbench/src/components/explorer/dataset-explorer.tsx` + `apps/workbench/src/messages/{en,zh-TW}.json` — 4 new strings + pass them.

---

## Task 1: Group collapse in `FilterTreeEditor` (core, TDD)

**Files:**
- Modify: `packages/filter-builder-ui/src/filter-tree-editor.tsx`
- Test: `packages/filter-builder-ui/src/filter-tree-editor.spec.tsx`

**Interfaces:**
- Consumes: existing `BuilderGroup`, `BuilderCondition`, `LogicOp` from `@rfjs/filter-builder`; `Tooltip`,`TooltipTrigger`,`TooltipContent` from `@rfjs/web-ui/components/tooltip`; `ChevronDown` from `lucide-react`.
- Produces: `FilterTreeLabels` gains optional `toggleGroup`, `collapsedConditions`, `collapsedGroups`, `collapsedEmpty`. No change to component props.

- [ ] **Step 1: Read the current file** `packages/filter-builder-ui/src/filter-tree-editor.tsx` so the edits below land in the right places (imports at top; `FilterTreeLabels` interface ~L23; `FilterTreeEditor` fn ~L49; header `<div className="mb-3 …">` ~L71; children container `<div className="ml-1 …">` ~L109).

- [ ] **Step 2: Write the failing tests** — create/extend `packages/filter-builder-ui/src/filter-tree-editor.spec.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BuilderGroup, FieldSchema } from "@rfjs/filter-builder";

import { FilterTreeEditor, type FilterTreeLabels } from "./filter-tree-editor";

const labels: FilterTreeLabels = {
  logic: { and: "ALL", or: "ANY", nor: "NONE", not: "NOT" },
  addCondition: "+ condition",
  addGroup: "+ group",
  removeGroup: "remove group",
  removeCondition: "remove condition",
  elemMatch: "elemmatch",
  toggleGroup: "toggle group",
  collapsedConditions: "{count} cond",
  collapsedGroups: "{count} grp",
  collapsedEmpty: "empty",
};

const schema: FieldSchema[] = [{ path: "age", dataType: "numeric", include: true, kind: "jsonb" }];

// root ALL { age>18, age<99, ANY { age=1 } }  → 2 conditions + 1 group
const tree: BuilderGroup = {
  kind: "group", id: "root", logic: "and",
  children: [
    { kind: "condition", id: "c1", field: "age", dataType: "numeric", operator: "gt", value: 18 },
    { kind: "condition", id: "c2", field: "age", dataType: "numeric", operator: "lt", value: 99 },
    { kind: "group", id: "g1", logic: "or", children: [
      { kind: "condition", id: "c3", field: "age", dataType: "numeric", operator: "eq", value: 1 },
    ] },
  ],
};

function setup(onChange = vi.fn()) {
  render(
    <FilterTreeEditor group={tree} engineId="data-filter" schema={schema}
      onChange={onChange} onCreateField={vi.fn()} labels={labels} />,
  );
  return onChange;
}

describe("FilterTreeEditor — group collapse", () => {
  it("renders expanded by default (children visible, add buttons present)", () => {
    setup();
    expect(screen.getAllByLabelText("operator").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+ condition").length).toBeGreaterThan(0);
  });

  it("collapsing the root hides children and add buttons, shows summary", () => {
    setup();
    const toggles = screen.getAllByRole("button", { name: "toggle group" });
    fireEvent.click(toggles[0]); // root is the first group → first chevron
    expect(toggles[0].getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("operator")).toBeNull();
    expect(screen.queryByText("+ condition")).toBeNull();
    // non-zero summary: 2 conditions + 1 group, no "0 …"
    expect(screen.getByText("2 cond · 1 grp")).toBeTruthy();
  });

  it("summary omits the zero part (group with only conditions)", () => {
    const onlyConds: BuilderGroup = {
      kind: "group", id: "r", logic: "and",
      children: [{ kind: "condition", id: "c", field: "age", dataType: "numeric", operator: "gt", value: 1 }],
    };
    render(<FilterTreeEditor group={onlyConds} engineId="data-filter" schema={schema}
      onChange={vi.fn()} onCreateField={vi.fn()} labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "toggle group" }));
    expect(screen.getByText("1 cond")).toBeTruthy();
  });

  it("collapsing does NOT call onChange (view-only, tree unchanged)", () => {
    const onChange = setup();
    fireEvent.click(screen.getAllByRole("button", { name: "toggle group" })[0]);
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm -F @rfjs/filter-builder-ui vitest:run src/filter-tree-editor.spec.tsx`
Expected: FAIL — no "toggle group" button / `toggleGroup` not on `FilterTreeLabels`.

- [ ] **Step 4: Add imports** at the top of `filter-tree-editor.tsx`:
  - change `import { useEffect } from "react";` → `import { useEffect, useState } from "react";`
  - add `import { Tooltip, TooltipContent, TooltipTrigger } from "@rfjs/web-ui/components/tooltip";`
  - change `import { X } from "lucide-react";` → `import { ChevronDown, X } from "lucide-react";`

- [ ] **Step 5: Extend `FilterTreeLabels`** — add these fields to the interface (after `valueHint?`):

```ts
  /** aria-label for the collapse/expand chevron. Fallback: "toggle group". */
  toggleGroup?: string;
  /** collapsed summary — conditions unit; "{count}" is substituted. Fallback: "{count} cond". */
  collapsedConditions?: string;
  /** collapsed summary — groups unit; "{count}" is substituted. Fallback: "{count} grp". */
  collapsedGroups?: string;
  /** collapsed summary when the group has no children. Fallback: "empty". */
  collapsedEmpty?: string;
```

- [ ] **Step 6: Add the `previewLines` module-level helper** (place above the `FilterTreeEditor` function, after the `CROW_CSS` const):

```tsx
function formatPreviewValue(v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  if (Array.isArray(v)) return " " + v.map((x) => String(x)).join(", ");
  return " " + String(v);
}

// Indented, label-free preview of a collapsed subtree for the hover tooltip.
function previewLines(group: BuilderGroup, indent = ""): string[] {
  const lines: string[] = [];
  for (const child of group.children) {
    if (child.kind === "group") {
      lines.push(indent + child.logic.toUpperCase());
      lines.push(...previewLines(child, indent + "   "));
    } else {
      lines.push(`${indent}${child.field || "—"} ${child.operator || "?"}${formatPreviewValue(child.value)}`);
    }
  }
  return lines;
}
```

- [ ] **Step 7: Add collapse state + derived summary** inside `FilterTreeEditor`, right after the function's opening `{` (before the `return`):

```tsx
  const [collapsed, setCollapsed] = useState(false);
  const condCount = group.children.filter((c) => c.kind === "condition").length;
  const groupCount = group.children.filter((c) => c.kind === "group").length;
  const summaryParts: string[] = [];
  if (condCount) summaryParts.push((labels.collapsedConditions ?? "{count} cond").replace("{count}", String(condCount)));
  if (groupCount) summaryParts.push((labels.collapsedGroups ?? "{count} grp").replace("{count}", String(groupCount)));
  const summary = summaryParts.join(" · ") || (labels.collapsedEmpty ?? "empty");
```

- [ ] **Step 8: Replace the header `<div>` and children `<div>`** (the block from `<div className="mb-3 flex flex-wrap items-center gap-2">` through the children container) with:

```tsx
      <div className={`flex flex-wrap items-center gap-2 ${collapsed ? "" : "mb-3"}`}>
        <button
          type="button"
          aria-label={labels.toggleGroup ?? "toggle group"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChevronDown
            className={`size-4 transition-transform motion-reduce:transition-none ${collapsed ? "-rotate-90" : ""}`}
          />
        </button>
        <Select
          value={group.logic}
          onValueChange={(v) => onChange(setLogic(group, group.id, v as LogicOp))}
        >
          <SelectTrigger
            size="sm"
            aria-label="logic"
            className={`h-7 w-auto gap-1.5 rounded-md border-0 px-2.5 text-xs font-bold tracking-wide shadow-none ${logicBadge(group.logic)}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(labels.logic) as LogicOp[]).map((l) => (
              <SelectItem key={l} value={l}>
                {labels.logic[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className="cursor-help rounded font-mono text-xs text-muted-foreground underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {summary}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[340px] whitespace-pre font-mono text-xs">
              {previewLines(group).join("\n") || (labels.collapsedEmpty ?? "empty")}
            </TooltipContent>
          </Tooltip>
        ) : (
          <>
            <Button size="xs" variant="outline" onClick={() => onChange(addCondition(group, group.id, id))}>
              {labels.addCondition}
            </Button>
            <Button size="xs" variant="outline" onClick={() => onChange(addGroup(group, group.id, id))}>
              {labels.addGroup}
            </Button>
          </>
        )}
        {onRemove ? (
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={labels.removeGroup}
            onClick={onRemove}
            className="ml-auto text-muted-foreground"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
      {collapsed ? null : (
        <div className="ml-1 flex flex-col gap-2 border-l border-slab-border pl-4">
          {group.children.map((child) =>
            child.kind === "group" ? (
              <FilterTreeEditor
                key={child.id}
                group={child}
                engineId={engineId}
                schema={schema}
                labels={labels}
                depth={depth + 1}
                onChange={(nextChild) =>
                  onChange({ ...group, children: group.children.map((c) => (c.id === child.id ? nextChild : c)) })
                }
                onRemove={() => onChange(removeNode(group, child.id))}
                onCreateField={onCreateField}
              />
            ) : (
              <ConditionRow
                key={child.id}
                condition={child}
                engineId={engineId}
                schema={schema}
                labels={labels}
                onChange={(patch) => onChange(updateNode(group, child.id, patch))}
                onRemove={() => onChange(removeNode(group, child.id))}
                onCreateField={onCreateField}
              />
            ),
          )}
        </div>
      )}
```

> NOTE: keep the existing `<div className={depth > 0 ? …}>` wrapper and the `{depth === 0 ? <style>{CROW_CSS}</style> : null}` line exactly as they are — only the header + children blocks change. `MetadataStrip` already uses `<Tooltip>` without an explicit `TooltipProvider`, so no provider wiring is needed.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm -F @rfjs/filter-builder-ui vitest:run src/filter-tree-editor.spec.tsx`
Expected: PASS (all 4 cases). If jsdom lacks `ResizeObserver`/`scrollIntoView` for Radix, the package's `vitest.setup.ts` already polyfills them.

- [ ] **Step 10: Typecheck + lint + full package tests**

```bash
pnpm -F @rfjs/filter-builder-ui check-types
pnpm -F @rfjs/filter-builder-ui lint
pnpm -F @rfjs/filter-builder-ui vitest:run
```
Expected: all green (existing `filter-tree-editor.spec.tsx` / `use-filter-tree.spec.ts` still pass).

- [ ] **Step 11: Commit**

```bash
git add packages/filter-builder-ui
git commit -m "feat(filter-builder-ui): collapsible groups in FilterTreeEditor"
```

---

## Task 2: Localize the collapse labels in all 6 consumers

**Files:**
- Modify: `apps/web/src/tools/data-filter-builder/{messages.ts,ui.tsx}`
- Modify: `apps/web/src/tools/jsonb-query-builder/{messages.ts,ui.tsx}`
- Modify: `apps/web/src/tools/sql-filter-builder/{messages.ts,ui.tsx}`
- Modify: `apps/web/src/tools/mongo-query-builder/{messages.ts,ui.tsx}`
- Modify: `apps/web/src/tools/pg-filter-builder/{messages.ts,ui.tsx}`
- Modify: `apps/workbench/src/components/explorer/dataset-explorer.tsx` + `apps/workbench/src/messages/{en,zh-TW}.json`

**Interfaces:**
- Consumes: `FilterTreeLabels.toggleGroup|collapsedConditions|collapsedGroups|collapsedEmpty` from Task 1.
- Produces: nothing downstream.

- [ ] **Step 1: Add the 4 strings to each web tool `messages.ts`** under both `en.ToolUI` and `"zh-TW".ToolUI`, using the tool's existing key prefix (`dfb`/`jqb`/`sfb`/`mqb`/`pfb`). For prefix `<p>`:

```ts
      <p>ToggleGroup: "Collapse / expand group",
      <p>CollapsedConditions: "{count} cond",
      <p>CollapsedGroups: "{count} grp",
      <p>CollapsedEmpty: "empty",
```
zh-TW:
```ts
      <p>ToggleGroup: "收合 / 展開群組",
      <p>CollapsedConditions: "{count} 條件",
      <p>CollapsedGroups: "{count} 群組",
      <p>CollapsedEmpty: "空群組",
```
Do this for all 5 prefixes: `dfb`, `jqb`, `sfb`, `mqb`, `pfb`.

- [ ] **Step 2: Pass the 4 fields in each web tool `ui.tsx` `treeLabels`** — add inside the `treeLabels` object (after `valueHint`), using the matching prefix:

```ts
    toggleGroup: t("<p>ToggleGroup"),
    collapsedConditions: t("<p>CollapsedConditions"),
    collapsedGroups: t("<p>CollapsedGroups"),
    collapsedEmpty: t("<p>CollapsedEmpty"),
```

> The `{count}` placeholder is substituted inside `FilterTreeEditor` (not by next-intl), so pass these as literal strings — do NOT call `t("<p>CollapsedConditions", { count })`.

- [ ] **Step 3: Wire the workbench explorer** — open `apps/workbench/src/components/explorer/dataset-explorer.tsx`, find where it builds the `FilterTreeLabels` (the object with `logic`/`addCondition`/`elemMatch`), and add the 4 fields reading from the same translation namespace it already uses (e.g. `t("toggleGroup")` etc.). Add the 4 keys to `apps/workbench/src/messages/en.json` and `apps/workbench/src/messages/zh-TW.json` in that namespace:
  - en: `"toggleGroup": "Collapse / expand group"`, `"collapsedConditions": "{count} cond"`, `"collapsedGroups": "{count} grp"`, `"collapsedEmpty": "empty"`
  - zh-TW: `"toggleGroup": "收合 / 展開群組"`, `"collapsedConditions": "{count} 條件"`, `"collapsedGroups": "{count} 群組"`, `"collapsedEmpty": "空群組"`

- [ ] **Step 4: Typecheck, lint, test, build both apps**

```bash
pnpm -F web check-types && pnpm -F web lint && pnpm -F web vitest:run && pnpm -F web build
pnpm -F workbench check-types && pnpm -F workbench lint && pnpm -F workbench vitest:run
```
Expected: all green; `next build` for web compiles (collapse renders in every builder route).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools apps/workbench/src
git commit -m "feat(web,workbench): localize filter-tree group-collapse labels"
```

---

## Task 3: Verify + PR

- [ ] **Step 1: Whole-affected check**

```bash
pnpm -F @rfjs/filter-builder-ui vitest:run
pnpm -F web vitest:run && pnpm -F web check-types && pnpm -F web lint
pnpm -F workbench vitest:run
```
Expected: all green.

- [ ] **Step 2: Manual checklist for the PR body** (no browser in CI):
  - every builder + the workbench explorer shows a chevron on each group (incl. root); collapsing hides children + add-buttons and shows `N 條件 · M 群組` (non-zero only);
  - hovering/focusing the summary shows the indented subtree preview, not clipped by the panel;
  - collapsing then editing elsewhere keeps the compiled output / matched rows correct (collapse is view-only);
  - narrow viewport still reflows condition rows.

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin feat/filter-tree-group-collapse
gh pr create --base main --title "feat: collapsible groups in the filter-tree editor" --body "<summary + manual checklist + spec link>"
```
End the PR body with the Claude Code attribution line.

---

## Self-Review

**1. Spec coverage**
- All groups incl. root collapsible → Task 1 Step 8 (chevron on every instance, no depth gate) ✓
- Collapsed = hide children + add-buttons, show badge + summary → Step 8 ✓
- Non-zero-only summary → Step 7 ✓
- Hover/focus Radix tooltip, portaled (no clip) → Step 8 (`Tooltip`/`TooltipContent`) ✓
- View-only state, not in `BuilderGroup`, no `onChange` → Step 7 (`useState`) + Task 1 test 4 ✓
- 4 optional labels + English fallback → Step 5 + Step 7/8 fallbacks ✓
- All 6 consumers localized → Task 2 ✓
- RWD inherited → no code; verified in Task 3 manual checklist ✓
- No dist/engine rebuild → Global Constraints ✓

**2. Placeholder scan** — Task 1 is full code. Task 2 is a fill-the-prefix template applied to 5 known dirs + the workbench (the only "read the file to find the labels object" step is the workbench, justified because its namespace isn't fixed here; the strings to add are given verbatim). No TBD/TODO.

**3. Type consistency** — `toggleGroup`, `collapsedConditions`, `collapsedGroups`, `collapsedEmpty` are spelled identically in the interface (Step 5), the component reads (Step 7/8), the tests (Task 1 Step 2), and all caller steps (Task 2). `previewLines(group)` / `formatPreviewValue(v)` defined once (Step 6) and used once (Step 8).
