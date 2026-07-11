"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Type,
  AlignLeft,
  Minus,
  MoveVertical,
  Sparkles,
  ChevronDown,
  GripVertical,
  Plus,
  Copy,
  Check,
  CircleDot,
  CheckSquare,
  ListChecks,
  Tags,
  Calendar,
  Mail,
  Upload,
  PenLine,
  MousePointerClick,
  PanelBottom,
} from "lucide-react";

import { ConfigForm } from "@rfjs/form-builder-ui";
import type { ActionMeta, SubmissionMeta } from "@rfjs/form-builder-ui";
import type { Card, Group, Kind, Component } from "./model";
import { cardsToFormConfig, jsonToCards, cardLabel, componentDataType, formConfigToCards } from "./model";
import { SAMPLE_CONFIG, sampleUploader, sampleFetcher } from "./sample";
import { resolveCards, moveItem } from "./layout-grid";
import { SettingsPanel } from "./inspector/settings-panel";
import { Section } from "./inspector/section";
import { ResponsivePreview } from "./responsive-preview";
import { SubmissionPanel } from "./submission-panel";
import { useAiAssist } from "@/lib/ai/use-ai-assist";
import { AiPanel } from "@/components/shared/ai-panel";
import { buildNlFormPrompt, parseNlFormResponse } from "./ai-nl-form";
import { buildFormAskPrompt, buildFormExplainPrompt } from "./ai-explain-form";

// ---------------------------------------------------------------------------
// Direction C (hybrid) — "A structure + C drag freedom", now with a builder
// shell: Canvas | Preview | JSON tabs, a right-hand inspector for per-field
// config, and bidirectional JSON (edit JSON → rebuild the canvas). RWD-aware.
// Edits a real FormConfig (cards → groups → fields) and previews it via ConfigForm.
// ---------------------------------------------------------------------------

const COLS = 12;
const ROW_H = 84;
const GAP = 8;
const DRAG_THRESHOLD = 4; // px the pointer must travel before a press becomes a drag (a click just selects)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Demo rows for query-shaped api-action URLs (e.g. /api/actions/query) — lets the
// result mode:'table' snapshot/preview show a ConfigTable instead of a bare echo.
const SAMPLE_QUERY_ROWS = [
  { id: 1001, name: "Ada Lovelace", email: "ada@example.com", amount: 1240, status: "paid" },
  { id: 1002, name: "Alan Turing", email: "alan@example.com", amount: 980, status: "pending" },
  { id: 1003, name: "Grace Hopper", email: "grace@example.com", amount: 3010, status: "paid" },
];

// Merged preview fetcher: echoes api-action requests (body shaped { data, meta }),
// otherwise delegates to sampleFetcher for dataSource requests (e.g. /api/countries).
// Detects api-action by checking if req.body has both 'data' and 'meta' properties.
export async function createPreviewFetcher(req: { url: string; body?: unknown }) {
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
  // dataSource request: delegate to sampleFetcher
  return sampleFetcher(req);
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
  button: { color: "#10b981", icon: MousePointerClick, label: "Button" },
  result: { color: "#0ea5e9", icon: PanelBottom, label: "Result" },
};

const fieldSub = (c: Card) => (c.kind === "field" ? `${c.key ?? "field"} · ${c.component ?? "Input"}` : undefined);

// Seed the canvas from SAMPLE_CONFIG and lay it out in COLUMNS:
// short fields pack two-per-row; long/structural items
// (textarea, content, ai-note, divider, spacer) take the full row; buttons
// pack narrow (three comfortably fit a row) so a row of action buttons
// doesn't force one-per-row.
const SEED = formConfigToCards(SAMPLE_CONFIG);
const SEED_GROUPS: Group[] = SEED.groups;

const seedSpan = (c: Card): number => {
  if (c.kind === "button") return COLS / 4; // buttons → up to four per row
  if (c.kind !== "field") return COLS; // content / ai-note / divider / spacer → full row
  if (c.component === "Textarea") return COLS; // textareas read better full-width
  return COLS / 2; // ordinary fields → two per row (the column advantage)
};
// Flow-pack a group's cards into rows of up to COLS columns.
const packGroup = (cards: Card[]): Card[] => {
  let row = 1;
  let x = 0; // 0-based column offset filled so far in the current row
  return cards.map((c) => {
    const span = seedSpan(c);
    if (x + span > COLS) {
      row += 1;
      x = 0;
    }
    const placed: Card = { ...c, col: x + 1, span, row };
    x += span;
    if (x >= COLS) {
      row += 1;
      x = 0;
    }
    return placed;
  });
};
const SEED_CARDS: Card[] = SEED.groups.flatMap((g) => packGroup(SEED.cards.filter((c) => c.groupId === g.id)));

// Component-specific palette entries for field cards.
const COMPONENT_PALETTE: Array<{
  component: Component;
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}> = [
  { component: "Radio", label: "Radio", color: "#5b8cff", icon: CircleDot },
  { component: "Checkbox", label: "Checkbox", color: "#5b8cff", icon: CheckSquare },
  { component: "CheckboxGroup", label: "Checkbox Group", color: "#5b8cff", icon: ListChecks },
  { component: "TagList", label: "Tag List", color: "#5b8cff", icon: Tags },
  { component: "Date", label: "Date", color: "#5b8cff", icon: Calendar },
  { component: "Email", label: "Email", color: "#5b8cff", icon: Mail },
  { component: "FileUpload", label: "File Upload", color: "#5b8cff", icon: Upload },
  { component: "Signature", label: "Signature", color: "#5b8cff", icon: PenLine },
];

let seq = 100;
let gseq = 10;


export function FormBuilderTool() {
  const t = useTranslations("ToolUI");
  const locale = useLocale();
  const ai = useAiAssist();
  const [groups, setGroups] = React.useState<Group[]>(SEED_GROUPS);
  const [cards, setCards] = React.useState<Card[]>(SEED_CARDS);
  const [selected, setSelected] = React.useState<string | null>(null);
  // Mobile only: the config panel is a full-screen overlay. Selection (set on
  // pointer-down for drag/highlight) must NOT open it, or a press-to-drag would
  // immediately raise the overlay and block the canvas. It opens only on a
  // confirmed tap (pointer-up without crossing the drag threshold). Desktop is
  // unaffected — the panel is always inline there (lg: classes).
  const [mobileConfigOpen, setMobileConfigOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"canvas" | "preview" | "json">("canvas");
  const [jsonError, setJsonError] = React.useState<string | null>(null);
  const [payload, setPayload] = React.useState<{ data: Record<string, unknown>; meta: SubmissionMeta | ActionMeta } | null>(null);
  // Tracks whether a submit/custom/api action has fired at least once, so the
  // (collapsed-by-default) Preview tab "Submission" section auto-opens to reveal
  // the action payload instead of leaving the user to find the toggle themselves.
  const [actionSeen, setActionSeen] = React.useState(false);
  const [previewW, setPreviewW] = React.useState(1100);
  const [canvasW, setCanvasW] = React.useState(390);
  const [copied, setCopied] = React.useState(false);
  const [dropGroup, setDropGroup] = React.useState<string | null>(null);
  const bodyRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const drag = React.useRef<{ id: string; mode: "move" | "resize"; col: number; span: number } | null>(null);
  // Group reorder (drag a group header up/down): refs to each group <section>, and the
  // live drop indicator { dragged group id, insertion index among the current order }.
  const groupElRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const [groupDrag, setGroupDrag] = React.useState<{ id: string; overIndex: number } | null>(null);

  const selectedCard = cards.find((c) => c.id === selected) ?? null;
  const siblingFields = cards
    .filter((c) => c.kind === "field" && c.id !== selectedCard?.id && c.key)
    .map((c) => ({ key: c.key!, dataType: componentDataType(c.component) }));
  // Memoize to keep a stable reference: onPayloadChange fires on config changes,
  // so an unstable formConfig would create an infinite re-render loop.
  const formConfig = React.useMemo(() => cardsToFormConfig(groups, cards), [groups, cards]);

  // Memoized wrapper of createPreviewFetcher for stable reference across renders
  const previewFetcher = React.useCallback(createPreviewFetcher, []);
  // Shared onSubmit/onAction handler for both Preview ConfigForm instances: writes the
  // action's payload into the same `payload` state the SubmissionPanel(s) read (an action
  // firing overwrites the live onPayloadChange value), and reveals the Preview tab's
  // collapsed-by-default Submission section the first time an action fires.
  const handleSubmit = (p: { data: Record<string, unknown>; meta: ActionMeta }) => {
    setPayload(p);
    setActionSeen(true);
  };
  const handleAction = (_name: string, p: { data: Record<string, unknown>; meta: ActionMeta; response?: unknown }) => {
    setPayload({ data: p.data, meta: p.meta });
    setActionSeen(true);
  };

  // Apply a drag/resize patch to the dragged card, then resolve overlaps (push + compact up).
  const placeDragged = (id: string, p: Partial<Card>) =>
    setCards((cs) => {
      const patched = cs.map((c) => (c.id === id ? { ...c, ...p } : c));
      return resolveCards(patched, id, COLS) as Card[];
    });

  // Drag a group header up/down to reorder the group stack. Layout is unchanged
  // during the drag (rects stay stable); we only show an insertion indicator and
  // reorder once on drop. A bare click is ignored (DRAG_THRESHOLD), so the collapse
  // button still works.
  function beginGroupReorder(e: React.PointerEvent, groupId: string) {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    let active = false;
    // Insertion index (0..groups.length) for a given pointer Y, from the section rects.
    const insertionAt = (clientY: number) => {
      let ins = groups.length;
      for (let i = 0; i < groups.length; i++) {
        const el = groupElRefs.current[groups[i]!.id];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (clientY < r.top + r.height / 2) {
          ins = i;
          break;
        }
      }
      return ins;
    };
    const onMove = (ev: PointerEvent) => {
      if (!active && Math.abs(ev.clientY - startY) < DRAG_THRESHOLD) return;
      active = true;
      setGroupDrag({ id: groupId, overIndex: insertionAt(ev.clientY) });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (active) {
        const from = groups.findIndex((g) => g.id === groupId);
        const ins = insertionAt(ev.clientY);
        const to = ins > from ? ins - 1 : ins;
        if (from >= 0 && from !== to) setGroups((gs) => moveItem(gs, from, to));
      }
      setGroupDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

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
    const startX = e.clientX;
    const startY = e.clientY;
    // Grab offset (move): the cell under the pointer at grab time minus the card's
    // origin, so the card follows the cursor instead of snapping its origin to it.
    const grab = mode === "move" ? cellAt(startX, startY, card.groupId) : null;
    const offCol = grab ? grab.col - card.col : 0;
    const offRow = grab ? grab.row - card.row : 0;
    drag.current = { id: card.id, mode, col: card.col, span: card.span };
    // A bare click selects but must NOT move: only treat it as a drag once the
    // pointer travels past DRAG_THRESHOLD.
    let active = false;
    const onMove = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!active && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
      active = true;
      if (d.mode === "move") {
        const cell = cellAt(ev.clientX, ev.clientY, card.groupId);
        const col = clamp(cell.col - offCol, 1, COLS - card.span + 1);
        const row = clamp(cell.row - offRow, 1, 99);
        setDropGroup(cell.groupId);
        placeDragged(d.id, { groupId: cell.groupId, col, row });
      } else {
        const body = bodyRefs.current[card.groupId];
        if (!body) return;
        const rect = body.getBoundingClientRect();
        const colW = (rect.width + GAP) / COLS;
        const rightCol = Math.round((ev.clientX - rect.left) / colW);
        placeDragged(d.id, { span: clamp(rightCol - (d.col - 1), 1, COLS - d.col + 1) });
      }
    };
    const onUp = () => {
      // A confirmed tap (press that never became a drag) on a card opens the
      // mobile config overlay; a drag never does, so the canvas stays draggable.
      if (!active && mode === "move") setMobileConfigOpen(true);
      drag.current = null;
      setDropGroup(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function addCard(kind: Kind, component?: Component) {
    const groupId = selectedCard?.groupId || groups[0]?.id;
    if (!groupId) return;
    const maxRow = cards.filter((c) => c.groupId === groupId).reduce((m, c) => Math.max(m, c.row), 0);
    seq += 1;
    const id = `c${seq}`;
    const comp = kind === "field" ? (component ?? "Input") : undefined;
    setCards((cs) => [
      ...cs,
      {
        id,
        groupId,
        kind,
        label: component ?? KIND_META[kind].label,
        ...(kind === "field" ? { key: `field_${seq}`, component: comp as Component } : {}),
        col: 1,
        span: kind === "field" ? 6 : 12,
        row: maxRow + 1,
      },
    ]);
    setSelected(id);
  }

  function applyJson(text: string) {
    try {
      const { groups: g, cards: c } = jsonToCards(text);
      setGroups(g);
      setCards(c);
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "invalid config");
    }
  }

  async function copyJson() {
    try {
      await navigator.clipboard?.writeText(JSON.stringify(formConfig, null, 2));
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
        setCards((cs) => {
          const remaining = cs.filter((c) => c.id !== selected) as Card[];
          return resolveCards(remaining, "", COLS) as Card[]; // "" matches no id → every group compacts
        });
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const PALETTE: Kind[] = ["field", "content", "divider", "spacer", "ai-note", "button", "result"];
  const TABS = [
    { id: "canvas", label: "Canvas" },
    { id: "preview", label: "Preview" },
    { id: "json", label: "JSON" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit gap-0.5 rounded-lg border border-input bg-muted/30 p-1">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => setTab(tabItem.id)}
            aria-selected={tab === tabItem.id}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === tabItem.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      <AiPanel
        title={t("aiBlockTitle")}
        placeholder={t("fbAiPlaceholder")}
        logKey="rfjs.ai.log.form-builder"
        ai={ai}
        onReapply={(e) => applyJson(e.appliedJson ?? "")}
        appliedSummary={(e) => {
          let n = 0;
          try {
            const parsed = JSON.parse(e.appliedJson ?? "") as { fields?: unknown[] };
            n = Array.isArray(parsed.fields) ? parsed.fields.length : 0;
          } catch {
            n = 0;
          }
          return t("fbAiApplied", { count: n });
        }}
        actions={[
          {
            key: "generate",
            label: t("fbAiGenerate"),
            needsInput: true,
            primary: true,
            run: async (input) => {
              const out = await ai.run({ ...buildNlFormPrompt(input), json: true }, parseNlFormResponse);
              if (out === null) return null;
              const { groups: g, cards: c } = jsonToCards(out);
              setGroups(g);
              setCards(c);
              return { kind: "generate", prompt: input, appliedJson: out };
            },
          },
          {
            key: "ask",
            label: t("aiAsk"),
            needsInput: true,
            run: async (input) => {
              const out = await ai.runStream(
                buildFormAskPrompt({ configJson: JSON.stringify(formConfig, null, 2), locale }, input),
                (raw) => raw.trim(),
              );
              return out === null ? null : { kind: "ask", prompt: input, answer: out };
            },
          },
          {
            key: "explain",
            label: t("fbAiExplain"),
            run: async () => {
              const out = await ai.runStream(
                buildFormExplainPrompt({ configJson: JSON.stringify(formConfig, null, 2), locale }),
                (raw) => raw.trim(),
              );
              return out === null ? null : { kind: "explain", answer: out };
            },
          },
        ]}
      />

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
            {COMPONENT_PALETTE.map(({ component, label, color, icon: Icon }) => (
              <button
                key={component}
                type="button"
                onClick={() => addCard("field", component)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card/40 px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <Icon className="size-3.5" style={{ color }} />
                {label}
              </button>
            ))}
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

          {/* Section 1: Editor (default expanded) */}
          <Section title="Editor" defaultOpen={true}>
            {/* Canvas + inspector (RWD: stacks below lg) */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              <div
                className="min-w-0 flex-1"
                onPointerDown={() => {
                  setSelected(null);
                  setMobileConfigOpen(false);
                }}
              >
                <div className="flex flex-col gap-4">
                  {groups.map((group, index) => (
                    <React.Fragment key={group.id}>
                      {groupDrag && groupDrag.id !== group.id && groupDrag.overIndex === index ? (
                        <div data-testid="group-drop-line" className="-my-1.5 h-0.5 rounded-full bg-[#5b8cff]" />
                      ) : null}
                      <GroupFrame
                        group={group}
                        cards={cards.filter((c) => c.groupId === group.id)}
                        selected={selected}
                        dropOver={dropGroup === group.id}
                        dragging={groupDrag?.id === group.id}
                        sectionRef={(el) => {
                          groupElRefs.current[group.id] = el;
                        }}
                        bodyRef={(el) => {
                          bodyRefs.current[group.id] = el;
                        }}
                        onToggle={() =>
                          setGroups((gs) => gs.map((g) => (g.id === group.id ? { ...g, collapsed: !g.collapsed } : g)))
                        }
                        onReorderStart={beginGroupReorder}
                        onMoveStart={beginDrag}
                        onResizeStart={beginDrag}
                      />
                    </React.Fragment>
                  ))}
                  {groupDrag && groupDrag.overIndex === groups.length ? (
                    <div data-testid="group-drop-line" className="-my-1.5 h-0.5 rounded-full bg-[#5b8cff]" />
                  ) : null}
                </div>
              </div>

              <aside className="shrink-0 lg:w-[420px]">
                {/* Mobile: full-screen overlay only after a confirmed tap (mobileConfigOpen);
                    Desktop: always inline when a card is selected (lg: classes). */}
                <div
                  data-testid="card-inspector"
                  className={
                    selectedCard && mobileConfigOpen
                      ? "fixed inset-0 z-50 overflow-y-auto bg-background p-4 lg:static lg:z-auto lg:bg-transparent lg:p-0"
                      : "hidden lg:block"
                  }
                >
                  {selectedCard ? (
                    <button
                      type="button"
                      onClick={() => setMobileConfigOpen(false)}
                      className="mb-3 text-xs text-muted-foreground hover:text-foreground lg:hidden"
                    >
                      ← Back to canvas
                    </button>
                  ) : null}
                  <SettingsPanel
                    card={selectedCard}
                    groups={groups}
                    siblingFields={siblingFields}
                    apiButtons={cards.filter((c) => c.kind === "button" && c.action?.type === "api").map((c) => ({ id: c.id, label: cardLabel(c.label) }))}
                    onChange={(p) => selectedCard && updateCard(selectedCard.id, p)}
                    onRemove={() => {
                      if (!selectedCard) return;
                      setCards((cs) => resolveCards(cs.filter((c) => c.id !== selectedCard.id) as Card[], "", COLS) as Card[]);
                      setSelected(null);
                      setMobileConfigOpen(false);
                    }}
                  />
                </div>
              </aside>
            </div>
          </Section>

          {/* Section 2: Live Preview (default collapsed) */}
          <Section title="Live Preview" defaultOpen={false}>
            <div className="flex flex-col gap-4">
              <ResponsivePreview compact width={canvasW} onWidthChange={setCanvasW}>
                <ConfigForm
                  config={formConfig}
                  locale="en"
                  fetcher={previewFetcher}
                  uploadHandler={sampleUploader}
                  onPayloadChange={setPayload}
                  onSubmit={handleSubmit}
                  onAction={handleAction}
                />
              </ResponsivePreview>
              <SubmissionPanel compact payload={payload} />
            </div>
          </Section>
        </>
      ) : tab === "preview" ? (
        <div className="flex flex-col gap-4">
          <ResponsivePreview width={previewW} onWidthChange={setPreviewW}>
            <ConfigForm
              config={formConfig}
              locale="en"
              fetcher={previewFetcher}
              uploadHandler={sampleUploader}
              onPayloadChange={setPayload}
              onSubmit={handleSubmit}
              onAction={handleAction}
            />
          </ResponsivePreview>
          <Section key={actionSeen ? "submission-open" : "submission-closed"} title="Submission" defaultOpen={actionSeen}>
            <SubmissionPanel payload={payload} />
          </Section>
        </div>
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
            defaultValue={JSON.stringify(formConfig, null, 2)}
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
  dragging,
  sectionRef,
  bodyRef,
  onToggle,
  onReorderStart,
  onMoveStart,
  onResizeStart,
}: {
  group: Group;
  cards: Card[];
  selected: string | null;
  dropOver: boolean;
  dragging: boolean;
  sectionRef: (el: HTMLElement | null) => void;
  bodyRef: (el: HTMLDivElement | null) => void;
  onToggle: () => void;
  onReorderStart: (e: React.PointerEvent, groupId: string) => void;
  onMoveStart: (e: React.PointerEvent, card: Card, mode: "move") => void;
  onResizeStart: (e: React.PointerEvent, card: Card, mode: "resize") => void;
}) {
  const maxRow = cards.reduce((m, c) => Math.max(m, c.row), 0);
  const rows = Math.max(maxRow + 1, 2);
  return (
    <section
      ref={sectionRef}
      className={`overflow-hidden rounded-xl border bg-card/20 transition-[border,opacity] ${
        dropOver ? "border-[#5b8cff]/70 ring-1 ring-[#5b8cff]/40" : "border-border"
      } ${dragging ? "opacity-50" : ""}`}
    >
      <header className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
        <button
          type="button"
          aria-label="reorder group"
          onPointerDown={(e) => onReorderStart(e, group.id)}
          className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
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
            <span className="truncate text-sm font-medium">{cardLabel(card.label)}</span>
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



