# sql-filter Operator Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix the `@rfjs/sql-filter` column-path ILIKE wildcard bug and add the missing column operators (`endswith`, `terms`, `range`, and the case-insensitive `iX` family) so the column path reaches parity with the jsonb path.

**Architecture:** All operator logic lives in `sql-filter`'s column renderer (`src/column/operators.ts`). Which operators the editor offers is declared by the filter-builder **engine adapters** — and there are **TWO** with column op-lists that must both be extended: `engines/sql-filter.ts` (`TEXT_OPS`/`NUMERIC_OPS`) AND `engines/pg-filter.ts` (its own `COLUMN_TEXT_OPS`/`COLUMN_NUMERIC_OPS`). The pg-filter adapter is the one the workbench dataset-explorer actually uses (`engineId="pg-filter"`), so skipping it would miss the spec's goal on the real surface. The `@rfjs/pg-filter` **package** reuses `ColumnOperator` transitively (no package code change). TDD per task.

**Tech Stack:** TypeScript, Vitest (unit only for these packages), PostgreSQL LIKE/ILIKE semantics.

## Global Constraints

- Work ONLY in the worktree `/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-sql-filter-operators`. Never touch the primary checkout. Every task first asserts `git branch --show-current` == `feat-sql-filter-operators`.
- **D1 (locked):** `contains`/`startswith`/`endswith` are **case-SENSITIVE** (`LIKE`); the `iX` family is case-insensitive (`ILIKE`). This changes the pre-existing `contains`/`startswith` behaviour (was `ILIKE`); updating their existing test assertions is expected, not a regression.
- **D2 (locked):** per-type additions — `text`: `endswith, terms, ieq, ineq, icontains, istartswith, iendswith` (NO `range`); `numeric`+`timestamp`: `terms, range`; `uuid`: `terms`; `boolean`: none.
- **LIKE escaping:** literal terms in `LIKE`/`ILIKE` must be escaped and use an `ESCAPE '\'` clause. In JS source the SQL backslash is written `\\` (so the emitted SQL text reads `escape '\'`), and `escapeLike` prefixes `\`, `%`, `_` with a backslash.
- `terms` value = non-empty array; `range` value = 2-element array; else throw `ColumnQueryError(..., 'INVALID_VALUE')`.
- TDD: write/adjust the failing test first, then implement. Do not weaken existing tests except the D1-mandated `ilike`→`like` updates.
- Changeset per changed workspace package (see Task 4). Commit messages English, conventional, lowercase-lead subject, trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Do NOT push; HOLD PR.

## File map

- `packages/sql-filter/src/column/operators.ts` — `ColumnOperator` union, `ALLOWED`, `escapeLike`, render branches (T1 + T2).
- `packages/sql-filter/src/column/operators.spec.ts` — update `ilike` cases (T1); add new-op cases (T2).
- `packages/sql-filter/src/column/build.spec.ts` — update the `ilike` where-clause assertion (T1).
- `packages/filter-builder/src/engines/sql-filter.ts` — extend `TEXT_OPS`/`NUMERIC_OPS` (T3).
- `packages/filter-builder/src/engines/pg-filter.ts` — extend `COLUMN_TEXT_OPS`/`COLUMN_NUMERIC_OPS` (T3) — the workbench's engine adapter.
- `packages/filter-builder/src/engines/sql-filter.spec.ts` (line 13) + `pg-filter.spec.ts` (line 13) — flip the now-false `not.toContain` assertions (T3).
- `packages/sql-filter/README.md` + `packages/sql-filter/README.zh-TW.md` — operator table + drop the "no IN/range" claim + contains/startswith case-sensitivity (T4).
- `.changeset/*` — sql-filter minor, filter-builder minor, pg-filter patch (T4).

---

### Task 1: ① fix the ILIKE wildcard bug (escape + case-sensitive)

**Files:**
- Modify: `packages/sql-filter/src/column/operators.ts`
- Test: `packages/sql-filter/src/column/operators.spec.ts`, `packages/sql-filter/src/column/build.spec.ts`

- [ ] **Step 1: Baseline** — branch check; `pnpm -F @rfjs/sql-filter vitest:run` → all PASS. Note the count.

- [ ] **Step 2: Update the failing tests first (D1 behaviour change).** In `operators.spec.ts` replace the two assertions at lines 24-25:
```ts
it('renders text contains/startswith as case-sensitive escaped LIKE', () => {
  expect(render('text', 'contains', 'ab')).toEqual({ sql: "\"name\" like '%' || $1 || '%' escape '\\'", values: ['ab'] });
  expect(render('text', 'startswith', 'ab')).toEqual({ sql: "\"name\" like $1 || '%' escape '\\'", values: ['ab'] });
});
it('escapes LIKE metacharacters in the term', () => {
  expect(render('text', 'contains', '50%_a')).toEqual({ sql: "\"name\" like '%' || $1 || '%' escape '\\'", values: ['50\\%\\_a'] });
});
```
  In `build.spec.ts:20` change the expected where to the case-sensitive escaped form:
```ts
expect(r.where).toBe('"name" like \'%\' || $1 || \'%\' escape \'\\\' and "created_at" >= $2');
```

- [ ] **Step 3: Run tests to confirm they fail** — `pnpm -F @rfjs/sql-filter vitest:run src/column/operators.spec.ts` → the updated cases FAIL (still emitting `ilike`, unescaped).

- [ ] **Step 4: Implement.** In `operators.ts`, add the helper (top-level, above `renderColumnCondition`):
```ts
// Escape LIKE metacharacters so the bound term matches verbatim (paired with ESCAPE '\').
function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
```
  Replace the two branches (`operators.ts:58-63`):
```ts
if (operator === 'contains') {
  return `${quotedColumn} like '%' || ${params.add(escapeLike(String(value)))} || '%' escape '\\'`;
}
if (operator === 'startswith') {
  return `${quotedColumn} like ${params.add(escapeLike(String(value)))} || '%' escape '\\'`;
}
```

- [ ] **Step 5: Run tests** — `pnpm -F @rfjs/sql-filter vitest:run` → same count PASS (the two updated files now green).

- [ ] **Step 6: Commit.**
```bash
git add packages/sql-filter/src/column
git commit -m "$(printf 'fix(sql-filter): escape LIKE metachars and make contains/startswith case-sensitive\n\nThe column contains/startswith emitted ILIKE with the term concatenated around\nliteral %% wildcards, never escaping %%/_ in the term (over-match) and using\ncase-insensitive ilike. Add escapeLike + ESCAPE clause and switch to LIKE\n(case-sensitive), aligning with jsonb-query/data-filter; case-insensitive moves\nto the iX operators (Task 2).\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: ② add the missing column operators

**Files:**
- Modify: `packages/sql-filter/src/column/operators.ts`
- Test: `packages/sql-filter/src/column/operators.spec.ts`

**Interfaces produced:** `ColumnOperator` gains `endswith | terms | range | ieq | ineq | icontains | istartswith | iendswith`.

- [ ] **Step 1: Write failing tests** in `operators.spec.ts`:
```ts
it('renders endswith as case-sensitive escaped LIKE', () => {
  expect(render('text', 'endswith', 'ab')).toEqual({ sql: "\"name\" like '%' || $1 escape '\\'", values: ['ab'] });
});
it('renders the case-insensitive iX family', () => {
  expect(render('text', 'ieq', 'AB')).toEqual({ sql: 'lower("name") = lower($1)', values: ['AB'] });
  expect(render('text', 'ineq', 'AB')).toEqual({ sql: 'lower("name") <> lower($1)', values: ['AB'] });
  expect(render('text', 'icontains', 'ab')).toEqual({ sql: "\"name\" ilike '%' || $1 || '%' escape '\\'", values: ['ab'] });
  expect(render('text', 'istartswith', 'ab')).toEqual({ sql: "\"name\" ilike $1 || '%' escape '\\'", values: ['ab'] });
  expect(render('text', 'iendswith', 'ab')).toEqual({ sql: "\"name\" ilike '%' || $1 escape '\\'", values: ['ab'] });
});
it('renders terms as = ANY(array)', () => {
  expect(render('uuid', 'terms', ['a', 'b'])).toEqual({ sql: '"name" = any($1)', values: [['a', 'b']] });
  expect(render('numeric', 'terms', [1, 2])).toEqual({ sql: '"name" = any($1)', values: [[1, 2]] });
});
it('renders range as BETWEEN two params', () => {
  expect(render('numeric', 'range', [1, 9])).toEqual({ sql: '"name" between $1 and $2', values: [1, 9] });
});
it('validates terms/range value shape and per-type allow-lists', () => {
  expect(() => render('numeric', 'terms', 5)).toThrow(ColumnQueryError);      // not an array
  expect(() => render('numeric', 'terms', [])).toThrow(ColumnQueryError);     // empty
  expect(() => render('numeric', 'range', [1])).toThrow(ColumnQueryError);    // not 2 elements
  expect(() => render('boolean', 'terms', [true])).toThrow(ColumnQueryError); // not allowed on boolean
  expect(() => render('text', 'range', ['a', 'b'])).toThrow(ColumnQueryError);// text has no range (D2)
});
```

- [ ] **Step 2: Run → fail** — `pnpm -F @rfjs/sql-filter vitest:run src/column/operators.spec.ts` (new cases fail: operators not in union / not allowed).

- [ ] **Step 3: Extend the union** (`operators.ts:5-15`):
```ts
export type ColumnOperator =
  | 'eq' | 'neq' | 'isnull' | 'isnotnull'
  | 'contains' | 'startswith' | 'endswith'
  | 'icontains' | 'istartswith' | 'iendswith' | 'ieq' | 'ineq'
  | 'terms' | 'range'
  | 'gt' | 'gte' | 'lt' | 'lte';
```

- [ ] **Step 4: Extend `ALLOWED`** (per D2):
```ts
const ALLOWED: Record<ColumnType, ReadonlySet<ColumnOperator>> = {
  text: new Set(['eq','neq','isnull','isnotnull','contains','startswith','endswith','icontains','istartswith','iendswith','ieq','ineq','terms','gt','gte','lt','lte']),
  numeric: new Set(['eq','neq','isnull','isnotnull','gt','gte','lt','lte','terms','range']),
  timestamp: new Set(['eq','neq','isnull','isnotnull','gt','gte','lt','lte','terms','range']),
  boolean: new Set(['eq','neq','isnull','isnotnull']),
  uuid: new Set(['eq','neq','isnull','isnotnull','terms']),
};
```

- [ ] **Step 5: Add render branches** in `renderColumnCondition`, placed after the existing `startswith` branch and before the `COMPARATORS` lookup. `terms`/`range` validate their array shape (the generic `value === undefined` guard above already ran; arrays are defined):
```ts
if (operator === 'endswith') {
  return `${quotedColumn} like '%' || ${params.add(escapeLike(String(value)))} escape '\\'`;
}
if (operator === 'icontains') {
  return `${quotedColumn} ilike '%' || ${params.add(escapeLike(String(value)))} || '%' escape '\\'`;
}
if (operator === 'istartswith') {
  return `${quotedColumn} ilike ${params.add(escapeLike(String(value)))} || '%' escape '\\'`;
}
if (operator === 'iendswith') {
  return `${quotedColumn} ilike '%' || ${params.add(escapeLike(String(value)))} escape '\\'`;
}
if (operator === 'ieq') {
  return `lower(${quotedColumn}) = lower(${params.add(value)})`;
}
if (operator === 'ineq') {
  return `lower(${quotedColumn}) <> lower(${params.add(value)})`;
}
if (operator === 'terms') {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ColumnQueryError(`Operator "terms" requires a non-empty array`, 'INVALID_VALUE');
  }
  return `${quotedColumn} = any(${params.add(value)})`;
}
if (operator === 'range') {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new ColumnQueryError(`Operator "range" requires a [lo, hi] array`, 'INVALID_VALUE');
  }
  return `${quotedColumn} between ${params.add(value[0])} and ${params.add(value[1])}`;
}
```

- [ ] **Step 6: Run tests** — `pnpm -F @rfjs/sql-filter vitest:run` → all PASS. Also `pnpm -F @rfjs/sql-filter check-types`.

- [ ] **Step 7: Commit.**
```bash
git add packages/sql-filter/src/column
git commit -m "$(printf 'feat(sql-filter): add endswith/terms/range/iX column operators\n\nExtend the column path to reach parity with jsonb: endswith (escaped LIKE),\nterms (= ANY array), range (BETWEEN), and the case-insensitive iX family\n(ieq/ineq via lower(); icontains/istartswith/iendswith via escaped ILIKE),\nwith per-type allow-lists per the design (text: no range; uuid: terms only;\nboolean: none) and terms/range value-shape validation.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: filter-builder engine adapters (sql-filter AND pg-filter) — offer the new operators

**BOTH adapters have their own column op-lists.** `engines/sql-filter.ts` (`TEXT_OPS`/`NUMERIC_OPS`) and `engines/pg-filter.ts` (`COLUMN_TEXT_OPS`/`COLUMN_NUMERIC_OPS`) are independent — extend both, or the workbench (which uses `engineId="pg-filter"`) won't offer the new column ops.

**Files:**
- Modify: `packages/filter-builder/src/engines/sql-filter.ts`, `packages/filter-builder/src/engines/pg-filter.ts`
- Test: `packages/filter-builder/src/engines/sql-filter.spec.ts` (line 13), `packages/filter-builder/src/engines/pg-filter.spec.ts` (line 13).

- [ ] **Step 1: Baseline** — branch check; `pnpm -F @rfjs/filter-builder vitest:run` → all PASS. Note count.

- [ ] **Step 2: Extend the op lists in BOTH adapters.**
  In `engines/sql-filter.ts:16-18`:
```ts
const NULL_OPS = ["isnull", "isnotnull"];
const TEXT_OPS = ["eq", "neq", "contains", "startswith", "endswith", "icontains", "istartswith", "iendswith", "ieq", "ineq", "terms", "gt", "gte", "lt", "lte", ...NULL_OPS];
const NUMERIC_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "terms", "range", ...NULL_OPS]; // numeric + date
const BOOL_OPS = ["eq", "neq", ...NULL_OPS];
```
  In `engines/pg-filter.ts:10-12` (mirror the same additions):
```ts
const NULL_OPS = ["isnull", "isnotnull"];
const COLUMN_TEXT_OPS = ["eq", "neq", "contains", "startswith", "endswith", "icontains", "istartswith", "iendswith", "ieq", "ineq", "terms", "gt", "gte", "lt", "lte", ...NULL_OPS];
const COLUMN_NUMERIC_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "terms", "range", ...NULL_OPS]; // numeric + date(timestamp)
const COLUMN_BOOL_OPS = ["eq", "neq", ...NULL_OPS];
```
  (`arityOf` already maps `terms`→list, `range`→two; the `iX` ops default to `one` — correct. No `arity.ts` change.)

- [ ] **Step 3: Flip the now-false negative assertions (both spec files).**
  `engines/sql-filter.spec.ts:13` — `TEXT_OPS` now includes `terms`, so change:
```ts
// before: expect(ops).not.toContain("terms"); // sql-filter column layer has no IN list
expect(ops).toContain("terms"); // text columns now offer terms (= ANY)
```
  Optionally extend the `arrayContaining` at line 11 with e.g. `"endswith", "icontains", "ieq"`. **Leave line 20** (`numeric … not.toContain("contains")`) and **lines 24-26** (boolean exact set `["eq","neq","isnull","isnotnull"]`) unchanged — both stay valid (numeric never gains `contains`; boolean unchanged).
  `engines/pg-filter.spec.ts:13` — `COLUMN_TEXT_OPS` now includes `icontains`, so change:
```ts
// before: expect(ops).not.toContain("icontains");
expect(ops).toContain("icontains"); // text columns now offer the ci iX family
```
  Optionally add `expect(ops).toContain("endswith"); expect(ops).toContain("terms");`. **Leave the "returns ok:false when a column gets an unsupported operator" test (lines 65-69)** unchanged — it uses `numeric` + `contains`, which is still unsupported (D2: numeric gains only `terms`/`range`, not `contains`).

- [ ] **Step 4: Run tests** — `pnpm -F @rfjs/filter-builder vitest:run` → all PASS; `pnpm -F @rfjs/filter-builder check-types`.

- [ ] **Step 5: Commit.**
```bash
git add packages/filter-builder/src/engines
git commit -m "$(printf 'feat(filter-builder): offer the new sql-filter column operators (both adapters)\n\nExtend BOTH the sql-filter and pg-filter engine adapters (TEXT_OPS/NUMERIC_OPS\nand COLUMN_TEXT_OPS/COLUMN_NUMERIC_OPS) so the editor offers endswith/terms/iX\n(text) and terms/range (numeric/date) for column fields — including the\npg-filter engine the workbench uses. Flip the now-false not.toContain\nassertions in both specs. arity map already covers terms/range.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: changesets + full verification

**Files:** `packages/sql-filter/README.md` + `README.zh-TW.md`; create `.changeset/sql-filter-operators.md`, `.changeset/filter-builder-sql-ops.md`, `.changeset/pg-filter-column-ops.md`.

- [ ] **Step 1: Update the sql-filter READMEs** (`packages/sql-filter/README.md` + `README.zh-TW.md`), which currently claim the column layer has "no IN, no range" and describe `contains`/`startswith` as case-insensitive ILIKE:
  - Correct the "no IN, no range" claim — the column layer now emits `= ANY` (`terms`) and `BETWEEN` (`range`) for the applicable types.
  - Update the per-type operator table to D2 (text +`endswith`/`terms`/`iX`; numeric/timestamp +`terms`/`range`; uuid +`terms`).
  - State that `contains`/`startswith`/`endswith` are now case-**sensitive** (`LIKE`), with the `iX` family for case-insensitive.
  - `grep -rn "ilike\|no IN\|no range\|contains" packages/filter-builder/README* packages/pg-filter/README*` and fix any stale operator claims there too.
  Commit: `git add packages/sql-filter/README* packages/filter-builder/README* packages/pg-filter/README* 2>/dev/null; git commit -m "$(printf 'docs: update filter READMEs for the new sql-filter column operators\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"`

- [ ] **Step 2: Changesets.**
```markdown
---
"@rfjs/sql-filter": minor
---
Column path: fix the LIKE wildcard bug (escape `%`/`_`/`\` + `ESCAPE` clause) and
make `contains`/`startswith` case-sensitive; add `endswith`, `terms` (`= ANY`),
`range` (`BETWEEN`) and the case-insensitive `iX` family (`ieq`/`ineq`/`icontains`/
`istartswith`/`iendswith`), with per-type allow-lists.
```
```markdown
---
"@rfjs/filter-builder": minor
---
The sql-filter engine adapter now offers the new column operators
(endswith/terms/iX for text, terms/range for numeric/date) in the editor.
```
```markdown
---
"@rfjs/pg-filter": patch
---
Column-target leaves transitively gain the new sql-filter operators
(endswith/terms/range/iX); no API change.
```

- [ ] **Step 3: Full verify.** Run and confirm green:
  - `pnpm -F @rfjs/sql-filter vitest:run` + `check-types`
  - `pnpm -F @rfjs/filter-builder vitest:run` + `check-types`
  - `pnpm -F @rfjs/pg-filter vitest:run` (+ `vitest:e2e:run` if present) + `check-types` — **regression check** that mixing column + jsonb leaves still works and the new column ops flow through.

- [ ] **Step 4: Commit.**
```bash
git add .changeset
git commit -m "$(printf 'chore: changesets for sql-filter operator alignment\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:** ① bug fix (T1: escapeLike + LIKE + ESCAPE + case-sensitive) ✓; ② coverage (T2: endswith/terms/range/iX + ALLOWED per D2 + validation) ✓; adapter offering (T3) ✓; changesets for all three changed packages + pg-filter regression (T4) ✓. D1/D2 locked values used verbatim. Type-narrowing correctly out of scope.

**Placeholder scan:** all SQL strings, escape logic, test cases, and per-type sets are concrete. The one fragility (JS `\\` → SQL `\`) is called out in Global Constraints and shown in every affected string.

**Type consistency:** `ColumnOperator` union extended once (T2 Step 3) and referenced by `ALLOWED` (T2 Step 4) and both adapters' string lists (T3). `terms`→list / `range`→two arity already in `filter-builder/arity.ts` — no change needed.

## Post-ultracode corrections (2026-07-15)

Adversarial verification (5 lenses, per-finding verify) confirmed 3 distinct defects, all fixed above:
1. **[important]** `filter-builder/src/engines/sql-filter.spec.ts:13` asserts `not.toContain("terms")`; adding `terms` to `TEXT_OPS` breaks it. T3 now explicitly flips it to `toContain` (was a vague conditional).
2. **[important]** The filter-builder **`pg-filter` engine adapter** (`engines/pg-filter.ts`) has its OWN `COLUMN_TEXT_OPS`/`COLUMN_NUMERIC_OPS`, and it's the adapter the **workbench** uses (`engineId="pg-filter"`). T3 now extends BOTH adapters and flips `pg-filter.spec.ts:13` (`not.toContain("icontains")` → `toContain`); architecture note + file map corrected. This lives in the filter-builder package (already covered by its minor changeset — no new changeset). The numeric+`contains` ok:false test (`pg-filter.spec.ts:65-69`) stays valid.
3. **[minor]** sql-filter READMEs (EN + zh-TW) claim "no IN/range" and describe `contains`/`startswith` as ILIKE — falsified by ①+②. T4 Step 1 now updates them (+ greps filter-builder/pg-filter READMEs).
