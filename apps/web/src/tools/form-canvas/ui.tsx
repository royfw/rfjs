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
  Copy,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Direction C (hybrid) — "A structure + C drag freedom", now with a builder
// shell: Canvas | Preview | JSON tabs, a right-hand inspector for per-field
// config, and bidirectional JSON (edit JSON → rebuild the canvas). RWD-aware.
// Still a layout-evaluation prototype — no real validation/data engine.
// ---------------------------------------------------------------------------

const COLS = 12;
const ROW_H = 84;
const GAP = 8;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Kind = "field" | "content" | "divider" | "spacer" | "ai-note";
type Component = "Input" | "Textarea" | "Select" | "Number" | "Switch" | "DatePicker";
const COMPONENTS: Component[] = ["Input", "Textarea", "Select", "Number", "Switch", "DatePicker"];

interface Card {
  id: string;
  groupId: string;
  kind: Kind;
  label: string;
  key?: string;
  component?: Component;
  required?: boolean;
  placeholder?: string;
  col: number;
  span: number;
  row: number;
}

interface Group {
  id: string;
  title: string;
  collapsed: boolean;
}

const KIND_META: Record<
  Kind,
  { color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; field?: boolean }
> = {
  field: { color: "#5b8cff", icon: Type, label: "Field", field: true },
  content: { color: "#7c5cff", icon: AlignLeft, label: "Content" },
  "ai-note": { color: "#d9a441", icon: Sparkles, label: "AI Note" },
  divider: { color: "#6b7280", icon: Minus, label: "Divider" },
  spacer: { color: "#6b7280", icon: MoveVertical, label: "Spacer" },
};

const fieldSub = (c: Card) => (c.kind === "field" ? `${c.key ?? "field"} · ${c.component ?? "Input"}` : undefined);

const SEED_GROUPS: Group[] = [
  { id: "g_account", title: "Account", collapsed: false },
  { id: "g_profile", title: "Profile", collapsed: false },
];

const SEED_CARDS: Card[] = [
  { id: "c1", groupId: "g_account", kind: "field", label: "Name", key: "name", component: "Input", required: true, placeholder: "e.g. Jane Doe", col: 1, span: 6, row: 1 },
  { id: "c2", groupId: "g_account", kind: "field", label: "Email", key: "email", component: "Input", required: true, placeholder: "you@example.com", col: 7, span: 6, row: 1 },
  { id: "c3", groupId: "g_account", kind: "field", label: "Role", key: "role", component: "Select", col: 1, span: 6, row: 2 },
  { id: "c4", groupId: "g_account", kind: "ai-note", label: "If unsure, default to 'user'", col: 7, span: 6, row: 2 },
  { id: "c5", groupId: "g_account", kind: "field", label: "Bio", key: "bio", component: "Textarea", col: 1, span: 12, row: 3 },
  { id: "c6", groupId: "g_profile", kind: "field", label: "Age", key: "age", component: "Number", col: 1, span: 4, row: 1 },
  { id: "c7", groupId: "g_profile", kind: "field", label: "Country", key: "country", component: "Select", col: 5, span: 4, row: 1 },
  { id: "c8", groupId: "g_profile", kind: "field", label: "Birthday", key: "birthday", component: "DatePicker", col: 9, span: 4, row: 1 },
  { id: "c9", groupId: "g_profile", kind: "field", label: "Subscribe", key: "newsletter", component: "Switch", col: 1, span: 6, row: 2 },
];

let seq = 100;
let gseq = 10;

// --- (de)serialize: the canvas <-> a readable config JSON --------------------
function serialize(groups: Group[], cards: Card[]) {
  return {
    version: 1,
    groups: groups.map((g) => ({
      id: g.id,
      title: g.title,
      cols: COLS,
      items: cards
        .filter((c) => c.groupId === g.id)
        .sort((a, b) => a.row - b.row || a.col - b.col)
        .map((c) => ({
          id: c.id,
          kind: c.kind,
          label: c.label,
          ...(c.kind === "field"
            ? { key: c.key, component: c.component, required: c.required || undefined, placeholder: c.placeholder || undefined }
            : {}),
          col: c.col,
          span: c.span,
          row: c.row,
        })),
    })),
  };
}

function parse(obj: unknown): { groups: Group[]; cards: Card[] } {
  if (!obj || typeof obj !== "object" || !Array.isArray((obj as { groups?: unknown }).groups)) {
    throw new Error("expected { groups: [...] }");
  }
  const groups: Group[] = [];
  const cards: Card[] = [];
  for (const g of (obj as { groups: Array<Record<string, unknown>> }).groups) {
    const gid = String(g.id ?? `g${groups.length}`);
    groups.push({ id: gid, title: String(g.title ?? "Section"), collapsed: false });
    const items = Array.isArray(g.items) ? (g.items as Array<Record<string, unknown>>) : [];
    items.forEach((it, i) => {
      cards.push({
        id: String(it.id ?? `${gid}_${i}`),
        groupId: gid,
        kind: (it.kind as Kind) ?? "field",
        label: String(it.label ?? "Field"),
        key: it.key as string | undefined,
        component: it.component as Component | undefined,
        required: Boolean(it.required),
        placeholder: it.placeholder as string | undefined,
        col: clamp(Number(it.col ?? 1), 1, COLS),
        span: clamp(Number(it.span ?? 6), 1, COLS),
        row: Number(it.row ?? i + 1),
      });
    });
  }
  return { groups, cards };
}

function useMediaQuery(query: string) {
  const [m, setM] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const on = () => setM(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, [query]);
  return m;
}

export function FormCanvasTool() {
  const [groups, setGroups] = React.useState<Group[]>(SEED_GROUPS);
  const [cards, setCards] = React.useState<Card[]>(SEED_CARDS);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<"canvas" | "preview" | "json">("canvas");
  const [jsonError, setJsonError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [dropGroup, setDropGroup] = React.useState<string | null>(null);
  const bodyRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const drag = React.useRef<{ id: string; mode: "move" | "resize"; col: number; span: number } | null>(null);
  const isWidePreview = useMediaQuery("(min-width: 768px)");

  const selectedCard = cards.find((c) => c.id === selected) ?? null;

  const patch = (id: string, p: Partial<Card>) => setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));

  function updateCard(id: string, p: Partial<Card>) {
    setCards((cs) =>
      cs.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...p };
        next.span = clamp(next.span, 1, COLS);
        next.col = clamp(next.col, 1, COLS - next.span + 1);
        return next;
      }),
    );
  }

  function cellAt(clientX: number, clientY: number, fallbackGroup: string) {
    let groupId = fallbackGroup;
    let rect = bodyRefs.current[fallbackGroup]?.getBoundingClientRect() ?? null;
    for (const [gid, el] of Object.entries(bodyRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        groupId = gid;
        rect = r;
        break;
      }
    }
    if (!rect) return { groupId, col: 1, row: 1 };
    const colW = (rect.width + GAP) / COLS;
    return {
      groupId,
      col: clamp(Math.round((clientX - rect.left) / colW) + 1, 1, COLS),
      row: clamp(Math.round((clientY - rect.top) / (ROW_H + GAP)) + 1, 1, 99),
    };
  }

  function beginDrag(e: React.PointerEvent, card: Card, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    setSelected(card.id);
    drag.current = { id: card.id, mode, col: card.col, span: card.span };
    const onMove = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (d.mode === "move") {
        const { groupId, col, row } = cellAt(ev.clientX, ev.clientY, card.groupId);
        setDropGroup(groupId);
        patch(d.id, { groupId, col: clamp(col, 1, COLS - card.span + 1), row });
      } else {
        const body = bodyRefs.current[card.groupId];
        if (!body) return;
        const rect = body.getBoundingClientRect();
        const colW = (rect.width + GAP) / COLS;
        const rightCol = Math.round((ev.clientX - rect.left) / colW);
        patch(d.id, { span: clamp(rightCol - (d.col - 1), 1, COLS - d.col + 1) });
      }
    };
    const onUp = () => {
      drag.current = null;
      setDropGroup(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function addCard(kind: Kind) {
    const groupId = selectedCard?.groupId || groups[0]?.id;
    if (!groupId) return;
    const maxRow = cards.filter((c) => c.groupId === groupId).reduce((m, c) => Math.max(m, c.row), 0);
    seq += 1;
    const id = `c${seq}`;
    setCards((cs) => [
      ...cs,
      {
        id,
        groupId,
        kind,
        label: KIND_META[kind].label,
        ...(kind === "field" ? { key: `field_${seq}`, component: "Input" as Component } : {}),
        col: 1,
        span: kind === "field" ? 6 : 12,
        row: maxRow + 1,
      },
    ]);
    setSelected(id);
  }

  function applyJson(text: string) {
    try {
      const { groups: g, cards: c } = parse(JSON.parse(text));
      setGroups(g);
      setCards(c);
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "invalid JSON");
    }
  }

  async function copyJson() {
    try {
      await navigator.clipboard?.writeText(JSON.stringify(serialize(groups, cards), null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        setCards((cs) => cs.filter((c) => c.id !== selected));
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const PALETTE: Kind[] = ["field", "content", "divider", "spacer", "ai-note"];
  const TABS = [
    { id: "canvas", label: "Canvas" },
    { id: "preview", label: "Preview" },
    { id: "json", label: "JSON" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit gap-0.5 rounded-lg border border-input bg-muted/30 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-selected={tab === t.id}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "canvas" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {PALETTE.map((kind) => {
              const meta = KIND_META[kind];
              const Icon = meta.icon;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => addCard(kind)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card/40 px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  <Icon className="size-3.5" style={{ color: meta.color }} />
                  {meta.label}
                </button>
              );
            })}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGroups((gs) => [...gs, { id: `g${(gseq += 1)}`, title: `Section ${gs.length + 1}`, collapsed: false }])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card/40 px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <Plus className="size-3.5" />
                Group
              </button>
            </div>
          </div>

          {/* Canvas + inspector (RWD: stacks below lg) */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1" onPointerDown={() => setSelected(null)}>
              <div className="flex flex-col gap-4">
                {groups.map((group) => (
                  <GroupFrame
                    key={group.id}
                    group={group}
                    cards={cards.filter((c) => c.groupId === group.id)}
                    selected={selected}
                    dropOver={dropGroup === group.id}
                    bodyRef={(el) => {
                      bodyRefs.current[group.id] = el;
                    }}
                    onToggle={() =>
                      setGroups((gs) => gs.map((g) => (g.id === group.id ? { ...g, collapsed: !g.collapsed } : g)))
                    }
                    onMoveStart={beginDrag}
                    onResizeStart={beginDrag}
                  />
                ))}
              </div>
            </div>

            <aside className="shrink-0 lg:w-80">
              <Inspector
                card={selectedCard}
                groups={groups}
                onChange={(p) => selectedCard && updateCard(selectedCard.id, p)}
                onRemove={() => {
                  if (!selectedCard) return;
                  setCards((cs) => cs.filter((c) => c.id !== selectedCard.id));
                  setSelected(null);
                }}
              />
            </aside>
          </div>
        </>
      ) : tab === "preview" ? (
        <PreviewForm groups={groups} cards={cards} wide={isWidePreview} />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60">
              Config JSON — edits rebuild the canvas
            </span>
            <button
              type="button"
              onClick={copyJson}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card/40 px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              {copied ? <Check className="size-3.5" style={{ color: "#5b8cff" }} /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <textarea
            aria-label="config json"
            spellCheck={false}
            className="h-[28rem] w-full rounded-md border border-input bg-background p-4 font-mono text-[13px] leading-relaxed"
            defaultValue={JSON.stringify(serialize(groups, cards), null, 2)}
            onChange={(e) => applyJson(e.target.value)}
          />
          {jsonError ? <p className="text-xs text-destructive">Invalid config: {jsonError}</p> : null}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupFrame
// ---------------------------------------------------------------------------

function GroupFrame({
  group,
  cards,
  selected,
  dropOver,
  bodyRef,
  onToggle,
  onMoveStart,
  onResizeStart,
}: {
  group: Group;
  cards: Card[];
  selected: string | null;
  dropOver: boolean;
  bodyRef: (el: HTMLDivElement | null) => void;
  onToggle: () => void;
  onMoveStart: (e: React.PointerEvent, card: Card, mode: "move") => void;
  onResizeStart: (e: React.PointerEvent, card: Card, mode: "resize") => void;
}) {
  const maxRow = cards.reduce((m, c) => Math.max(m, c.row), 0);
  const rows = Math.max(maxRow + 1, 2);
  return (
    <section
      className={`overflow-hidden rounded-xl border bg-card/20 transition-colors ${
        dropOver ? "border-[#5b8cff]/70 ring-1 ring-[#5b8cff]/40" : "border-border"
      }`}
    >
      <header className="flex items-center gap-2.5 border-b border-border bg-muted/40 px-3 py-2.5">
        <button
          type="button"
          aria-label={group.collapsed ? "expand" : "collapse"}
          onClick={onToggle}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          <ChevronDown className={`size-4 transition-transform ${group.collapsed ? "-rotate-90" : ""}`} />
        </button>
        <span className="text-[15px] font-semibold">{group.title}</span>
        <span className="font-mono text-[11px] text-muted-foreground/50">{group.id}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/45">
          {cards.length} item{cards.length === 1 ? "" : "s"}
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wide text-muted-foreground/55">{COLS} cols</span>
      </header>

      {group.collapsed ? null : (
        <div
          ref={bodyRef}
          className="relative p-3"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
            gridAutoRows: `${ROW_H}px`,
            gap: GAP,
            minHeight: rows * (ROW_H + GAP),
            backgroundImage:
              "repeating-linear-gradient(to right, color-mix(in srgb, var(--muted-foreground) 8%, transparent) 0 1px, transparent 1px calc(100% / 12))",
            backgroundPosition: "12px 0",
            backgroundSize: "calc(100% - 24px) 100%",
            backgroundRepeat: "no-repeat",
          }}
        >
          {cards.length === 0 ? (
            <div className="pointer-events-none col-span-12 row-start-1 flex items-center justify-center text-xs text-muted-foreground/50">
              Drop fields here
            </div>
          ) : null}
          {cards.map((card) => (
            <CanvasCard
              key={card.id}
              card={card}
              selected={selected === card.id}
              onMoveStart={(e) => onMoveStart(e, card, "move")}
              onResizeStart={(e) => onResizeStart(e, card, "resize")}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// CanvasCard
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
  const sub = fieldSub(card);
  return (
    <div
      onPointerDown={onMoveStart}
      className={`group relative cursor-grab touch-none select-none rounded-lg border bg-card shadow-sm transition-shadow active:cursor-grabbing ${
        selected ? "border-transparent ring-2 ring-[#5b8cff]" : "border-border hover:shadow-md"
      }`}
      style={{ gridColumn: `${card.col} / span ${card.span}`, gridRow: card.row, boxShadow: `inset 3px 0 0 ${m.color}` }}
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
            {sub ? <span className="truncate font-mono text-[11px] text-muted-foreground/70">{sub}</span> : null}
            {card.required ? (
              <span
                className="ml-auto rounded px-1.5 py-px font-mono text-[10px] uppercase leading-none"
                style={{ color: "#e0635e", backgroundColor: "#e0635e22" }}
              >
                req
              </span>
            ) : null}
          </div>
          {m.field ? <div className="h-7 rounded-md border border-input bg-background/60" /> : null}
        </div>
      )}
      <div
        onPointerDown={onResizeStart}
        className="absolute right-0 top-0 flex h-full w-3 cursor-col-resize items-center justify-center"
      >
        <div className={`h-8 w-1 rounded-full transition-colors ${selected ? "bg-[#5b8cff]" : "bg-transparent group-hover:bg-border"}`} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspector — right-hand per-card config panel
// ---------------------------------------------------------------------------

function Inspector({
  card,
  groups,
  onChange,
  onRemove,
}: {
  card: Card | null;
  groups: Group[];
  onChange: (p: Partial<Card>) => void;
  onRemove: () => void;
}) {
  if (!card) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/20 p-6 text-center text-sm text-muted-foreground">
        Select a card to edit its config
      </div>
    );
  }
  const m = KIND_META[card.kind];
  const Icon = m.icon;
  const input = "h-8 w-full rounded-md border border-input bg-background px-2 text-sm";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/30 p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-[5px]" style={{ backgroundColor: `${m.color}1f`, color: m.color }}>
          <Icon className="size-3" />
        </span>
        <span className="text-sm font-semibold">{m.label}</span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground/50">{card.id}</span>
      </div>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Label
        <input className={input} value={card.label} onChange={(e) => onChange({ label: e.target.value })} />
      </label>

      {card.kind === "field" ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Key
            <input className={`${input} font-mono`} value={card.key ?? ""} onChange={(e) => onChange({ key: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Component
            <select className={input} value={card.component ?? "Input"} onChange={(e) => onChange({ component: e.target.value as Component })}>
              {COMPONENTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Placeholder
            <input
              className={input}
              value={card.placeholder ?? ""}
              placeholder="(shown in the preview control)"
              onChange={(e) => onChange({ placeholder: e.target.value })}
            />
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
          <select className={input} value={card.span} onChange={(e) => onChange({ span: Number(e.target.value) })}>
            {Array.from({ length: COLS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Group
          <select className={input} value={card.groupId} onChange={(e) => onChange({ groupId: e.target.value })}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
      </div>

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

// ---------------------------------------------------------------------------
// PreviewForm — renders the model as an actual form (RWD: 1-col on narrow)
// ---------------------------------------------------------------------------

function PreviewForm({ groups, cards, wide }: { groups: Group[]; cards: Card[]; wide: boolean }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 rounded-xl border border-border bg-card/30 p-6">
      {groups.map((group) => {
        const groupCards = cards
          .filter((c) => c.groupId === group.id && c.kind !== "ai-note")
          .sort((a, b) => a.row - b.row || a.col - b.col);
        return (
          <section key={group.id} className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: wide ? `repeat(${COLS}, minmax(0, 1fr))` : "1fr" }}
            >
              {groupCards.map((c) => (
                <div key={c.id} style={{ gridColumn: wide ? `span ${c.span}` : "1 / -1" }}>
                  <PreviewField card={c} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PreviewField({ card }: { card: Card }) {
  if (card.kind === "divider") return <hr className="border-border" />;
  if (card.kind === "spacer") return <div className="h-4" />;
  if (card.kind === "content") return <p className="text-sm text-muted-foreground">{card.label}</p>;

  const ctrl = "mt-1.5 w-full rounded-md border border-input bg-background px-3 text-sm";
  const label = (
    <label className="text-sm font-medium">
      {card.label}
      {card.required ? <span className="ml-1 text-destructive">*</span> : null}
    </label>
  );
  const ph = card.placeholder;
  switch (card.component) {
    case "Textarea":
      return (
        <div>
          {label}
          <textarea className={`${ctrl} h-20 py-2`} placeholder={ph} />
        </div>
      );
    case "Select":
      return (
        <div>
          {label}
          <select className={`${ctrl} h-9`} defaultValue="">
            <option value="" disabled>
              {ph || "—"}
            </option>
          </select>
        </div>
      );
    case "Switch":
      return (
        <div className="flex items-center justify-between">
          {label}
          <span className="h-5 w-9 rounded-full bg-input" />
        </div>
      );
    case "DatePicker":
      return (
        <div>
          {label}
          <button type="button" className={`${ctrl} h-9 text-left text-muted-foreground`}>
            {ph || "Pick a date"}
          </button>
        </div>
      );
    default:
      return (
        <div>
          {label}
          <input type={card.component === "Number" ? "number" : "text"} className={`${ctrl} h-9`} placeholder={ph} />
        </div>
      );
  }
}
