# Filter-tree group collapse — design

**Date:** 2026-06-25
**Component:** `@rfjs/filter-builder-ui` → `FilterTreeEditor`
**Consumers (all inherit the feature):** `apps/web` 5 builders (`data-filter-builder`, `jsonb-query-builder`, `sql-filter-builder`, `mongo-query-builder`, `pg-filter-builder`) + `apps/workbench` `dataset-explorer`.

## Goal

Let any group node in the filter-tree editor be **collapsed to a one-line summary** and re-expanded, so deep/wide trees stay manageable. Collapsing is a pure view affordance — it never changes the filter itself.

## Behavior

- **Every group is collapsible, including the root** (`depth 0`). A chevron sits at the front of each group's header row.
- **Expanded** (default): identical to today — logic Select(-badge) + `+ condition` / `+ group` buttons + remove (nested only), then the indented children rail.
- **Collapsed**: the children rail and the two add-buttons are hidden. The header becomes `▸ [logic-badge]  «summary»` (+ remove for nested groups). The logic Select stays rendered (still editable) — only the add-buttons swap out for the summary.
- **Chevron**: a `lucide-react` `ChevronDown` that rotates −90° when collapsed; `aria-expanded` reflects state; keyboard-focusable with a visible ring; rotation respects `prefers-reduced-motion`.
- **Summary text**: counts of the group's **direct** children, **non-zero parts only**, joined by ` · `:
  - `2 條件 · 1 群組` (has both), `3 條件` (conditions only), `1 群組` (groups only), `空群組` (empty).
- **Hover/focus detail**: the summary is wrapped in the shared `@rfjs/web-ui` `Tooltip` (Radix). On hover or keyboard-focus it shows an **indented preview of the collapsed subtree** — one line per condition (`field operator value`) and per nested group (raw logic op `AND`/`OR`/`NOR`/`NOT`, then its children indented). Because `Tooltip` renders through `TooltipPortal` to `document.body`, the preview is **not clipped** by the panel's `overflow-x-auto` (the field-path tooltip in `MetadataStrip` already relies on this).

## State model (the key constraint)

- Collapse is **view state, never data**. It must NOT be written into `BuilderGroup` — that tree is serialized to the engines and to the canonical-JSON editor; a `collapsed` field would leak into compiled output and round-trips. Compile / live-match read the tree and are therefore unaffected by collapsing.
- Each `FilterTreeEditor` instance holds its own `const [collapsed, setCollapsed] = useState(false)`. Because children are keyed by stable `id`, a group's instance stays mounted across edits → **collapse state persists while editing**. It resets only when the subtree remounts — i.e. when the canonical-JSON reverse-parse rebuilds the tree with fresh ids (a deliberate "reload"); this is acceptable.
- No host/controlled API for collapse, no global "collapse all" (YAGNI — see below). The component's existing controlled props are untouched.

## API change (`FilterTreeLabels`)

Add four **optional** label fields (optional + English fallback in the component, so existing callers never break; all six callers are then localized):

```ts
export interface FilterTreeLabels {
  // …existing…
  /** aria-label for the collapse/expand chevron. Fallback: "toggle group". */
  toggleGroup?: string;
  /** collapsed summary, conditions unit. "{count}" is replaced. Fallback: "{count} cond". */
  collapsedConditions?: string;
  /** collapsed summary, groups unit. "{count}" is replaced. Fallback: "{count} grp". */
  collapsedGroups?: string;
  /** collapsed summary when the group is empty. Fallback: "empty". */
  collapsedEmpty?: string;
}
```

The component builds the summary by filling `collapsedConditions` / `collapsedGroups` via `.replace("{count}", n)` (same pattern as `DataPanel.counts`), dropping zero parts, joining with ` · `, falling back to `collapsedEmpty`. The hover preview needs **no new labels** — it renders raw logic ops and `field op value` from the tree.

## Components / files touched

- **`packages/filter-builder-ui/src/filter-tree-editor.tsx`** (core): add `useState` for collapsed; render the chevron; conditionally render add-buttons vs summary; gate the children rail; build the summary; wrap it in `Tooltip` with the indented-preview content; a small pure `previewLines(group)` helper for the tooltip text. Extend `FilterTreeLabels`.
- **`packages/filter-builder-ui/src/filter-tree-editor.spec.tsx`**: new tests (below).
- **5 web tool `messages.ts`** (`dfb*`/`jqb*`/`sfb*`/`mqb*`/`pfb*`) — add the 4 strings (en + zh-TW) and pass them in each tool's `treeLabels`.
- **`apps/workbench`** `messages/en.json` + `messages/zh-TW.json` (+ wherever `dataset-explorer` builds `treeLabels`) — add the 4 strings and pass them.

`@rfjs/filter-builder-ui` is consumed via Next `transpilePackages` (src, not dist) → **no dist rebuild**; Tailwind already `@source`-scans the package, so new utility classes generate. No `@rfjs/filter-builder` change → no engine rebuild.

## Responsive (RWD)

Inherited, nothing new required: condition rows already reflow at `<640px` via `CROW_CSS` (grid-areas), and group headers are `flex-wrap`, so chevron + badge + summary wrap cleanly on narrow widths. The tooltip is `max-width: min(…, vw)`, clamps to the viewport, and flips above when near the bottom edge.

## Testing (TDD)

In `filter-tree-editor.spec.tsx`:
1. A group renders **expanded by default** — its children/condition rows are visible.
2. Clicking the chevron **hides the children** and shows the summary; `aria-expanded` flips to `false`.
3. Summary shows **non-zero counts only** (a group with 2 conditions + 0 subgroups reads "2 …", no "0 群組"/"0 grp").
4. The **root** group is collapsible (root chevron present and works).
5. **Collapsing does not call `onChange`** — collapse is view-only; the tree handed back is unchanged.
6. (If practical in jsdom) the tooltip content lists the inner conditions on focus.

## YAGNI — explicitly out of scope

- Global "collapse all / expand all" control (the user chose per-group only).
- Persisting collapse state into the tree / canonical JSON.
- Height/slide animation on the children rail (only the chevron rotates).
- Auto-collapsing deep groups by default (all groups start expanded).

## Risks / edge cases

- **Reverse-parse reset**: editing the canonical JSON rebuilds the tree (new ids) → all collapse state resets to expanded. Acceptable and predictable.
- **Empty group**: summary falls back to `collapsedEmpty`.
- **Touch devices**: Radix `Tooltip` handles focus/touch; the chevron is a real `<button>`.
