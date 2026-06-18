# Data Filter Builder — Design Spec

**Date:** 2026-06-18
**Status:** Approved design (pilot)
**Pilot of:** "Per-engine Query Builder scenarios" initiative

## Context

`apps/web` currently has one `query-builder` tool with an **engine toggle**
(`jsonb` / `data-filter` / `pg-filter`) over a shared canonical filter tree,
plus separate pure generators (`jsonb-query-generator`, `mongo-query-generator`)
and `data-filter-tester`. The combined picture is muddled and the builder UI is
not well-designed.

The agreed direction is to **split the Query Builder into four per-engine
scenario tools**, each with a UI **tailored to its engine**:
`jsonb-query`, `data-filter`, `mongo-query`, `sql-filter`. These builders
**replace** the single toggle-based `query-builder`; the **pure generators stay**
as lightweight paste-in utilities.

Because that is a large, multi-part effort (four bespoke UIs + a visual redesign
+ backing `mongo`/`sql-filter`, which are not canonical-tree engines yet), it is
decomposed. **This spec covers only the first pilot — the `data-filter`
scenario** — which sets the design language the other three inherit.

## Goal

A dedicated **Data Filter Builder** tool: visually build an in-memory filter
over sample JSON and see matching rows live, with the *filter-matching logic*
(nested conditions, condition UI, field metadata) as the visual hero.

## Scope

**In scope (this spec):**
- New tool `data-filter-builder` (category `filter`).
- Registry entry in `@rfjs/web-core`.
- The redesigned, results-aware layout (approved direction below).
- Reuse of existing `@rfjs/filter-builder`, `@rfjs/filter-builder-ui`, and the
  `@rfjs/web-ui` primitives added in the consistency pass.

**Out of scope (future specs):**
- The other three scenarios (`jsonb-query`, `sql-filter`, `mongo-query`).
- Retiring `query-builder` (happens once all four scenarios ship; until then it
  stays as-is, even though its `data-filter` option now overlaps).
- New `mongo` / generic `sql-filter` canonical-tree engines.

## Information Architecture

- **Add** `data-filter-builder` to the `@rfjs/web-core` tool registry:
  - `category: 'filter'`, `surface: 'web'`, `status: 'preview'`
  - `relatedPackages: ['@rfjs/data-filter', '@rfjs/filter-builder']`
- **Keep** `data-filter-tester` (pure generator) unchanged.
- **Leave** `query-builder` unchanged this round (retired in a later spec).

## Layout (approved)

Direction **A (builder canvas) + an expandable data panel (C)** — the builder
is the hero; data is secondary and summonable.

```
┌───────────────────────────────────────────────┐
│ DATA FILTER BUILDER          [▸ 資料 原始20·命中12]│  app bar + collapsed data drawer
├───────────────────────────────────────────────┤
│ 欄位  [name str][age num][active bool][tags arr[]]  + 推斷 │  metadata strip (chips)
├───────────────────────────────────────────────┤
│            ┌───────────────────────────┐        │
│            │ ALL · 全部成立  [+條件][+群組] │        │  nested condition tree (HERO)
│            │  age   │num│ >        │ 18  │✕│        │  uniform aligned rows
│            │  tags  │arr│ contains │ ml  │✕│        │
│            │  ┌ ANY · 擇一成立 ──────────┐ │        │
│            │  │ active│bool│ =     │true│✕│ │        │
│            │  └─────────────────────────┘ │        │
│            └───────────────────────────┘        │
│   即時命中 12 / 20      { } canonical JSON        │
└───────────────────────────────────────────────┘
        (data drawer expands ↓ to a full-width bottom table)
```

- **App bar:** mono eyebrow title + a collapsed **data drawer** button showing
  `原始 N · 命中 M`.
- **Metadata strip:** field **chips**, each fixed-size (`118×26`), showing
  `name` + a type tag; an `+ 推斷欄位` action. Clicking a chip opens its type
  editor (a `Select` of `string/numeric/date/boolean/object/array`, plus element
  type for arrays, and an include toggle).
- **Hero — nested condition tree:** the existing `FilterTreeEditor`, centered
  with generous padding. Condition rows use a **uniform aligned grid**
  (field `172` · type `46` · operator `144` · value `flex` · remove `28`) so box
  sizes never change with text length; nested groups indent with a left guide
  line and a logic badge (`ALL`/`ANY`/`NONE`/`NOT`).
- **Data panel:** collapsed by default (peeking counts). Expands to a
  **full-width bottom table** with tabs `命中 (M)` / `原始 (N)` (rendered with the
  `@rfjs/web-ui` `Table`, `table-layout: fixed`) and a `{ }` tab for the
  canonical `FilterMatchQuery` JSON (editable → reverse-parses into the tree).
- **Responsive:** on narrow viewports the metadata strip wraps and the data
  panel stacks below the builder.

The pixel-level polish (spacing, node styling, badge colors, drawer transition)
is done during implementation with the `frontend-design` skill; the reference is
`/.superpowers/brainstorm/.../layout-v2.html` option A.

## Components & Files

```
apps/web/src/tools/data-filter-builder/
  index.ts            # ToolModule descriptor (id: 'data-filter-builder')
  messages.ts         # i18n strings (en + zh-TW)
  ui.tsx              # "use client" — top-level QueryBuilder-for-data-filter
  ui/metadata-strip.tsx  # field chips + per-field type editor (Select + include)
  ui/data-panel.tsx      # collapsible drawer → tabs (matched / raw / JSON)
  *.spec.ts(x)        # co-located tests
```

- **Reuse from `@rfjs/filter-builder`:** `inferSchema`, `emptyGroup`,
  `addInferredField`, `mergeFieldsFromTree`, `treeToFilterGroup`,
  `parseFilterGroup`, `filterGroupToTree`, `runLiveMatch`.
- **Reuse from `@rfjs/filter-builder-ui`:** `FilterTreeEditor` (+ labels).
- **Reuse from `@rfjs/web-ui`:** `Panel`, `Table*`, `Button`, `Select*`,
  `Input`, `Textarea`.
- **Register** in `apps/web/src/tools/index.ts` and
  `@rfjs/web-core` `toolRegistry`.

## Data Flow

```
sample JSON ──inferSchema──▶ fields (metadata strip; editable type/include)
                                   │
tree (FilterTreeEditor) ───────────┤
   │                               ▼
   ├─ runLiveMatch(rows, tree) ─▶ matched rows  (data panel · 命中 tab)
   └─ treeToFilterGroup(tree) ──▶ canonical JSON (data panel · { } tab)

paste JSON ─parseFilterGroup─▶ filterGroupToTree ─▶ tree
                            └─ mergeFieldsFromTree ─▶ fields
```

## Customizations for data-filter (vs the future SQL/mongo scenarios)

- `engineId` is fixed to `"data-filter"` — **no engine toggle**.
- Metadata exposes `dataType` + `elementType` + `include` only — **no
  jsonb/column `kind`** (that is an SQL-engine concern).
- Output is **live matched data rows** + canonical `FilterMatchQuery` JSON —
  **no SQL string, dialect, sort, or pagination** controls.

## Error Handling

- Invalid sample JSON → inline error message; keep the last good schema/rows.
- Invalid pasted canonical JSON → inline error on the JSON editor; tree
  unchanged.
- Empty tree → matches everything; the count (`M / N`) makes this explicit.

## Testing

- Filter semantics are already covered by `@rfjs/filter-builder` /
  `@rfjs/data-filter` unit tests — not re-tested here.
- **Registry test:** `apps/web/src/tools/index.spec.ts` asserts registered tools
  match the `@rfjs/web-core` catalog — update it to include
  `data-filter-builder`.
- **Component tests:** light render tests for `metadata-strip` (renders a chip
  per field; type change calls back) and `data-panel` (toggles open; switches
  tabs).

## Future (tracked, not in this spec)

- Inherit this design language for `jsonb-query`, `sql-filter`, `mongo-query`
  scenarios (one spec each).
- Retire `query-builder` once the four scenarios exist.
- Add `mongo` / generic `sql-filter` canonical-tree engines to
  `@rfjs/filter-builder`.
