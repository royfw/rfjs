import { describe, it, expect } from 'vitest';
import type { FormConfig } from '@rfjs/form-builder';
import { resolveDragEnd } from './arranger-logic';

// ---------------------------------------------------------------------------
// Test fixture builders
// ---------------------------------------------------------------------------

function makeConfig(sections: FormConfig['sections']): FormConfig {
  return { version: 2, sections };
}

/** A minimal config with two sections, each with two rows of one item each. */
const cfg: FormConfig = makeConfig([
  {
    id: 's1',
    rows: [
      { id: 'r1', items: [{ id: 'a', kind: 'divider' }] },
      { id: 'r2', items: [{ id: 'b', kind: 'divider' }, { id: 'c', kind: 'divider' }] },
    ],
  },
  {
    id: 's2',
    rows: [
      { id: 'r3', items: [{ id: 'd', kind: 'divider' }] },
    ],
  },
]);

// ---------------------------------------------------------------------------
// resolveDragEnd — no-op cases
// ---------------------------------------------------------------------------

describe('resolveDragEnd — no-op', () => {
  it('returns config unchanged when active === over', () => {
    const result = resolveDragEnd(cfg, 'a', 'a');
    expect(result).toBe(cfg);
  });

  it('returns config unchanged when overId is empty string', () => {
    const result = resolveDragEnd(cfg, 'a', '');
    expect(result).toBe(cfg);
  });
});

// ---------------------------------------------------------------------------
// Within-row reorder (over is another item in the same row)
// ---------------------------------------------------------------------------

describe('resolveDragEnd — within-row reorder', () => {
  it('reorders items within a row when dropping item over sibling in the same row', () => {
    // b and c are both in r2; drop b over c → c,b or b moves after c
    const result = resolveDragEnd(cfg, 'b', 'c');
    const sections = result.sections!;
    const row2 = sections[0]!.rows.find((r) => r.id === 'r2')!;
    // b was at index 0, c at index 1 — dnd-kit would move b to c's position
    expect(row2.items.map((i) => i.id)).toEqual(['c', 'b']);
  });

  it('does not move item to a different row for within-row drops', () => {
    const result = resolveDragEnd(cfg, 'b', 'c');
    const sections = result.sections!;
    const row2 = sections[0]!.rows.find((r) => r.id === 'r2')!;
    expect(row2.items).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Cross-row move (over is an item in a different row)
// ---------------------------------------------------------------------------

describe('resolveDragEnd — cross-row move', () => {
  it('moves item to a different row when dropping over an item in that row', () => {
    // drop 'a' (in r1) over 'b' (in r2) → a should land in r2 at position 0
    const result = resolveDragEnd(cfg, 'a', 'b');
    const sections = result.sections!;
    const row2 = sections[0]!.rows.find((r) => r.id === 'r2');
    expect(row2).toBeDefined();
    const ids = row2!.items.map((i) => i.id);
    expect(ids).toContain('a');
  });

  it('removes the source row when it becomes empty after cross-row move', () => {
    // r1 has only 'a'; moving 'a' to r2 should eliminate r1
    const result = resolveDragEnd(cfg, 'a', 'b');
    const sections = result.sections!;
    const row1 = sections[0]!.rows.find((r) => r.id === 'r1');
    expect(row1).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// row:<rowId> — append to row
// ---------------------------------------------------------------------------

describe('resolveDragEnd — row: zone append', () => {
  it('appends item to the end of a target row when dropping on row: zone', () => {
    // move 'd' to row r2 (append)
    const result = resolveDragEnd(cfg, 'd', 'row:r2');
    const sections = result.sections!;
    const row2 = sections[0]!.rows.find((r) => r.id === 'r2')!;
    expect(row2.items.map((i) => i.id)).toContain('d');
    // 'd' should be appended (at the end)
    expect(row2.items[row2.items.length - 1]!.id).toBe('d');
  });

  it('removes the source row when it becomes empty after row: move', () => {
    const result = resolveDragEnd(cfg, 'd', 'row:r2');
    const sections = result.sections!;
    const row3 = sections[1]?.rows.find((r) => r.id === 'r3');
    // r3 (section s2) had only 'd'; should be gone or section s2 rows empty
    expect(row3).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// newrow:<sectionId>:<index> — split to new row WITHOUT index shift
// ---------------------------------------------------------------------------

describe('resolveDragEnd — newrow: zone (no index shift)', () => {
  it('splits item into a new row at the target index (no shift needed)', () => {
    // 'b' is in r2 (index 1 in s1); drop onto newrow:s1:0 → new row at index 0
    // Source row r2 has 2 items, so b's removal doesn't eliminate r2 → no shift
    const result = resolveDragEnd(cfg, 'b', 'newrow:s1:0');
    const sections = result.sections!;
    const s1 = sections.find((s) => s.id === 's1')!;
    expect(s1.rows[0]!.items[0]!.id).toBe('b');
  });

  it('leaves the original row intact when it still has items', () => {
    const result = resolveDragEnd(cfg, 'b', 'newrow:s1:0');
    const sections = result.sections!;
    const s1 = sections.find((s) => s.id === 's1')!;
    // r2 still has c
    const r2 = s1.rows.find((r) => r.items.some((i) => i.id === 'c'));
    expect(r2).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// newrow:<sectionId>:<index> — split to new row WITH index shift
// (dragged item is the only item in its source row AND source row precedes target index)
// ---------------------------------------------------------------------------

describe('resolveDragEnd — newrow: zone (WITH index shift)', () => {
  // Build a config where source row would be eliminated by the move.
  // s1: [ r1=[a], r2=[b,c] ] — 'a' is alone in r1 (index 0 in s1).
  // Dropping 'a' onto newrow:s1:2 (after r2) → after r1 is removed (r1 at index 0 < target 2),
  // the rows become [r2] (length 1), so insertion at index 1 (adjusted) → appended after r2.
  it('decrements the target index when the source row is removed before the target position', () => {
    const result = resolveDragEnd(cfg, 'a', 'newrow:s1:2');
    const sections = result.sections!;
    const s1 = sections.find((s) => s.id === 's1')!;
    // After removing r1 (was index 0), rows = [r2]. Target was 2 → adjusted to 1 → appended after r2.
    // So the new row with 'a' should be the last row in s1.
    const lastRow = s1.rows[s1.rows.length - 1]!;
    expect(lastRow.items[0]!.id).toBe('a');
    // r2 with b,c should still be there (at index 0 now)
    expect(s1.rows[0]!.items.map((i) => i.id)).toContain('b');
  });

  it('does NOT shift when source row is in a different section than the target newrow', () => {
    // 'd' is in s2 (alone in r3). Drop onto newrow:s1:1 → different section → no shift
    const result = resolveDragEnd(cfg, 'd', 'newrow:s1:1');
    const sections = result.sections!;
    const s1 = sections.find((s) => s.id === 's1')!;
    // Target index 1 means insert after r1 (index 0) and before r2 (index 1 originally)
    expect(s1.rows[1]!.items[0]!.id).toBe('d');
  });

  it('does NOT shift when source row has more than one item (row is not empty after removal)', () => {
    // 'b' is in r2 which has [b, c]. After removing b, r2 still has [c] → no elimination → no shift.
    // Drop b onto newrow:s1:2 → target index 2 should NOT be adjusted
    const result = resolveDragEnd(cfg, 'b', 'newrow:s1:2');
    const sections = result.sections!;
    const s1 = sections.find((s) => s.id === 's1')!;
    // After no shift: r1=[a], r2=[c], new_row=[b] → new_row should be at index 2
    expect(s1.rows[2]!.items[0]!.id).toBe('b');
  });
});
