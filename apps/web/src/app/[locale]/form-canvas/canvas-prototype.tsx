"use client";

import * as React from "react";
import {
  Type,
  AlignLeft,
  Minus,
  MoveVertical,
  Sparkles,
  Trash2,
  ChevronDown,
  GripVertical,
  Plus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Direction C (hybrid) — "A's structure + C's drag freedom".
//
// A vertical stack of GROUP frames. Each group is a 12-column grid that fills
// the container width. Cards live on the grid as {col, span, row}: drag the
// body to move (snaps to a column + row, and across groups), drag the right
// edge to resize the column span. Click to select, Delete to remove. No engine
// logic — layout evaluation only.
// ---------------------------------------------------------------------------

const COLS = 12;
const ROW_H = 84; // px per grid row
const GAP = 8;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Kind = "field" | "content" | "divider" | "spacer" | "ai-note";

interface Card {
  id: string;
  groupId: string;
  kind: Kind;
  label: string;
  sub?: string;
  col: number; // 1-based start column
  span: number; // column span (1..12)
  row: number; // 1-based grid row
}

interface Group {
  id: string;
  title: string;
  collapsed: boolean;
}

const KIND_META: Record<
  Kind,
  { color: string; icon: React.ComponentType<{ className?: string }>; label: string; field?: boolean }
> = {
  field: { color: "#5b8cff", icon: Type, label: "Field", field: true },
  content: { color: "#7c5cff", icon: AlignLeft, label: "Content" },
  "ai-note": { color: "#d9a441", icon: Sparkles, label: "AI Note" },
  divider: { color: "#6b7280", icon: Minus, label: "Divider" },
  spacer: { color: "#6b7280", icon: MoveVertical, label: "Spacer" },
};

const SEED_GROUPS: Group[] = [
  { id: "g_account", title: "Account", collapsed: false },
  { id: "g_profile", title: "Profile", collapsed: false },
];

const SEED_CARDS: Card[] = [
  { id: "c1", groupId: "g_account", kind: "field", label: "Name", sub: "name · Input", col: 1, span: 6, row: 1 },
  { id: "c2", groupId: "g_account", kind: "field", label: "Email", sub: "email · Input", col: 7, span: 6, row: 1 },
  { id: "c3", groupId: "g_account", kind: "field", label: "Role", sub: "role · Select", col: 1, span: 6, row: 2 },
  { id: "c4", groupId: "g_account", kind: "ai-note", label: "If unsure, default to 'user'", col: 7, span: 6, row: 2 },
  { id: "c5", groupId: "g_account", kind: "field", label: "Bio", sub: "bio · Textarea", col: 1, span: 12, row: 3 },
  { id: "c6", groupId: "g_profile", kind: "field", label: "Age", sub: "age · Number", col: 1, span: 4, row: 1 },
  { id: "c7", groupId: "g_profile", kind: "field", label: "Country", sub: "country · Select", col: 5, span: 4, row: 1 },
  { id: "c8", groupId: "g_profile", kind: "field", label: "Birthday", sub: "birthday · DatePicker", col: 9, span: 4, row: 1 },
  { id: "c9", groupId: "g_profile", kind: "field", label: "Subscribe", sub: "newsletter · Switch", col: 1, span: 6, row: 2 },
];

let seq = 100;
let gseq = 10;

export function CanvasPrototype() {
  const [groups, setGroups] = React.useState<Group[]>(SEED_GROUPS);
  const [cards, setCards] = React.useState<Card[]>(SEED_CARDS);
  const [selected, setSelected] = React.useState<string | null>(null);
  const bodyRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const drag = React.useRef<
    | { id: string; mode: "move" | "resize"; col: number; span: number; row: number; groupId: string }
    | null
  >(null);

  const patch = (id: string, p: Partial<Card>) =>
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));

  // Map a pointer position to a {groupId, col, row} grid cell.
  function cellAt(clientX: number, clientY: number, fallbackGroup: string) {
    let groupId = fallbackGroup;
    let rect: DOMRect | null = bodyRefs.current[fallbackGroup]?.getBoundingClientRect() ?? null;
    for (const [gid, el] of Object.entries(bodyRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        groupId = gid;
        rect = r;
        break;
      }
    }
    if (!rect) return { groupId, col: 1, row: 1, colW: 0, rect: null as DOMRect | null };
    const colW = (rect.width + GAP) / COLS;
    const col = clamp(Math.round((clientX - rect.left) / colW) + 1, 1, COLS);
    const row = clamp(Math.round((clientY - rect.top) / (ROW_H + GAP)) + 1, 1, 99);
    return { groupId, col, row, colW, rect };
  }

  function beginDrag(e: React.PointerEvent, card: Card, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    setSelected(card.id);
    drag.current = { id: card.id, mode, col: card.col, span: card.span, row: card.row, groupId: card.groupId };

    const onMove = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (d.mode === "move") {
        const { groupId, col, row } = cellAt(ev.clientX, ev.clientY, d.groupId);
        patch(d.id, { groupId, col: clamp(col, 1, COLS - d.span + 1), row });
      } else {
        const body = bodyRefs.current[d.groupId];
        if (!body) return;
        const rect = body.getBoundingClientRect();
        const colW = (rect.width + GAP) / COLS;
        const rightCol = Math.round((ev.clientX - rect.left) / colW); // 0-based exclusive edge
        patch(d.id, { span: clamp(rightCol - (d.col - 1), 1, COLS - d.col + 1) });
      }
    };
    const onUp = () => {
      drag.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function addCard(kind: Kind) {
    const groupId = (selected && cards.find((c) => c.id === selected)?.groupId) || groups[0]?.id;
    if (!groupId) return;
    const maxRow = cards.filter((c) => c.groupId === groupId).reduce((m, c) => Math.max(m, c.row), 0);
    seq += 1;
    const id = `c${seq}`;
    setCards((cs) => [
      ...cs,
      { id, groupId, kind, label: KIND_META[kind].label, sub: kind === "field" ? "field · Input" : undefined, col: 1, span: kind === "field" ? 6 : 12, row: maxRow + 1 },
    ]);
    setSelected(id);
  }

  function addGroup() {
    gseq += 1;
    setGroups((gs) => [...gs, { id: `g${gseq}`, title: `Section ${gs.length + 1}`, collapsed: false }]);
  }

  function removeSelected() {
    if (!selected) return;
    setCards((cs) => cs.filter((c) => c.id !== selected));
    setSelected(null);
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const PALETTE: Kind[] = ["field", "content", "divider", "spacer", "ai-note"];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold">Form Canvas</h1>
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Direction C · structure + drag
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {COLS}-column groups · drag to move (across groups too) · drag the right edge to resize · Delete to remove.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
        {PALETTE.map((kind) => {
          const m = KIND_META[kind];
          const Icon = m.icon;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => addCard(kind)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card/40 px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Icon className="size-3.5" style={{ color: m.color }} />
              {m.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={addGroup}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card/40 px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Group
          </button>
          <button
            type="button"
            onClick={removeSelected}
            disabled={!selected}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card/40 px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors enabled:hover:border-destructive/50 enabled:hover:text-destructive disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* Stacked group frames */}
      <div className="flex flex-col gap-4 p-6" onPointerDown={() => setSelected(null)}>
        {groups.map((group) => {
          const groupCards = cards.filter((c) => c.groupId === group.id);
          const maxRow = groupCards.reduce((m, c) => Math.max(m, c.row), 0);
          const rows = Math.max(maxRow + 1, 2); // keep a spare row as a drop target
          return (
            <section key={group.id} className="overflow-hidden rounded-xl border border-border bg-card/20">
              <header className="flex items-center gap-2.5 border-b border-border bg-muted/40 px-3 py-2.5">
                <button
                  type="button"
                  aria-label={group.collapsed ? "expand" : "collapse"}
                  onClick={() =>
                    setGroups((gs) => gs.map((g) => (g.id === group.id ? { ...g, collapsed: !g.collapsed } : g)))
                  }
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                >
                  <ChevronDown className={`size-4 transition-transform ${group.collapsed ? "-rotate-90" : ""}`} />
                </button>
                <span className="text-[15px] font-semibold">{group.title}</span>
                <span className="font-mono text-[11px] text-muted-foreground/50">{group.id}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/45">
                  {groupCards.length} item{groupCards.length === 1 ? "" : "s"}
                </span>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-wide text-muted-foreground/55">
                  {COLS} cols
                </span>
              </header>

              {group.collapsed ? null : (
                <div
                  ref={(el) => {
                    bodyRefs.current[group.id] = el;
                  }}
                  className="relative p-3"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                    gridAutoRows: `${ROW_H}px`,
                    gap: GAP,
                    minHeight: rows * (ROW_H + GAP),
                    // faint column guides
                    backgroundImage:
                      "repeating-linear-gradient(to right, color-mix(in srgb, var(--muted-foreground) 8%, transparent) 0 1px, transparent 1px calc(100% / 12))",
                    backgroundPosition: "12px 0",
                    backgroundSize: "calc(100% - 24px) 100%",
                    backgroundRepeat: "no-repeat",
                  }}
                >
                  {groupCards.length === 0 ? (
                    <div className="pointer-events-none col-span-12 row-start-1 flex items-center justify-center text-xs text-muted-foreground/50">
                      Drop fields here
                    </div>
                  ) : null}
                  {groupCards.map((card) => (
                    <CanvasCard
                      key={card.id}
                      card={card}
                      selected={selected === card.id}
                      onMoveStart={(e) => beginDrag(e, card, "move")}
                      onResizeStart={(e) => beginDrag(e, card, "resize")}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CanvasCard — a grid-placed, draggable, resizable card.
// ---------------------------------------------------------------------------

function CanvasCard({
  card,
  selected,
  onMoveStart,
  onResizeStart,
}: {
  card: Card;
  selected: boolean;
  onMoveStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
}) {
  const m = KIND_META[card.kind];
  const Icon = m.icon;

  return (
    <div
      onPointerDown={onMoveStart}
      className={`group relative cursor-grab touch-none select-none rounded-lg border bg-card shadow-sm transition-shadow active:cursor-grabbing ${
        selected ? "border-transparent ring-2 ring-[#5b8cff]" : "border-border hover:shadow-md"
      }`}
      style={{
        gridColumn: `${card.col} / span ${card.span}`,
        gridRow: card.row,
        boxShadow: `inset 3px 0 0 ${m.color}`,
      }}
    >
      {card.kind === "divider" ? (
        <div className="flex h-full items-center gap-2 px-3">
          <Icon className="size-3.5 shrink-0" style={{ color: m.color }} />
          <hr className="w-full border-border" />
        </div>
      ) : (
        <div className="flex h-full flex-col justify-center gap-1.5 px-3">
          <div className="flex items-center gap-2">
            <GripVertical className="size-3.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/70" />
            <span
              className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px]"
              style={{ backgroundColor: `${m.color}1f`, color: m.color }}
            >
              <Icon className="size-3" />
            </span>
            <span className="truncate text-sm font-medium">{card.label}</span>
            {card.sub ? (
              <span className="truncate font-mono text-[11px] text-muted-foreground/70">{card.sub}</span>
            ) : null}
          </div>
          {m.field ? <div className="h-7 rounded-md border border-input bg-background/60" /> : null}
        </div>
      )}

      {/* Resize handle (right edge) */}
      <div
        onPointerDown={onResizeStart}
        className="absolute right-0 top-0 flex h-full w-3 cursor-col-resize items-center justify-center"
      >
        <div
          className={`h-8 w-1 rounded-full transition-colors ${
            selected ? "bg-[#5b8cff]" : "bg-transparent group-hover:bg-border"
          }`}
        />
      </div>
    </div>
  );
}
