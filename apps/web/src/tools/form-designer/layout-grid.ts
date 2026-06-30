// Pure grid collision + compaction for the form-designer (react-grid-layout-style, vertical compaction).
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

// Move an array item from index `from` to `to` (immutable). Used for group reorder.
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from < 0 || from >= arr.length) return arr;
  const next = arr.slice();
  const [m] = next.splice(from, 1) as [T];
  next.splice(Math.max(0, Math.min(to, next.length)), 0, m);
  return next;
}
