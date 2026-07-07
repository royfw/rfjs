# Form-Canvas No-Overlap Drag (Stream B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Canvas cards can never overlap — dragging or resizing a card pushes colliding cards out of the way and compacts the layout upward (react-grid-layout behaviour), live and smooth.

**Architecture:** A dependency-free pure module `layout-grid.ts` implements collision detection + resolution + upward compaction on the canvas's `{col, span, row}` grid (per group, 12 columns). `ui.tsx`'s pointer-drag handler (`beginDrag`) calls it on every `pointermove` for both move and resize, and on delete. All correctness lives in the pure module (fully unit-tested); the `ui.tsx` change is thin wiring.

**Tech Stack:** TypeScript 5.7+, React 19, Vitest, Next.js (`apps/web`). Pure module has zero dependencies.

## Global Constraints

- Work in worktree `feat-form-canvas-full-config` (branch off `origin/main` @ b2eafdd, which includes #209). Run `pnpm install` once at start.
- `apps/web` consumes `@rfjs/form-builder` from its built `dist` — already current; no engine changes in this plan.
- The grid is **per group**: each `FormSection`/group is its own independent 12-column grid. `COLS = 12`.
- Collision resolution uses **upward gravity** (push colliding items down, then compact everything up — no intentional gaps). This was the chosen behaviour.
- Co-locate `*.spec.ts` next to source. Conventional commits, lowercase subject ≤100 chars; commit body ends with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. No changeset.
- DRY/YAGNI/TDD, commit per task.

---

### Task 1: `layout-grid.ts` — pure collision/compaction module

**Files:**
- Create: `apps/web/src/tools/form-canvas/layout-grid.ts`
- Test: `apps/web/src/tools/form-canvas/layout-grid.spec.ts`

**Interfaces:**
- Produces:
  - `interface GridItem { id: string; col: number; span: number; row: number; rowSpan?: number }`
  - `function collides(a: GridItem, b: GridItem): boolean`
  - `function compact(items: GridItem[], columns: number): GridItem[]` — upward gravity, no pinned item.
  - `function resolveCollisions(items: GridItem[], movedId: string, columns: number): GridItem[]` — `movedId` pinned at its current `{col,row}`; others pushed clear then compacted upward around it.
  - `interface PlacedCard extends GridItem { groupId: string }`
  - `function resolveCards(cards: PlacedCard[], draggedId: string, columns: number): PlacedCard[]` — orchestrates per group: the dragged card's group uses `resolveCollisions` (pinned), every other group uses `compact`. Returns cards with updated `col`/`row` (other fields preserved).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/tools/form-canvas/layout-grid.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { collides, compact, resolveCollisions, resolveCards, type GridItem, type PlacedCard } from "./layout-grid";

const g = (id: string, col: number, span: number, row: number): GridItem => ({ id, col, span, row });

describe("collides", () => {
  it("true when both axes overlap", () => {
    expect(collides(g("a", 1, 6, 1), g("b", 4, 6, 1))).toBe(true); // cols 1-6 vs 4-9 overlap, same row
  });
  it("false when horizontally disjoint", () => {
    expect(collides(g("a", 1, 6, 1), g("b", 7, 6, 1))).toBe(false); // 1-6 vs 7-12
  });
  it("false when on different rows", () => {
    expect(collides(g("a", 1, 6, 1), g("b", 1, 6, 2))).toBe(false);
  });
  it("never collides with itself", () => {
    const a = g("a", 1, 6, 1);
    expect(collides(a, a)).toBe(false);
  });
});

describe("compact (upward gravity)", () => {
  it("pulls a lone item with a gap up to row 1", () => {
    const out = compact([g("a", 1, 6, 5)], 12);
    expect(out.find((i) => i.id === "a")!.row).toBe(1);
  });
  it("stacks non-overlapping-column items independently at row 1", () => {
    const out = compact([g("a", 1, 6, 3), g("b", 7, 6, 9)], 12);
    expect(out.find((i) => i.id === "a")!.row).toBe(1);
    expect(out.find((i) => i.id === "b")!.row).toBe(1);
  });
  it("keeps a full-width item below a row-1 item it would collide with", () => {
    const out = compact([g("a", 1, 6, 1), g("full", 1, 12, 5)], 12);
    expect(out.find((i) => i.id === "a")!.row).toBe(1);
    expect(out.find((i) => i.id === "full")!.row).toBe(2);
  });
});

describe("resolveCollisions (move, pinned)", () => {
  it("pushes a collided item down and pins the moved item", () => {
    // 'b' originally at col1 row1; 'moved' dropped onto col1 row1 → b must move down
    const items = [g("moved", 1, 6, 1), g("b", 1, 6, 1)];
    const out = resolveCollisions(items, "moved", 12);
    expect(out.find((i) => i.id === "moved")!.row).toBe(1); // pinned
    expect(out.find((i) => i.id === "b")!.row).toBe(2); // displaced
  });
  it("produces no overlapping pair", () => {
    const items = [g("moved", 1, 8, 2), g("b", 1, 8, 2), g("c", 1, 8, 3)];
    const out = resolveCollisions(items, "moved", 12);
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) expect(collides(out[i]!, out[j]!)).toBe(false);
  });
});

describe("resolveCards (per-group orchestration)", () => {
  const pc = (id: string, groupId: string, col: number, span: number, row: number): PlacedCard => ({ id, groupId, col, span, row });
  it("resolves the dragged group and compacts the source group's gap", () => {
    // g1 has a,b stacked; drag 'a' into g2 colliding with x → x moves down; g1 compacts (b rises to row 1)
    const cards = [pc("a", "g2", 1, 6, 1), pc("b", "g1", 1, 6, 2), pc("x", "g2", 1, 6, 1)];
    const out = resolveCards(cards, "a", 12);
    expect(out.find((c) => c.id === "a")!.row).toBe(1); // dragged pinned
    expect(out.find((c) => c.id === "x")!.row).toBe(2); // displaced in g2
    expect(out.find((c) => c.id === "b")!.row).toBe(1); // g1 compacted upward
    expect(out.find((c) => c.id === "b")!.groupId).toBe("g1"); // groupId preserved
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F web vitest:run src/tools/form-canvas/layout-grid.spec.ts`
Expected: FAIL — module not found / functions undefined.

- [ ] **Step 3: Implement the module**

Create `apps/web/src/tools/form-canvas/layout-grid.ts`:

```ts
// Pure grid collision + compaction for the form-canvas (react-grid-layout-style, vertical compaction).
// Operates on a per-group 12-column grid; only ROW positions change (col/span are user-driven).

export interface GridItem {
  id: string;
  col: number; // 1-based column start
  span: number; // column span
  row: number; // 1-based row
  rowSpan?: number; // default 1
}

export interface PlacedCard extends GridItem {
  groupId: string;
}

export function collides(a: GridItem, b: GridItem): boolean {
  if (a.id === b.id) return false;
  const aRows = a.rowSpan ?? 1;
  const bRows = b.rowSpan ?? 1;
  const hOverlap = a.col < b.col + b.span && a.col + a.span > b.col;
  const vOverlap = a.row < b.row + bRows && a.row + aRows > b.row;
  return hOverlap && vOverlap;
}

// Lowest row >= 1 at which `item` does not collide with any of `placed`.
function lowestFreeRow(item: GridItem, placed: GridItem[]): number {
  let row = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const probe = { ...item, row };
    if (!placed.some((p) => collides(probe, p))) return row;
    row += 1;
  }
}

// Internal: compact upward, optionally pinning one item at its current row (placed first).
function compactWithPin(items: GridItem[], columns: number, pinnedId?: string): GridItem[] {
  const clampCol = (it: GridItem): GridItem => ({ ...it, col: Math.min(Math.max(it.col, 1), Math.max(1, columns - it.span + 1)) });
  const placed: GridItem[] = [];
  const pinned = pinnedId ? items.find((i) => i.id === pinnedId) : undefined;
  if (pinned) placed.push(clampCol(pinned));
  const rest = items
    .filter((i) => i.id !== pinnedId)
    .map(clampCol)
    .sort((a, b) => a.row - b.row || a.col - b.col);
  for (const it of rest) placed.push({ ...it, row: lowestFreeRow(it, placed) });
  return placed;
}

export function compact(items: GridItem[], columns: number): GridItem[] {
  return compactWithPin(items, columns);
}

export function resolveCollisions(items: GridItem[], movedId: string, columns: number): GridItem[] {
  return compactWithPin(items, columns, movedId);
}

export function resolveCards(cards: PlacedCard[], draggedId: string, columns: number): PlacedCard[] {
  const dragged = cards.find((c) => c.id === draggedId);
  const draggedGroup = dragged?.groupId;
  const groupIds = Array.from(new Set(cards.map((c) => c.groupId)));
  const rowById = new Map<string, { col: number; row: number }>();
  for (const gid of groupIds) {
    const groupItems: GridItem[] = cards.filter((c) => c.groupId === gid);
    const resolved = gid === draggedGroup ? resolveCollisions(groupItems, draggedId, columns) : compact(groupItems, columns);
    for (const r of resolved) rowById.set(r.id, { col: r.col, row: r.row });
  }
  return cards.map((c) => {
    const r = rowById.get(c.id);
    return r ? { ...c, col: r.col, row: r.row } : c;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F web vitest:run src/tools/form-canvas/layout-grid.spec.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/form-canvas/layout-grid.ts apps/web/src/tools/form-canvas/layout-grid.spec.ts
git commit -m "feat(form-canvas): pure grid collision + upward compaction module

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Wire collision resolution into the canvas drag/resize/delete

**Files:**
- Modify: `apps/web/src/tools/form-canvas/ui.tsx` (the `beginDrag` move/resize branches; the Delete handler)
- Test: `apps/web/src/tools/form-canvas/ui.spec.tsx` (add a no-overlap integration assertion via the exported pure layer)

**Interfaces:**
- Consumes: `resolveCards`, `compact` (Task 1).
- Produces: after any drag-move, resize, or delete, the canvas `cards` state never contains two cards in the same group sharing a cell.

**Background — current code (`apps/web/src/tools/form-canvas/ui.tsx`, lines ~119-148):** `beginDrag`'s `onMove` calls `patch(d.id, { groupId, col, row })` (move) or `patch(d.id, { span })` (resize) directly, with no collision handling. `patch` is `(id, p) => setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)))`. The delete path (`removeSelected` / Delete key) does `setCards((cs) => cs.filter((c) => c.id !== selected))`.

- [ ] **Step 1: Add the import**

At the top of `apps/web/src/tools/form-canvas/ui.tsx`, with the other `./` imports (next to `import { cardsToFormConfig, jsonToCards } from "./model";`), add:

```tsx
import { resolveCards, compact } from "./layout-grid";
```

- [ ] **Step 2: Add a `placeDragged` helper inside `FormCanvasTool`**

Immediately after the existing `patch` function definition inside `FormCanvasTool`, add a helper that patches the dragged card then resolves collisions across groups:

```tsx
  // Apply a drag/resize patch to the dragged card, then resolve overlaps (push + compact up).
  const placeDragged = (id: string, p: Partial<Card>) =>
    setCards((cs) => {
      const patched = cs.map((c) => (c.id === id ? { ...c, ...p } : c));
      return resolveCards(patched, id, COLS) as Card[];
    });
```

- [ ] **Step 3: Use `placeDragged` in `beginDrag` (move + resize)**

In `beginDrag`'s `onMove`, replace the two `patch(d.id, …)` calls with `placeDragged`:

Move branch — replace:
```tsx
        patch(d.id, { groupId, col: clamp(col, 1, COLS - card.span + 1), row });
```
with:
```tsx
        placeDragged(d.id, { groupId, col: clamp(col, 1, COLS - card.span + 1), row });
```

Resize branch — replace:
```tsx
        patch(d.id, { span: clamp(rightCol - (d.col - 1), 1, COLS - d.col + 1) });
```
with:
```tsx
        placeDragged(d.id, { span: clamp(rightCol - (d.col - 1), 1, COLS - d.col + 1) });
```

(Leave `setDropGroup(groupId)` as-is in the move branch.)

- [ ] **Step 4: Compact the group after delete**

Find the delete logic (the Delete-key handler and/or `removeSelected`) that does `setCards((cs) => cs.filter((c) => c.id !== selected))`. Replace each such filter with a version that also compacts the affected groups so no gap is left:

```tsx
      setCards((cs) => {
        const remaining = cs.filter((c) => c.id !== selected) as Card[];
        return resolveCards(remaining, "", COLS) as Card[]; // "" matches no id → every group compacts
      });
```

(`resolveCards` with a non-existent `draggedId` compacts every group via the `compact` branch — verified by Task 1's `resolveCards` using `draggedGroup === undefined`.)

- [ ] **Step 5: Add a no-overlap integration test**

Append to `apps/web/src/tools/form-canvas/ui.spec.tsx` a test that exercises the pure resolution layer on the component's seed export to prove the contract (jsdom cannot drive real pointer drag with layout geometry, so we assert the resolution invariant directly):

```tsx
import { resolveCards, collides, type PlacedCard } from "./layout-grid";

describe("canvas no-overlap invariant", () => {
  it("resolveCards leaves no two cards in a group sharing a cell after a colliding move", () => {
    const cards: PlacedCard[] = [
      { id: "a", groupId: "g1", col: 1, span: 6, row: 1 },
      { id: "b", groupId: "g1", col: 1, span: 6, row: 1 }, // a and b dropped on the same cell
      { id: "c", groupId: "g1", col: 7, span: 6, row: 1 },
    ];
    const out = resolveCards(cards, "a", 12);
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++)
        if (out[i]!.groupId === out[j]!.groupId) expect(collides(out[i]!, out[j]!)).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm -F web vitest:run src/tools/form-canvas/ui.spec.tsx src/tools/form-canvas/layout-grid.spec.ts`
Expected: PASS (existing ui tests + the new invariant test).
Run: `pnpm -F web check-types`
Expected: no errors.

- [ ] **Step 7: Manual visual check (required — confirms the live feel)**

Run: `pnpm --filter web exec next dev -p 3336`, open `http://localhost:3336/en/tools/form-canvas`, drag a card onto another and resize a card wider into a neighbour. Expected: neighbours push down and the layout compacts upward smoothly; cards never visually stack on top of each other.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/tools/form-canvas/ui.tsx apps/web/src/tools/form-canvas/ui.spec.tsx
git commit -m "feat(form-canvas): no-overlap drag/resize/delete via collision resolver

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review notes

- **Spec coverage:** Implements the spec's Unit 2 (`layout-grid.ts`) + its wiring. Stream A (full config editors) is a separate plan (`2026-06-29-form-canvas-full-config.md`, to be written next).
- **Placeholder scan:** none — all code is complete.
- **Type consistency:** `GridItem`/`PlacedCard`/`resolveCards`/`compact`/`collides` defined in Task 1, consumed verbatim in Task 2. `Card` (with `col`/`span`/`row`/`groupId`) is structurally a `PlacedCard`, so the `as Card[]` casts are safe (resolveCards preserves all non-position fields).
- **Honest test gate:** React pointer-drag isn't jsdom-testable with real geometry; correctness is proven by Task 1's pure tests + Task 2's invariant test on the pure layer + the Step-7 manual check.
