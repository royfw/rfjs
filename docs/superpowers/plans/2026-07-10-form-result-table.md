# form result `mode:'table'` (A render + B snapshot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the form-builder result item's `mode:'table'` by embedding `@rfjs/table-builder-ui`'s `<ConfigTable>` (zero-config derive fallback, A), plus an optional inspector snapshot that freezes columns into `item.table` for JSON editing (B).

**Architecture:** The engine (`@rfjs/form-builder`) types `ResultItem.table` as `TableConfig` and validates it with table-builder's zod schema. The renderer (`@rfjs/form-builder-ui`) fills `ResultView`'s existing `mode:'table'` placeholder with a `<ConfigTable>`, deriving a config from the response rows when `item.table` is absent. The form tool (`apps/web`) types the mirror field and adds a paste-a-sample snapshot control; column customization is done via the existing JSON tab, not a visual editor.

**Tech Stack:** TypeScript, React 19, Zod 4, Vitest + @testing-library/react, pnpm workspaces, Next.js `transpilePackages`.

## Global Constraints

- **Red line:** do NOT modify `packages/table-builder` or `packages/table-builder-ui`. Consume only: types, `deriveTableConfig`, `inferFieldsFromRows`, `ConfigTable`, `tableConfigSchema`.
- **No `@dnd-kit`** added anywhere (no visual reorder this round).
- **No visual per-column editor** (C is out of scope).
- Inspector strings are inline English, matching the existing `ResultSection` (`Mode`/`Source`/`Data path`) — do NOT route them through `messages.ts`.
- Commits: English Conventional Commits + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- Changesets: `@rfjs/form-builder` and `@rfjs/form-builder-ui` each get one (minor). Apps get none.
- Run all commands from the worktree root: `/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-form-result-table`.

---

## File Structure

- `packages/form-builder/src/types.ts` — type `ResultItem.table` as `TableConfig`.
- `packages/form-builder/src/config-schema.ts` — validate `table` with `tableConfigSchema`.
- `packages/form-builder/package.json` — add `@rfjs/table-builder` dep.
- `packages/form-builder-ui/src/result-view.tsx` — `mode:'table'` → `<ConfigTable>` (+ `table` prop, derive fallback, non-array fallback).
- `packages/form-builder-ui/src/config-form.tsx` — thread `item.table` into `<ResultView>`.
- `packages/form-builder-ui/package.json` — add table-builder(-ui) + data-schema deps.
- `apps/web/src/tools/form-builder/model.ts` — type `Card.resultTable` as `TableConfig` (mapping already carries it).
- `apps/web/src/tools/form-builder/inspector/result-table-snapshot.ts` — pure sample→TableConfig helper (new).
- `apps/web/src/tools/form-builder/inspector/result.tsx` — snapshot UI for `mode:'table'`; drop "coming soon".
- `apps/web/src/tools/form-builder/ui.tsx` — demo fetcher returns rows for query-shaped URLs.
- `apps/web/src/tools/form-builder/sample.ts` — flip the query result item to `mode:'table'`.

---

## Task 1: Engine — type & validate `ResultItem.table`

**Files:**
- Modify: `packages/form-builder/src/types.ts` (import + `table` field)
- Modify: `packages/form-builder/src/config-schema.ts:167-176` (result item schema)
- Modify: `packages/form-builder/package.json` (dependencies)
- Test: `packages/form-builder/src/config-schema.spec.ts`

**Interfaces:**
- Consumes: `TableConfig`, `tableConfigSchema` from `@rfjs/table-builder`.
- Produces: `ResultItem.table?: TableConfig`; `FormConfigSchema` now rejects a malformed `table`.

- [ ] **Step 1: Add the workspace dependency and install**

Edit `packages/form-builder/package.json` `dependencies` (keep alphabetical-ish with the other `@rfjs/*`):

```json
    "@rfjs/data-expr": "workspace:*",
    "@rfjs/data-filter": "workspace:*",
    "@rfjs/object-utils": "workspace:*",
    "@rfjs/table-builder": "workspace:*",
    "zod": "^4.0.0"
```

Run: `pnpm install`
Expected: lockfile links `@rfjs/form-builder` → `@rfjs/table-builder`, no errors.

- [ ] **Step 2: Write the failing test**

Add to `packages/form-builder/src/config-schema.spec.ts`:

```ts
describe('result item table (mode:table)', () => {
  const withTable = {
    version: 1,
    sections: [
      {
        id: 's1',
        title: 'S',
        rows: [
          {
            id: 'r1',
            items: [
              {
                id: 'res',
                kind: 'result',
                mode: 'table',
                table: {
                  columns: [{ key: 'name', label: 'Name', dataType: 'string' }],
                  pagination: { pageSize: 10 },
                },
              },
            ],
          },
        ],
      },
    ],
  };

  it('accepts a result item carrying a valid TableConfig', () => {
    expect(parseFormConfig(withTable)).toEqual(withTable);
  });

  it('rejects a result item whose table has no columns', () => {
    const bad = JSON.parse(JSON.stringify(withTable));
    bad.sections[0].rows[0].items[0].table.columns = [];
    expect(FormConfigSchema.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm -F @rfjs/form-builder vitest:run config-schema`
Expected: FAIL — the "no columns" case currently passes because `table` is `z.unknown()` (test expects `success: false`). (If the section shape is rejected, adjust the section keys to whatever the schema reports as required, then re-run.)

- [ ] **Step 4: Type the field in `types.ts`**

Add the import under the existing one at the top of `packages/form-builder/src/types.ts`:

```ts
import type { ConditionalRule } from './conditional';
import type { TableConfig } from '@rfjs/table-builder';
```

Change the `ResultItem.table` field (currently `table?: unknown;`):

```ts
  /** mode:'table' 的欄位設定;缺省時 renderer 從回應 rows derive。 */
  table?: TableConfig;
```

- [ ] **Step 5: Validate the field in `config-schema.ts`**

Add the import near the top (after the zod imports):

```ts
import { tableConfigSchema } from '@rfjs/table-builder';
```

In `resultItemSchema`, change `table: z.unknown().optional(),` to:

```ts
  table: tableConfigSchema.optional(),
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm -F @rfjs/form-builder vitest:run config-schema`
Expected: PASS (both new cases + existing).

Run: `pnpm -F @rfjs/form-builder typecheck`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/form-builder/src/types.ts packages/form-builder/src/config-schema.ts packages/form-builder/src/config-schema.spec.ts packages/form-builder/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(form-builder): type and validate result item table as TableConfig

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Renderer — `ResultView` table branch → `<ConfigTable>`

**Files:**
- Modify: `packages/form-builder-ui/src/result-view.tsx`
- Modify: `packages/form-builder-ui/package.json` (dependencies)
- Test: `packages/form-builder-ui/src/result-view.spec.tsx`

**Interfaces:**
- Consumes: `TableConfig`, `deriveTableConfig` (`@rfjs/table-builder`); `inferFieldsFromRows` (`@rfjs/data-schema`); `ConfigTable` (`@rfjs/table-builder-ui`).
- Produces: `ResultViewProps.table?: TableConfig`. `ResultView` renders a `<table>` for `mode:'table'` when `value` is a non-empty object array; otherwise the empty-state box.

- [ ] **Step 1: Add workspace dependencies and install**

Edit `packages/form-builder-ui/package.json` `dependencies`, adding:

```json
    "@rfjs/data-schema": "workspace:*",
    "@rfjs/table-builder": "workspace:*",
    "@rfjs/table-builder-ui": "workspace:*",
```

Run: `pnpm install`
Expected: links resolve, no errors.

- [ ] **Step 2: Write the failing tests**

Add to `packages/form-builder-ui/src/result-view.spec.tsx`:

```ts
describe('ResultView table mode', () => {
  const rows = [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Alan' },
  ];

  it('derives columns from rows when no table config is given', () => {
    render(<ResultView mode="table" state="ready" value={rows} />);
    expect(screen.getByText('id')).toBeTruthy();
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('honors a carried TableConfig (column label overrides the key)', () => {
    render(
      <ResultView
        mode="table"
        state="ready"
        value={rows}
        table={{
          columns: [{ key: 'name', label: 'Full Name', dataType: 'string' }],
          pagination: { pageSize: 10 },
        }}
      />,
    );
    expect(screen.getByText('Full Name')).toBeTruthy();
    expect(screen.queryByText('id')).toBeNull();
  });

  it('falls back to the empty box when the value is not an object array', () => {
    render(<ResultView mode="table" state="ready" value={{ notAnArray: true }} emptyText={{ en: 'No rows' }} />);
    expect(screen.getByText('No rows')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run result-view`
Expected: FAIL — current table branch renders the "pending @rfjs/table-builder" placeholder, so `id`/`Full Name` are absent.

- [ ] **Step 4: Implement the table branch**

In `packages/form-builder-ui/src/result-view.tsx`, add imports at the top:

```ts
import { deriveTableConfig, type TableConfig } from '@rfjs/table-builder';
import { inferFieldsFromRows } from '@rfjs/data-schema';
import { ConfigTable } from '@rfjs/table-builder-ui';
```

Add `table` to the props interface:

```ts
export interface ResultViewProps {
  mode: 'card' | 'json' | 'table';
  state: ResultViewState;
  value?: unknown;
  maxItems?: number;
  table?: TableConfig;
  emptyText?: LocalizedLabel;
  locale?: string;
}
```

Add a small internal component that isolates the memoized derive/source (hooks must not be conditional, so keep them in their own component mounted only for the ready+rows path):

```tsx
function ResultTable({ rows, table, locale }: { rows: Record<string, unknown>[]; table?: TableConfig; locale: string }) {
  const config = React.useMemo(
    () => table ?? deriveTableConfig({ fields: inferFieldsFromRows(rows) }),
    [table, rows],
  );
  const source = React.useMemo(() => ({ kind: 'rows' as const, rows }), [rows]);
  return <ConfigTable config={config} source={source} locale={locale} />;
}
```

Replace the existing `mode === 'table'` placeholder block (currently the "Table view / pending" box) with:

```tsx
  if (mode === 'table') {
    const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : null;
    if (!rows || rows.length === 0 || !rows.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r))) {
      return <div className={stateBox}>{emptyText ? resolveLabel(emptyText, locale) : 'No result yet'}</div>;
    }
    return <ResultTable rows={rows} table={table} locale={locale} />;
  }
```

Update the `ResultView` signature to destructure `table`:

```tsx
export function ResultView({ mode, state, value, maxItems, table, emptyText, locale = 'en' }: ResultViewProps) {
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run result-view`
Expected: PASS (3 new + existing states/card/json).
(If `ConfigTable` throws for a missing `ResizeObserver` in jsdom, install the mock used elsewhere in this package — see `config-form.spec.tsx`'s `installResizeObserverMock` — inside a `beforeEach` for this describe block.)

Run: `pnpm -F @rfjs/form-builder-ui typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/form-builder-ui/src/result-view.tsx packages/form-builder-ui/src/result-view.spec.tsx packages/form-builder-ui/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(form-builder-ui): render result mode:'table' with ConfigTable + derive fallback

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Renderer — thread `item.table` through `config-form`

**Files:**
- Modify: `packages/form-builder-ui/src/config-form.tsx:492`
- Test: `packages/form-builder-ui/src/config-form.spec.tsx`

**Interfaces:**
- Consumes: `ResultView` `table` prop (Task 2); `ConfigForm`'s existing `fetcher` prop + api-button flow.
- Produces: nothing new; ensures a result item's `table` reaches the renderer.

- [ ] **Step 1: Write the failing test**

Add to `packages/form-builder-ui/src/config-form.spec.tsx`:

```ts
describe('ConfigForm result mode:table', () => {
  const tableConfig: FormConfig = {
    version: 1,
    sections: [
      {
        id: 's1',
        title: 'S',
        rows: [
          {
            id: 'r1',
            items: [
              { id: 'btn', kind: 'button', label: 'Query', action: { type: 'api', url: '/api/search' } },
              {
                id: 'res',
                kind: 'result',
                mode: 'table',
                sourceId: 'btn',
                table: {
                  columns: [{ key: 'name', label: 'Full Name', dataType: 'string' }],
                  pagination: { pageSize: 10 },
                },
              },
            ],
          },
        ],
      },
    ],
  };

  it('passes item.table to the rendered table (label override shows)', async () => {
    const rows = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Alan' }];
    const fetcher = vi.fn().mockResolvedValue(rows);
    render(<ConfigForm config={tableConfig} onSubmit={() => {}} fetcher={fetcher} />);
    fireEvent.click(screen.getByRole('button', { name: /query/i }));
    await waitFor(() => expect(screen.getByText('Full Name')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run config-form`
Expected: FAIL — `Full Name` never appears because `<ResultView>` isn't yet passed `table`, so it derives `name` instead. (If it instead fails on `installResizeObserverMock`, add that mock to this describe block as the surrounding tests do.)

- [ ] **Step 3: Thread the prop**

In `packages/form-builder-ui/src/config-form.tsx`, the result render at line ~492 currently reads:

```tsx
          <ResultView mode={item.mode} state={state} value={value} maxItems={item.maxItems} emptyText={item.emptyText} locale={locale} />
```

Change it to include `table`:

```tsx
          <ResultView mode={item.mode} state={state} value={value} maxItems={item.maxItems} table={item.table} emptyText={item.emptyText} locale={locale} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run config-form`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder-ui/src/config-form.tsx packages/form-builder-ui/src/config-form.spec.tsx
git commit -m "$(cat <<'EOF'
feat(form-builder-ui): thread result item table config into ResultView

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Form tool — type `Card.resultTable`

**Files:**
- Modify: `apps/web/src/tools/form-builder/model.ts` (import + `resultTable` field type)
- Test: `apps/web/src/tools/form-builder/model.spec.ts`

**Interfaces:**
- Consumes: `TableConfig` (`@rfjs/table-builder`). The `cardToItem`/`formConfigToCards` mapping already carries `table`↔`resultTable` (added in #235) — this task only types it.
- Produces: `Card.resultTable?: TableConfig`.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/tools/form-builder/model.spec.ts`:

```ts
it('round-trips a table-mode result item with a TableConfig', () => {
  const table = {
    columns: [{ key: 'name', label: 'Name', dataType: 'string' as const }],
    pagination: { pageSize: 10 },
  };
  const groups = [{ id: 'g1', title: 'G', collapsed: false }];
  const cards = [
    { id: 'res', groupId: 'g1', kind: 'result' as const, label: 'Result', mode: 'table' as const,
      resultTable: table, col: 1, span: 6, row: 1 },
  ];
  const config = cardsToFormConfig(groups, cards);
  const back = formConfigToCards(config);
  const res = back.cards.find((c) => c.id === 'res');
  expect(res?.mode).toBe('table');
  expect(res?.resultTable).toEqual(table);
});
```

(Imports: ensure `cardsToFormConfig` and `formConfigToCards` are imported at the top of the spec — mirror the existing import line.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F web vitest run model`
Expected: initially this may PASS at runtime (mapping already carries the value) but FAIL `typecheck` because `resultTable` is `unknown` and `dataType`/`res?.resultTable` typing is loose. If runtime passes, proceed — Step 3 locks the type; the value is the guardrail.

- [ ] **Step 3: Type the field**

In `apps/web/src/tools/form-builder/model.ts`, add the import near the other type imports at the top:

```ts
import type { TableConfig } from "@rfjs/table-builder";
```

Change the `Card` interface field (currently `resultTable?: unknown; // result`):

```ts
  resultTable?: TableConfig; // result
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm -F web vitest run model`
Expected: PASS.

Run: `pnpm -F web typecheck`
Expected: no errors from `model.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/form-builder/model.ts apps/web/src/tools/form-builder/model.spec.ts
git commit -m "$(cat <<'EOF'
feat(web): type form-builder Card.resultTable as TableConfig

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Form tool — snapshot helper + inspector UI + demo data

**Files:**
- Create: `apps/web/src/tools/form-builder/inspector/result-table-snapshot.ts`
- Test: `apps/web/src/tools/form-builder/inspector/result-table-snapshot.spec.ts`
- Modify: `apps/web/src/tools/form-builder/inspector/result.tsx`
- Modify: `apps/web/src/tools/form-builder/ui.tsx` (`createPreviewFetcher`)
- Modify: `apps/web/src/tools/form-builder/sample.ts`
- Modify: `apps/web/src/tools/form-builder/ui.spec.tsx:195-202` (update the stale card-mode integration test to guard the table path)

**Interfaces:**
- Consumes: `inferFieldsFromRows` (`@rfjs/data-schema`), `deriveTableConfig`, `TableConfig` (`@rfjs/table-builder`); `Card`/`onChange` from `../model`.
- Produces: `snapshotTableConfig(text: string): { config?: TableConfig; error?: string }`; `ResultSection` renders a snapshot control for `mode:'table'`.

- [ ] **Step 1: Write the failing helper test**

Create `apps/web/src/tools/form-builder/inspector/result-table-snapshot.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { snapshotTableConfig } from "./result-table-snapshot";

describe("snapshotTableConfig", () => {
  it("derives a TableConfig from a sample array", () => {
    const { config, error } = snapshotTableConfig('[{"id":1,"name":"Ada"}]');
    expect(error).toBeUndefined();
    expect(config?.columns.map((c) => c.key)).toEqual(["id", "name"]);
    expect(config?.pagination.pageSize).toBeGreaterThan(0);
  });

  it("wraps a single object into a one-row inference", () => {
    const { config } = snapshotTableConfig('{"a":1,"b":"x"}');
    expect(config?.columns.map((c) => c.key)).toEqual(["a", "b"]);
  });

  it("returns an error for invalid JSON", () => {
    const { config, error } = snapshotTableConfig("{not json");
    expect(config).toBeUndefined();
    expect(error).toMatch(/json/i);
  });

  it("returns an error for an empty array", () => {
    const { error } = snapshotTableConfig("[]");
    expect(error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F web vitest run result-table-snapshot`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the helper**

Create `apps/web/src/tools/form-builder/inspector/result-table-snapshot.ts`:

```ts
import { deriveTableConfig, type TableConfig } from "@rfjs/table-builder";
import { inferFieldsFromRows } from "@rfjs/data-schema";

/**
 * Turn a pasted sample response into a TableConfig via infer→derive.
 * Accepts an array of row objects or a single object (wrapped to one row).
 * Pure and self-contained so it unit-tests without rendering.
 */
export function snapshotTableConfig(text: string): { config?: TableConfig; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "Invalid JSON" };
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  try {
    const fields = inferFieldsFromRows(rows);
    if (fields.length === 0) return { error: "No columns found in the sample" };
    return { config: deriveTableConfig({ fields }) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read the sample" };
  }
}
```

- [ ] **Step 4: Run helper test to verify it passes**

Run: `pnpm -F web vitest run result-table-snapshot`
Expected: PASS.

- [ ] **Step 5: Write the failing inspector test**

Add to `apps/web/src/tools/form-builder/inspector/result.spec.tsx` (create the file if it does not exist, mirroring a sibling inspector spec's imports):

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { ResultSection } from "./result";
import type { Card } from "../model";

const baseCard = { id: "res", groupId: "g1", kind: "result", label: "Result", mode: "table", col: 1, span: 6, row: 1 } as Card;

describe("ResultSection table snapshot", () => {
  it("snapshots pasted rows into resultTable", () => {
    const onChange = vi.fn();
    render(<ResultSection card={baseCard} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/paste a sample/i), {
      target: { value: '[{"id":1,"name":"Ada"}]' },
    });
    fireEvent.click(screen.getByRole("button", { name: /snapshot/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ resultTable: expect.objectContaining({ columns: expect.any(Array) }) }),
    );
  });

  it("shows an error and does not write on invalid JSON", () => {
    const onChange = vi.fn();
    render(<ResultSection card={baseCard} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/paste a sample/i), { target: { value: "{bad" } });
    fireEvent.click(screen.getByRole("button", { name: /snapshot/i }));
    expect(screen.getByText(/invalid json/i)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears resultTable", () => {
    const onChange = vi.fn();
    const withTable = { ...baseCard, resultTable: { columns: [{ key: "x", label: "X", dataType: "string" }], pagination: { pageSize: 10 } } } as Card;
    render(<ResultSection card={withTable} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith({ resultTable: undefined });
  });
});
```

- [ ] **Step 6: Run inspector test to verify it fails**

Run: `pnpm -F web vitest run result.spec`
Expected: FAIL — no snapshot textarea/button yet.

- [ ] **Step 7: Implement the inspector snapshot UI**

In `apps/web/src/tools/form-builder/inspector/result.tsx`:

Add imports at the top:

```tsx
import { snapshotTableConfig } from "./result-table-snapshot";
```

Change the mode `<option>` line (drop "coming soon"):

```tsx
          {MODES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
```

Add a snapshot sub-panel. After the "Max items" block (which is `mode === "card"`), add a `mode === "table"` block:

```tsx
      {mode === "table" && <TableSnapshot card={card} onChange={onChange} />}
```

And define `TableSnapshot` below the `ResultSection` function in the same file:

```tsx
function TableSnapshot({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const columnCount = card.resultTable?.columns.length ?? 0;

  function doSnapshot() {
    const { config, error: err } = snapshotTableConfig(text);
    if (err || !config) {
      setError(err ?? "Could not read the sample");
      return;
    }
    setError(null);
    onChange({ resultTable: config });
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-input bg-muted/20 p-2">
      <span className="text-xs text-muted-foreground">
        {columnCount > 0 ? `${columnCount} columns captured — edit in the JSON tab` : "No columns yet — auto-derived from the response, or snapshot a sample:"}
      </span>
      <textarea
        className={`${INPUT_CLS} font-mono`}
        rows={3}
        value={text}
        placeholder='Paste a sample response, e.g. [{"id":1,"name":"Ada"}]'
        onChange={(e) => setText(e.target.value)}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
      <div className="flex gap-2">
        <button type="button" className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted" onClick={doSnapshot}>
          Snapshot columns
        </button>
        {columnCount > 0 && (
          <button type="button" className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted" onClick={() => onChange({ resultTable: undefined })}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run inspector tests to verify they pass**

Run: `pnpm -F web vitest run result.spec result-table-snapshot`
Expected: PASS.

- [ ] **Step 9: Make the demo fetcher return rows for query URLs**

In `apps/web/src/tools/form-builder/ui.tsx`, add a sample-rows constant above `createPreviewFetcher`:

```ts
const SAMPLE_QUERY_ROWS = [
  { id: 1001, name: "Ada Lovelace", email: "ada@example.com", amount: 1240, status: "paid" },
  { id: 1002, name: "Alan Turing", email: "alan@example.com", amount: 980, status: "pending" },
  { id: 1003, name: "Grace Hopper", email: "grace@example.com", amount: 3010, status: "paid" },
];
```

Change the api-action branch of `createPreviewFetcher` to attach rows for query-shaped URLs:

```ts
  if (
    req.body &&
    typeof req.body === "object" &&
    "data" in req.body &&
    "meta" in req.body
  ) {
    // api-action request: echo it back with a timestamp; query-shaped URLs also get demo rows.
    const echo = { echoedAt: new Date().toISOString(), received: req.body };
    return /search|query|list/i.test(req.url) ? { ...echo, data: SAMPLE_QUERY_ROWS } : echo;
  }
```

(Note: `createPreviewFetcher` currently takes `{ url, body }`; the `url` field is already present in callers. If the local signature omits `url`, add it: `req: { url: string; body?: unknown }`.)

- [ ] **Step 10: Point the sample result item at the rows and use table mode**

In `apps/web/src/tools/form-builder/sample.ts`, change the `res_query` item:

```ts
            { id: "res_query", kind: "result", mode: "table", sourceId: "btn_query", dataPath: "data", emptyText: "Run a query to see results" },
```

- [ ] **Step 10b: Update the stale `res_query` integration test**

`ui.spec.tsx:195-202` was written for card mode (`received.data` → KV card). After Step 9/10 it silently exercises the table path and its name/comment are wrong. Replace the whole `it(...)` block with one that reflects table mode and asserts on table-specific content from `SAMPLE_QUERY_ROWS` (a header key + a cell value the card demo never had):

```tsx
  it("preview: query api button renders its rows as a ConfigTable in the result", async () => {
    renderTool();
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^query$/i }));
    // query fetcher returns SAMPLE_QUERY_ROWS under `data`; result mode:'table' → ConfigTable headers + rows
    const resultContainer = document.querySelector('[data-item="res_query"]') as HTMLElement;
    await waitFor(() => expect(resultContainer.textContent).toMatch(/email/i));
    expect(resultContainer.textContent).toMatch(/Ada Lovelace/);
  });
```

(`ui.spec.tsx` already installs a top-of-file `ResizeObserver` mock, so `<ConfigTable>` renders in jsdom without crashing.)

- [ ] **Step 11: Run the tool's full test + typecheck**

Run: `pnpm -F web vitest run form-builder`
Expected: PASS (including the existing `ui.spec.tsx` `createPreviewFetcher` test — `received` still equals the body for non-query URLs).

Run: `pnpm -F web typecheck`
Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/tools/form-builder/inspector/result-table-snapshot.ts apps/web/src/tools/form-builder/inspector/result-table-snapshot.spec.ts apps/web/src/tools/form-builder/inspector/result.tsx apps/web/src/tools/form-builder/inspector/result.spec.tsx apps/web/src/tools/form-builder/ui.tsx apps/web/src/tools/form-builder/ui.spec.tsx apps/web/src/tools/form-builder/sample.ts
git commit -m "$(cat <<'EOF'
feat(web): add result table snapshot control and table-mode sample

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Changesets, full verification, screenshot

**Files:**
- Create: `.changeset/form-result-table-render.md`
- Create: `.changeset/form-result-table-ui.md`

- [ ] **Step 1: Add changesets**

Create `.changeset/form-result-table-render.md`:

```md
---
"@rfjs/form-builder": minor
---

Type and validate the result item `table` field as `TableConfig` (was `unknown`), backing the form result `mode:'table'` renderer.
```

Create `.changeset/form-result-table-ui.md`:

```md
---
"@rfjs/form-builder-ui": minor
---

Render result items with `mode:'table'` using `@rfjs/table-builder-ui`'s `ConfigTable`, deriving columns from the response when no `table` config is carried.
```

- [ ] **Step 2: Full affected verification**

Run: `pnpm -F @rfjs/form-builder -F @rfjs/form-builder-ui -F web test`
Expected: all PASS.

Run: `pnpm -F @rfjs/form-builder -F @rfjs/form-builder-ui -F web typecheck`
Expected: no errors.

Run: `pnpm -F @rfjs/form-builder -F @rfjs/form-builder-ui -F web lint`
Expected: no errors.

- [ ] **Step 3: Screenshot the real app (verify skill)**

Start the web dev server and drive the form-builder tool: switch the result item to table mode / run the sample query, confirm a real `ConfigTable` renders (headers, sortable, paginated) in the preview, and capture a screenshot. Also open the inspector for the result item and confirm the snapshot control appears with `mode:'table'`.

Run: `pnpm dev -F web` (port 3000), navigate to the form-builder tool.
Expected: table renders from `SAMPLE_QUERY_ROWS`; inspector shows the snapshot panel.

- [ ] **Step 4: Commit changesets**

```bash
git add .changeset/form-result-table-render.md .changeset/form-result-table-ui.md
git commit -m "$(cat <<'EOF'
chore: changesets for form result table mode

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: HOLD** — do not push or open a PR. Report the branch state and screenshots; wait for the go-ahead.

---

## Self-Review

**Spec coverage:**
- §1 A render → Task 2 + Task 3. ✅
- §1 B snapshot → Task 5. ✅
- §4.2 engine type + zod → Task 1. ✅
- §5 file table → Tasks 1–5 cover every row (model mapping already existed; typed in Task 4). ✅
- §6 snapshot UX (paste-sample, status, clear, JSON note) → Task 5 Step 7. ✅
- §8 tests: render (Task 2), snapshot (Task 5), model round-trip (Task 4), config-schema (Task 1). ✅ config-form integration (Task 3) is an extra guardrail.
- §9 changesets → Task 6. ✅
- §2 non-goals honored: no `@dnd-kit`, no per-column editor, no messages.ts routing. ✅

**Placeholder scan:** no TBD/TODO; every code step shows code. ✅

**Type consistency:** `snapshotTableConfig` (helper) matches between Task 5 helper + test + inspector. `ResultViewProps.table` matches Task 2 def, Task 3 usage. `Card.resultTable: TableConfig` matches Task 4 + Task 5 usage. `deriveTableConfig({ fields })` / `inferFieldsFromRows(rows)` signatures consistent across Tasks 2 and 5. ✅

**Known runtime caveat:** if `ConfigTable` requires a `ResizeObserver` in jsdom, reuse this package's existing `installResizeObserverMock` pattern in the affected describe blocks (flagged in Tasks 2 and 3).
