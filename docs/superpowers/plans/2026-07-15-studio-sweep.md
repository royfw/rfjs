# Studio Visual Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull the four remaining tools (table-builder, form-builder, flow-builder, bpmn-viewer) into the shared studio visual language so the whole apps/web suite matches the `metadata-builder` reference.

**Architecture:** Pure presentational restyle. Swap hand-rolled eyebrow/tab/card markup for the shared studio primitives (`ToolEyebrow`, `ToolTabs`, `SectionCard`, `FragmentBar`, `ToolIntro`); for the two canvas tools wrap the canvas in studio *chrome* without touching the React Flow / bpmn-js surface. No engine, logic, or public-API changes.

**Tech Stack:** Next.js 16, React, Tailwind (via `@rfjs/web-ui` tokens), next-intl, Vitest + Testing Library.

## Global Constraints

- Work ONLY in the worktree `/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-visual-unification`. Never touch the primary checkout. Every task first asserts `git branch --show-current` == `feat-visual-unification`.
- These are **restyle-with-regression-guard** tasks, NOT TDD: existing behaviour tests must stay green unchanged, except the one explicit selector edit in Task 1. Do not add new behaviour tests.
- Preserve every load-bearing test hook listed per task (roles, accessible names, `data-testid`s, `aria-*`). When in doubt, keep the attribute.
- Judgment A: user-named / content headers (form group names, submission "Metadata"/"Data") keep readable case — only *system* cards get the mono-UPPERCASE slab. Judgment B: canvases sit in a solid `SectionCard` body, never the dashed frame. Judgment C: flow + bpmn gain a `ToolIntro`.
- Replace hardcoded hex accents with theme tokens (`primary`/`ring`), never introduce new hex.
- Commit messages: English, conventional-commits, lowercase-lead subject, header ≤100 chars; trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Do NOT push. HOLD PR #255 until the user says "PR".

## Shared studio primitives (call reference — all under `apps/web/src/components/shared/`)

```tsx
import { ToolEyebrow } from "@/components/shared/tool-eyebrow";
// <ToolEyebrow>{t("xxEyebrow")}</ToolEyebrow>

import { ToolTabs } from "@/components/shared/tool-tabs";
import type { SectionTab } from "@/components/shared/section-card"; // { id: string; label: string }
// <ToolTabs tabs={TABS} active={tab} onChange={(id) => setTab(id as SomeTab)} />
// NB: onChange / onTabChange are typed (id: string) => void. State setters over a literal
// union (e.g. setTab: (t: "source"|…) => void) are NOT assignable directly — cast the id at
// the call site: onChange={(id) => setTab(id as EditorTab)}. Bare `onChange={setTab}` fails
// strict typecheck (TS2345). Mirror form-builder/ui.tsx:522.

import { SectionCard } from "@/components/shared/section-card";
// solo slab:      <SectionCard title={t("x")}>…</SectionCard>
// slab + action:  <SectionCard title={t("x")} action={<…/>} bodyClassName="p-0">…</SectionCard>
// collapsible:    <SectionCard title={t("x")} collapsible defaultOpen collapseLabel={t("x")}>…</SectionCard>
// tab-strip:      <SectionCard tabs={TABS} activeTab={view} onTabChange={setView} action={<…/>}>…</SectionCard>

import { FragmentBar } from "@/components/shared/fragment-bar";
// <FragmentBar>◆ {t("xStatus", { n })}</FragmentBar>

import { ToolIntro } from "@/components/shared/tool-intro";
// <ToolIntro storageKey="tool-intro:<slug>" question={t("introQuestion")}
//   tagline={t("xIntroTagline")}
//   concepts={[{term:t("xIntroC1t"),desc:t("xIntroC1d")}, …3]}
//   labels={{expand:t("introExpand"), collapse:t("introCollapse"), dismiss:t("introDismiss")}} />
```

`introQuestion`/`introExpand`/`introCollapse`/`introDismiss` are **central** `ToolUI` keys (already exist). Per-tool taglines/concepts are local.

Dev server for screenshot review runs at `http://localhost:3174/en/tools/<slug>` (orchestrator captures between tasks; see Task 5 for the playwright snippet). Test command per tool: `pnpm -F web vitest:run src/tools/<slug>` (or full `pnpm -F web vitest:run`).

---

### Task 1: table-builder → studio

**Files:**
- Modify: `apps/web/src/tools/table-builder/ui.tsx` (eyebrow `:288`, tab bar `:363`, preview card `:437`)
- Modify: `apps/web/src/tools/table-builder/resource-panel.tsx` (card `:137`)
- Modify: `apps/web/src/tools/table-builder/columns-panel.tsx` (card `:119`, title `:120`)
- Modify: `apps/web/src/tools/table-builder/pagination-panel.tsx` (card `:34`)
- Modify: `apps/web/src/tools/table-builder/metadata-panel.tsx` (card `:70`)
- Modify (TEST): `apps/web/src/tools/table-builder/ui.spec.tsx` (line 116 `{ selector: "p" }` → `"h2"`). **Not** `columns-panel.spec.tsx` — verified: that file never queries the panel title, so it needs no change; the only `selector: "p"` assertion is `ui.spec.tsx:116`.

**Interfaces:**
- Consumes: shared primitives above.
- Produces: nothing downstream (leaf tool).

- [ ] **Step 1: Baseline** — `git branch --show-current` == `feat-visual-unification`. Run `pnpm -F web vitest:run src/tools/table-builder` → expect all PASS. Note the count.

- [ ] **Step 2: Eyebrow + tabs in `ui.tsx`.** Replace the hand-rolled eyebrow `<p className="text-xs font-semibold tracking-widest text-muted-foreground">{t("tbEyebrow")}</p>` (`:288`) with `<ToolEyebrow>{t("tbEyebrow")}</ToolEyebrow>`. Replace the hand-rolled tab bar `<div className="inline-flex w-fit gap-0.5 …">…buttons…</div>` (`:363-386`) with `<ToolTabs tabs={TABS} active={tab} onChange={(id) => setTab(id as EditorTab)} />`. **The cast is required** — `setTab` is typed over `EditorTab = "source" | "columns" | "pagination" | "metadata"` (`ui.tsx:62`) but `ToolTabs.onChange` is `(id: string) => void`; bare `onChange={setTab}` fails strict typecheck. Build `TABS: SectionTab[]` mapping the existing tab **ids** to their labels: `[{id:"source",label:t("tbTabResource")},{id:"columns",label:t("tbTabColumns")},{id:"pagination",label:t("tbTabPagination")},{id:"metadata",label:t("tbTabMetadata")}]` — ids are `source/columns/…`, labels are Resource/Columns/… (keep exact label text so `getByRole("button",{name})` still matches). Add the two imports.

- [ ] **Step 3: Preview card → SectionCard.** Replace the preview wrapper `<div className="rounded-md border p-3"><p className="mb-2 text-sm font-semibold">{t("tbPreviewTitle")}</p>{…ConfigTable…}</div>` (`:437`) with `<SectionCard title={t("tbPreviewTitle")}>{…ConfigTable…}</SectionCard>`.

- [ ] **Step 4: Four panels → SectionCard slab.** In each panel file replace the `<div className="rounded-md border p-3">` + `<p className="mb-2 text-sm font-semibold">{title}</p>` recipe with `<SectionCard title={title}>…</SectionCard>`:
  - `resource-panel.tsx:137` (title = "Data resource" key).
  - `columns-panel.tsx:119` (title = "Columns" key). This turns the title from `<p>` into SectionCard's `<h2>`.
  - `pagination-panel.tsx:34`.
  - `metadata-panel.tsx:70`: use `<SectionCard title={labels.title} action={<the Copy/Download button row>} bodyClassName="p-0">` and keep `<pre data-testid="metadata-json">` in the body. **Title source (no new i18n key):** add an optional `title?: string` to `MetadataPanelLabels` (metadata-panel.tsx), and in `ui.tsx`'s `metadataPanelLabels` memo (`ui.tsx:~201-209`) set `title: t("tbTabMetadata")` (existing key = "Metadata", present in en + zh-TW).
  Keep every existing button, `data-testid`, `role="alert"`, `aria-pressed` chip untouched.

- [ ] **Step 5: FragmentBar for status (resource-panel).** Wrap the fields-summary line (`resource-panel.tsx:238-240`) in a FragmentBar — but **keep the summary text as its own leaf `<span>`** so the exact-text test survives:
```tsx
<FragmentBar><span aria-hidden="true">◆</span><span>{fieldsSummaryText}</span></FragmentBar>
```
  `resource-panel.spec.tsx` asserts `getByText("7 fields — edit display in the Columns tab")` (exact). Because the summary sits in its own leaf span (no child elements), Testing Library's `getNodeText` still matches it exactly and the FragmentBar's `◆` sibling doesn't merge into the matched text — so **no edit to `resource-panel.spec.tsx` is needed**. Do not concatenate `◆ ` into the same text node. Leave the "With a protocol…" hint line as plain text (it's guidance, not status).

- [ ] **Step 6: Fix the one test selector — in `ui.spec.tsx`, NOT `columns-panel.spec.tsx`.** The assertion is `apps/web/src/tools/table-builder/ui.spec.tsx:116`: `expect(screen.getByText("Columns", { selector: "p" })).toBeTruthy();`. It breaks once the ColumnsPanel title is a SectionCard `<h2>`. Change it to `{ selector: "h2" }` (or `screen.getByRole("heading", { name: "Columns" })`). Both are unambiguous — the "Columns" tab is a `<button>` (ToolTabs). Do not touch `columns-panel.spec.tsx` (it never queries the title). Do not change any other assertion (`getByText("Data resource")` at `:111/:115` uses no selector and still matches the new `<h2>`).

- [ ] **Step 7: Run tests.** `pnpm -F web vitest:run src/tools/table-builder` → expect same count PASS.

- [ ] **Step 8: Commit.**
```bash
git add apps/web/src/tools/table-builder
git commit -m "$(printf 'feat(web): studio language for table-builder\n\nSwap the hand-rolled eyebrow/tab-bar/panel cards for ToolEyebrow, ToolTabs\nand SectionCard; add a FragmentBar status strip. columns-panel title moves\nfrom <p> to SectionCard <h2> (spec selector updated).\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: form-builder internals → studio

**Files:**
- Modify: `apps/web/src/tools/form-builder/ui.tsx` (palette `:597`, GroupFrame header `:878`, CanvasCard `:967`, drop-line `:666,699`, JSON tab `:802`)
- Modify: `apps/web/src/tools/form-builder/inspector/settings-panel.tsx` (empty state `:39`, badge hex `:29,31`)
- Modify: `apps/web/src/tools/form-builder/submission-panel.tsx` (blocks `:55,140`)
- Modify: `apps/web/src/tools/form-builder/messages.ts` (add `fblPalette`, `fblJsonTitle` keys, en + zh-TW)

**Interfaces:**
- Consumes: shared primitives; `SectionCard` is already available via `inspector/section.tsx` but import it directly in `ui.tsx` for the new cards.
- Produces: nothing downstream.

- [ ] **Step 1: Baseline** — branch check. `pnpm -F web vitest:run src/tools/form-builder` → all PASS. Note count.

- [ ] **Step 2: Add i18n keys** to `messages.ts` (both `en` and `zh-TW`): `fblPalette` = "Palette" / "元件", `fblJsonTitle` = "Config JSON" / "設定 JSON".

- [ ] **Step 3: Palette → SectionCard.** Wrap the floating palette row `<div className="flex flex-wrap items-center gap-2">…kind/component buttons… <div className="ml-auto …">+ Group</div></div>` (`ui.tsx:597`) inside `<SectionCard title={t("fblPalette")}>…</SectionCard>`. Give the "+ Group" button the primary accent (add `border-primary text-primary` or use the `Button` default variant if that's the studio's gold). Keep all palette button labels/handlers.

- [ ] **Step 4: GroupFrame header (judgment A).** In `GroupFrame` (`ui.tsx:872,878`): change wrapper `rounded-xl` → `rounded-lg`, `bg-card/20` → `bg-card`; change header `bg-muted/40` → `bg-muted/30`; make the id/count spans mono uppercase (`font-mono text-xs uppercase tracking-wide text-muted-foreground`). **Keep the group name `<span className="text-[15px] font-semibold">` readable-case** (do NOT make it mono-uppercase). Keep the grip + collapse chevron buttons and `aria-label="reorder group"`.

- [ ] **Step 5: hex → tokens (ALL six non-semantic `#5b8cff` sites — the acceptance gate rejects any leftover).** Replace:
  - `ui.tsx:967` CanvasCard selected ring `ring-2 ring-[#5b8cff]` → `ring-2 ring-primary`.
  - `ui.tsx:666,699` group drop-line `bg-[#5b8cff]` → `bg-primary`.
  - `ui.tsx:813` `<Check className="size-3.5" style={{ color: "#5b8cff" }} />` → `<Check className="size-3.5 text-primary" />` (drop the inline style).
  - `ui.tsx:874` GroupFrame drop-over `"border-[#5b8cff]/70 ring-1 ring-[#5b8cff]/40"` → `"border-primary/70 ring-1 ring-primary/40"` (**keep the `ring-1` width**).
  - `ui.tsx:1020` CanvasCard grip bar `bg-[#5b8cff]` → `bg-primary`.
  - `settings-panel.tsx:29,31` inspector badge colors → primary token.
  Leave the `KIND_META` / `COMPONENT_PALETTE` per-element-type semantic colors (`ui.tsx:107,168-193`) alone. **Keep `cursor-grab` on CanvasCard.** After this task, `grep -rn '#5b8cff' apps/web/src/tools/form-builder` returns only the KIND_META/COMPONENT_PALETTE lines.

- [ ] **Step 6: JSON tab → SectionCard.** Replace the hand-rolled JSON tab (`ui.tsx:802-826`: header row + mono label + Copy button + bare textarea) with `<SectionCard title={t("fblJsonTitle")} action={<the Copy button>} bodyClassName="p-0"><textarea aria-label="config json" …/></SectionCard>`. **Keep `aria-label="config json"` on the textarea** and the copy handler.

- [ ] **Step 7: Inspector empty state + submission blocks.** `settings-panel.tsx:39` empty-state `rounded-xl border-border bg-card/20` → `rounded-lg border-dashed border-input`. `submission-panel.tsx:55,140` blocks `rounded-lg bg-card` → align to `rounded-lg border bg-card`; keep the `<h3>` "Metadata"/"Data" content headers (judgment A) and keep them inside the collapsible `Section` so `queryByText(/^metadata$/i)` is null while collapsed.

- [ ] **Step 8: Run tests.** `pnpm -F web vitest:run src/tools/form-builder` → same count PASS. If the `rp-frame` border test or the badge-sibling test fails, restore the exact hook (keep `border` on rp-frame; keep badge as `action` sibling of the toggle button; keep no `lg:flex-row` in the Preview-tab wrapper).

- [ ] **Step 9: Commit.**
```bash
git add apps/web/src/tools/form-builder
git commit -m "$(printf 'feat(web): studio language for form-builder internals\n\nWrap the floating palette in a SectionCard, align GroupFrame/submission\nheaders and inspector empty-state to studio tint, move the JSON tab into a\nslab SectionCard, and replace hardcoded #5b8cff accents with primary tokens.\nUser-named group/submission headers keep readable case.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: flow-builder → studio chrome (canvas)

**Files:**
- Modify: `apps/web/src/tools/flow-builder/ui.tsx` (eyebrow `:84`, toggle `:86`, node-add `:112`, canvas `:119`, JSON `:145`)
- Modify: `apps/web/src/tools/flow-builder/messages.ts` (add intro + slab-title keys, en + zh-TW)
- Modify (TEST): `apps/web/src/tools/flow-builder/ui.spec.tsx` (provider → `assembleMessages`)

**Interfaces:**
- Consumes: shared primitives; `assembleMessages` from `@/i18n/messages`.
- Produces: nothing downstream.

- [ ] **Step 1: Baseline** — branch check. `pnpm -F web vitest:run src/tools/flow-builder` → all PASS. Note count.

- [ ] **Step 2: i18n keys** in `messages.ts` (`en` / `zh-TW`):
  - `flowIntroTagline` = "Drag nodes to wire a flow → live flow JSON" / "拖節點串接流程 → 即時 flow JSON"
  - `flowIntroC1t` = "Nodes" / "節點"; `flowIntroC1d` = "Form, condition, action, start/end blocks on the canvas" / "畫布上的表單、條件、動作、開始/結束節點"
  - `flowIntroC2t` = "Edges" / "連線"; `flowIntroC2d` = "Directed links; conditions branch yes / no" / "有向連線；條件節點分岔 yes / no"
  - `flowIntroC3t` = "Flow JSON" / "流程 JSON"; `flowIntroC3d` = "The compiled flow document, updated as you edit" / "編輯時即時產生的 flow 文件"
  - `flowNodeCount` = "{n} nodes · {e} edges" / "{n} 個節點 · {e} 條連線" (for the FragmentBar).

- [ ] **Step 3: Fix the test provider FIRST** (so the ToolIntro you add next doesn't break the suite). In `ui.spec.tsx`: add `import { assembleMessages } from "@/i18n/messages";` and change the provider from `messages={messages.en as Record<string, unknown>}` to `messages={assembleMessages("en")}`. Remove the now-unused `import { messages } from "./messages";` only if nothing else uses it. Run the suite once — still green (no UI change yet).

- [ ] **Step 4: Eyebrow + ToolIntro.** Replace eyebrow `<p …>{t("flowEyebrow")}</p>` (`:84`) with `<ToolEyebrow>{t("flowEyebrow")}</ToolEyebrow>`. Immediately after, add the `ToolIntro` (storageKey `"tool-intro:flow-builder"`, question `t("introQuestion")`, tagline `t("flowIntroTagline")`, three concepts from the `flowIntroC*` keys, labels from the central `introExpand/Collapse/Dismiss`).

- [ ] **Step 5: Edit/BPMN toggle → SectionCard tab-strip wrapping the canvas.** Replace the bespoke toggle (`:86-108`) + conditional body (`:110-143`) with a single `<SectionCard>` whose tab-strip header carries the two views:
```tsx
<SectionCard
  tabs={[{ id: "edit", label: t("flowTabEdit") }, { id: "bpmn", label: t("flowTabBpmn") }]}
  activeTab={view}
  onTabChange={(v) => { setView(v as "edit" | "bpmn"); if (v === "bpmn") setSelectedId(null); }}
>
  {view === "edit" ? (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">{/* four + buttons */}</div>
      <div className="h-[560px] w-full rounded-md border">{/* ReactFlow */}</div>
    </>
  ) : (
    <BpmnViewPanel doc={doc} />
  )}
</SectionCard>
```
  **Two things the naive replacement gets wrong — both required:** (1) `onTabChange` is `(id: string) => void` but `setView` expects `"edit" | "bpmn"`, so the `as "edit" | "bpmn"` cast is mandatory (else strict typecheck fails). (2) The current toggle runs `if (v.id === "bpmn") setSelectedId(null)` (`ui.tsx:96-99`) to close the inspector when entering read-only BPMN; the `NodeSheet` at `ui.tsx:150-165` renders purely on `selectedId` with no `view` guard and is OUTSIDE this replaced block, so the handler **must** keep the `setSelectedId(null)` branch — otherwise `ui.spec.tsx:134-140` ("switching to bpmn clears the node selection") goes red. Keep the two tabs as accessible buttons named `Edit`/`BPMN`; keep the four node-add labels `+ Form/+ Condition/+ Action/+ End`.

- [ ] **Step 6: Flow JSON → SectionCard slab + FragmentBar.** Replace the JSON block (`:145-148`, bespoke `<p>` header + `<pre>`) with `<SectionCard title={t("flowJson")} collapsible defaultOpen bodyClassName="p-0"><div className="px-4 pt-3"><FragmentBar>◆ {t("flowNodeCount", { n: nodeCount, e: edgeCount })}</FragmentBar></div><pre className="max-h-56 overflow-auto p-4 text-[11px] leading-relaxed">{json}</pre></SectionCard>`. Derive `nodeCount`/`edgeCount` from the existing `doc`. **The JSON text must still appear in the DOM** (`"version": 1`, `"flow-builder"`, `"start"`).

- [ ] **Step 7: Run tests.** `pnpm -F web vitest:run src/tools/flow-builder` → same count PASS. (`NodeSheet` dialog, `BpmnViewPanel` switch/download untouched.)

- [ ] **Step 8: Commit.**
```bash
git add apps/web/src/tools/flow-builder
git commit -m "$(printf 'feat(web): studio chrome for flow-builder\n\nAdd ToolEyebrow + ToolIntro, fold the Edit/BPMN toggle into a SectionCard\ntab-strip wrapping the canvas, move node-add into the card body, and turn\nFlow JSON into a slab card with a FragmentBar node/edge count. Spec provider\nswitched to assembleMessages so the central introQuestion key resolves.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: bpmn-viewer → studio chrome (canvas)

**Files:**
- Modify: `apps/web/src/tools/bpmn-viewer/ui.tsx` (eyebrow `:81`, controls `:83`, canvas `:135`, XML panel `:142`)
- Modify: `apps/web/src/tools/bpmn-viewer/messages.ts` (add intro + slab-title keys, en + zh-TW)
- Modify (TEST): `apps/web/src/tools/bpmn-viewer/ui.spec.tsx` (provider → `assembleMessages`)

**Interfaces:**
- Consumes: shared primitives; `assembleMessages` from `@/i18n/messages`.
- Produces: nothing downstream.

- [ ] **Step 1: Baseline** — branch check. `pnpm -F web vitest:run src/tools/bpmn-viewer` → all PASS. Note count.

- [ ] **Step 2: i18n keys** in `messages.ts` (`en` / `zh-TW`):
  - `bpmnIntroTagline` = "Paste BPMN XML → interactive diagram" / "貼上 BPMN XML → 互動流程圖"
  - `bpmnIntroC1t` = "Diagram" / "圖"; `bpmnIntroC1d` = "bpmn-js renders the process; pan and zoom" / "bpmn-js 繪製流程圖；可平移縮放"
  - `bpmnIntroC2t` = "Samples" / "範例"; `bpmnIntroC2d` = "Built-in leave-request and order-approval flows" / "內建請假與訂單審核範例"
  - `bpmnIntroC3t` = "XML source" / "XML 來源"; `bpmnIntroC3d` = "Paste your own BPMN 2.0 XML to render" / "貼上你自己的 BPMN 2.0 XML 來檢視"
  - `bpmnDiagramTitle` = "Diagram" / "圖"; `bpmnSourceTitle` = "BPMN XML" / "BPMN XML"
  - `bpmnStatusSample` = "sample · {name}" / "範例 · {name}"; `bpmnStatusCustom` = "custom XML" / "自訂 XML" (for the FragmentBar; see Step 5).

- [ ] **Step 3: Fix the test provider FIRST.** In `ui.spec.tsx`: add `import { assembleMessages } from "@/i18n/messages";`, change provider `messages={messages.en …}` → `messages={assembleMessages("en")}`, drop the unused local `messages` import if now unused. Run suite → still green.

- [ ] **Step 4: Eyebrow + ToolIntro.** Replace eyebrow `<p …>{t("bpmnEyebrow")}</p>` (`:81`) with `<ToolEyebrow>`; add `ToolIntro` (storageKey `"tool-intro:bpmn-viewer"`, question `t("introQuestion")`, tagline `t("bpmnIntroTagline")`, three `bpmnIntroC*` concepts, central labels).

- [ ] **Step 5: Canvas → SectionCard.** First add a controlled sample-id state so the status is derivable: `const [sampleId, setSampleId] = React.useState<string | null>(DEFAULT_SAMPLE_ID);`. In `onSelectSample(id)` (`ui.tsx:41`) call `setSampleId(id)`; in the paste handler (`onApplyPaste`) and the upload handler set `setSampleId(null)` (the XML is now custom). Change the `<Select defaultValue={DEFAULT_SAMPLE_ID} …>` to `<Select value={sampleId ?? undefined} …>` if a controlled value is needed for display (otherwise leave `defaultValue`; the state is only for the FragmentBar).
  Wrap the canvas in `<SectionCard title={t("bpmnDiagramTitle")} action={<the controls>} bodyClassName="p-0">`. Move the controls row (sample `<Select>`, upload `<Button>` + hidden `<input data-testid="bpmn-file-input">`, zoom cluster) into the `action` slot (keep every `aria-label` and the hidden input). Body: `<div className="px-4 pt-3"><FragmentBar>◆ {sampleId ? t("bpmnStatusSample", { name: getSample(sampleId)?.label ?? sampleId }) : t("bpmnStatusCustom")}</FragmentBar></div>` — **no `elementCount`** (it is not exposed by `useBpmnViewer`/the viewer handle; do not invent it) and **no hardcoded English** (use the i18n keys from Step 2). If `getSample(id)` exposes a different display field than `.label`, read `samples.ts` and use whichever field the `<SelectItem>`s render. Then the existing `<BpmnViewer … className="bpmn-invert h-[600px] w-full …" />` — keep its className incl. the dark-invert classes and the `h-[600px]`; drop only the outer `rounded-md border` (SectionCard now frames it). Keep `data-testid="bpmn-viewer"` reaching the viewer and `role="alert"` on the error paragraph (leave the error `<p>` where it is, above or inside the card).

- [ ] **Step 6: XML panel → SectionCard slab.** Wrap the paste block (`:142-158`) in `<SectionCard title={t("bpmnSourceTitle")} action={<the Render Button>}>` with the `<label htmlFor="bpmn-paste">` + `<textarea id="bpmn-paste">` in the body. **Keep** the label/textarea association and a button whose accessible name is exactly "Render".

- [ ] **Step 7: Run tests.** `pnpm -F web vitest:run src/tools/bpmn-viewer` → same count PASS (`bpmn-viewer`/`bpmn-file-input` testids, "Render", `role="alert"` all intact).

- [ ] **Step 8: Commit.**
```bash
git add apps/web/src/tools/bpmn-viewer
git commit -m "$(printf 'feat(web): studio chrome for bpmn-viewer\n\nAdd ToolEyebrow + ToolIntro, wrap the bpmn-js canvas in a SectionCard with\nthe sample/upload/zoom controls in the header action and a FragmentBar\nstatus, and move the XML paste area into a slab card. Spec provider switched\nto assembleMessages so introQuestion resolves.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 5: changeset + full verification

**Files:**
- Create (if absent): `.changeset/studio-sweep-web.md`
- No source changes.

- [ ] **Step 1: Changeset.** Check `.changeset/` for an existing `"web": patch` entry on this branch. If none, create `.changeset/studio-sweep-web.md`:
```markdown
---
"web": patch
---

Studio visual sweep: table-builder, form-builder, flow-builder and bpmn-viewer
now use the shared studio language (ToolEyebrow / ToolTabs / SectionCard /
FragmentBar / ToolIntro), matching the metadata-builder reference. Canvas tools
gain studio chrome around the unchanged React Flow / bpmn-js surface.
```

- [ ] **Step 2: Full test + typecheck.** Run `pnpm -F web vitest:run` (whole app) → all PASS. Run `pnpm -F web check-types` (web's typecheck task is named `check-types`, not `typecheck`) → no errors. Also `grep -rn '#5b8cff' apps/web/src/tools/form-builder` → only `KIND_META`/`COMPONENT_PALETTE` lines remain.

- [ ] **Step 3: Commit.**
```bash
git add .changeset
git commit -m "$(printf 'chore: changeset for studio visual sweep (web)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

- [ ] **Step 4: Screenshot verification (orchestrator).** With the dev server on `:3174`, capture `/en/tools/{table-builder,form-builder,flow-builder,bpmn-viewer}` (dark + light) via the playwright-core snippet (bundled chromium at `/home/royfw/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`, `playwright-core` at `node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.js`). Compare side-by-side with `metadata-builder`: confirm slab headers, gold FragmentBar, tab-strip, intro callout, and no leftover `#5b8cff`.

---

## Self-Review

**Spec coverage:** table-builder (Task 1), form-builder internals incl. palette/GroupFrame/hex/JSON/empty-state/submission (Task 2), flow-builder chrome + intro (Task 3), bpmn-viewer chrome + intro (Task 4), i18n additions (Tasks 2–4), changeset + verify (Task 5), all three judgment calls (Global Constraints + per-task steps). The `columns-panel` selector edit (Task 1 Step 6) and the two spec-provider swaps (Task 3/4 Step 3) cover the mapped test traps. No spec section left unassigned.

**Placeholder scan:** i18n values are concrete strings; className transformations name exact source line and target class; the one uncertainty (bpmn element count) has an explicit fallback ("show just the sample id/label"). No TBD/TODO.

**Type consistency:** `SectionTab = {id,label}` used consistently for `ToolTabs.tabs` and `SectionCard.tabs`; `ToolTabs` uses `active`/`onChange`, `SectionCard` uses `activeTab`/`onTabChange` (verified against source — do not mix them up). `ToolIntro` prop shape matches the metadata-builder call site.

## Post-ultracode corrections (2026-07-15)

Adversarial verification (5 lenses, per-finding verify) confirmed 8 distinct defects, all fixed above:
1. **[critical]** The `{selector:"p"}` "Columns" assertion is in `table-builder/ui.spec.tsx:116`, not `columns-panel.spec.tsx` — retargeted (Task 1 Files + Step 6).
2. **[critical]** flow-builder tab handler must keep `setSelectedId(null)` on BPMN switch or `ui.spec.tsx:134-140` breaks — restored (Task 3 Step 5).
3. **[important]** `onChange`/`onTabChange` need an explicit cast to the state's literal union (strict typecheck) — added at both call sites + the primitives reference.
4. **[important]** table-builder FragmentBar must keep the asserted summary in its own leaf `<span>` (exact-text test) — structured markup (Task 1 Step 5); no `resource-panel.spec` edit.
5. **[important]** bpmn FragmentBar can't use a nonexistent `elementCount` or a hardcoded "elements" literal — replaced with a controlled `sampleId` + i18n status keys (Task 4 Steps 2, 5).
6. **[important]** form-builder `#5b8cff` cleanup missed `ui.tsx:813/:874/:1020` — all six sites now enumerated (Task 2 Step 5) + grep gate (Task 5 Step 2).
7. **[minor]** metadata-panel slab title source made concrete via `tbTabMetadata` + `MetadataPanelLabels.title` (Task 1 Step 4).
8. **[minor]** web's typecheck task is `check-types`, not `typecheck` (Task 5 Step 2).
