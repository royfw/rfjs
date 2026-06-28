"use client";

import * as React from "react";
import { Type, AlignLeft, Minus, MoveVertical, Sparkles, Trash2, Grid3x3 } from "lucide-react";

// ---------------------------------------------------------------------------
// Direction C — 2D free-canvas form builder (evaluation prototype).
//
// Cards are positioned absolutely on a snap-to-grid canvas: drag the body to
// move, drag the right edge to resize the width, click to select, Delete to
// remove. No engine logic (validation/conditional/dataSource) is wired — this
// only evaluates whether free 2D layout beats the linear section→row model.
// ---------------------------------------------------------------------------

const GRID = 24; // snap step (px)
const snap = (v: number) => Math.round(v / GRID) * GRID;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type Kind = "field" | "content" | "divider" | "spacer" | "ai-note";

interface CanvasNode {
  id: string;
  kind: Kind;
  label: string;
  sub?: string;
  x: number;
  y: number;
  w: number;
}

const KIND_META: Record<
  Kind,
  { color: string; icon: React.ComponentType<{ className?: string }>; h: number; label: string }
> = {
  field: { color: "#5b8cff", icon: Type, h: 72, label: "Field" },
  content: { color: "#7c5cff", icon: AlignLeft, h: 48, label: "Content" },
  "ai-note": { color: "#d9a441", icon: Sparkles, h: 48, label: "AI Note" },
  divider: { color: "#6b7280", icon: Minus, h: 24, label: "Divider" },
  spacer: { color: "#6b7280", icon: MoveVertical, h: 48, label: "Spacer" },
};

const SEED: CanvasNode[] = [
  { id: "n1", kind: "field", label: "Name", sub: "name · Input", x: 24, y: 24, w: 240 },
  { id: "n2", kind: "field", label: "Email", sub: "email · Input", x: 288, y: 24, w: 240 },
  { id: "n3", kind: "field", label: "Bio", sub: "bio · Textarea", x: 24, y: 120, w: 504 },
  { id: "n4", kind: "divider", label: "Divider", x: 24, y: 216, w: 504 },
  { id: "n5", kind: "field", label: "Role", sub: "role · Select", x: 24, y: 264, w: 240 },
  { id: "n6", kind: "ai-note", label: "If unsure, default to 'user'", x: 288, y: 264, w: 240 },
];

let seq = SEED.length;

export function CanvasPrototype() {
  const [nodes, setNodes] = React.useState<CanvasNode[]>(SEED);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [showGrid, setShowGrid] = React.useState(true);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  // Live drag state kept in a ref so window listeners read fresh values.
  const drag = React.useRef<
    | { id: string; mode: "move" | "resize"; px: number; py: number; nx: number; ny: number; nw: number }
    | null
  >(null);

  const patch = (id: string, p: Partial<CanvasNode>) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...p } : n)));

  function beginDrag(e: React.PointerEvent, node: CanvasNode, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    setSelected(node.id);
    drag.current = { id: node.id, mode, px: e.clientX, py: e.clientY, nx: node.x, ny: node.y, nw: node.w };

    const onMove = (ev: PointerEvent) => {
      const d = drag.current;
      const canvas = canvasRef.current;
      if (!d || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = ev.clientX - d.px;
      const dy = ev.clientY - d.py;
      if (d.mode === "move") {
        const maxX = rect.width - d.nw;
        const maxY = rect.height - KIND_META[node.kind].h;
        patch(d.id, { x: clamp(snap(d.nx + dx), 0, Math.max(0, maxX)), y: clamp(snap(d.ny + dy), 0, Math.max(0, maxY)) });
      } else {
        const maxW = rect.width - d.nx;
        patch(d.id, { w: clamp(snap(d.nw + dx), GRID * 3, maxW) });
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

  function addNode(kind: Kind) {
    seq += 1;
    const id = `n${seq}`;
    setNodes((ns) => [
      ...ns,
      { id, kind, label: KIND_META[kind].label, sub: kind === "field" ? "field · Input" : undefined, x: 24, y: 24, w: 240 },
    ]);
    setSelected(id);
  }

  function removeSelected() {
    if (!selected) return;
    setNodes((ns) => ns.filter((n) => n.id !== selected));
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
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold">Form Canvas</h1>
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Direction C · 2D prototype
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag to move · drag the right edge to resize · click to select · Delete to remove. Snaps to a {GRID}px grid.
        </p>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
        {PALETTE.map((kind) => {
          const m = KIND_META[kind];
          const Icon = m.icon;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => addNode(kind)}
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
            onClick={() => setShowGrid((v) => !v)}
            aria-pressed={showGrid}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors ${
              showGrid
                ? "border-[#5b8cff]/40 bg-[#5b8cff]/10 text-foreground"
                : "border-input bg-card/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Grid3x3 className="size-3.5" />
            Grid
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

      {/* Canvas */}
      <div className="p-6">
        <div
          ref={canvasRef}
          onPointerDown={() => setSelected(null)}
          className="relative min-h-[640px] w-full overflow-hidden rounded-xl border border-border bg-card/20"
          style={
            showGrid
              ? {
                  backgroundImage:
                    "radial-gradient(circle, color-mix(in srgb, var(--muted-foreground) 22%, transparent) 1px, transparent 1px)",
                  backgroundSize: `${GRID}px ${GRID}px`,
                  backgroundPosition: "0 0",
                }
              : undefined
          }
        >
          {nodes.map((node) => (
            <CanvasCard
              key={node.id}
              node={node}
              selected={selected === node.id}
              onMoveStart={(e) => beginDrag(e, node, "move")}
              onResizeStart={(e) => beginDrag(e, node, "resize")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CanvasCard — a single positioned, draggable, resizable field card.
// ---------------------------------------------------------------------------

function CanvasCard({
  node,
  selected,
  onMoveStart,
  onResizeStart,
}: {
  node: CanvasNode;
  selected: boolean;
  onMoveStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
}) {
  const m = KIND_META[node.kind];
  const Icon = m.icon;

  return (
    <div
      onPointerDown={onMoveStart}
      className={`group absolute cursor-grab touch-none select-none rounded-lg border bg-card shadow-sm transition-shadow active:cursor-grabbing ${
        selected ? "border-transparent ring-2 ring-[#5b8cff]" : "border-border hover:shadow-md"
      }`}
      style={{ left: node.x, top: node.y, width: node.w, height: m.h, boxShadow: `inset 3px 0 0 ${m.color}` }}
    >
      {node.kind === "divider" ? (
        <div className="flex h-full items-center gap-2 px-3">
          <Icon className="size-3.5 shrink-0" style={{ color: m.color }} />
          <hr className="w-full border-border" />
        </div>
      ) : (
        <div className="flex h-full flex-col justify-center gap-1 px-3">
          <div className="flex items-center gap-2">
            <span
              className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px]"
              style={{ backgroundColor: `${m.color}1f`, color: m.color }}
            >
              <Icon className="size-3" />
            </span>
            <span className="truncate text-sm font-medium">{node.label}</span>
            {node.sub ? <span className="truncate font-mono text-[11px] text-muted-foreground/70">{node.sub}</span> : null}
          </div>
          {node.kind === "field" ? (
            <div className="h-7 rounded-md border border-input bg-background/60" />
          ) : null}
        </div>
      )}

      {/* Resize handle (right edge) */}
      <div
        onPointerDown={onResizeStart}
        className="absolute right-0 top-0 flex h-full w-2.5 cursor-col-resize items-center justify-center"
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
