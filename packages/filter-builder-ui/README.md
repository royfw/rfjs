# @rfjs/filter-builder-ui

> 繁體中文 → [README.zh-TW.md](./README.zh-TW.md)

Thin **React** layer over [@rfjs/filter-builder](../filter-builder): a
`<FilterTreeEditor>` component (plus a `useFilterTree()` hook and the value/field
editors it uses), styled with [@rfjs/web-ui](../web-ui). It **edits/holds the
tree only** — all logic (tree-ops, schema, compile, matching) lives in
`filter-builder`. One component edits **any** engine's tree via the `engineId`
prop.

> **Private / internal.** Not published to npm. Consumed inside the monorepo via
> Next.js `transpilePackages` (used from `src`, no build step). Peer deps:
> `react`, `react-dom`.

---

## Usage

```tsx
"use client";
import { FilterTreeEditor, useFilterTree } from "@rfjs/filter-builder-ui";
import { getEngine, treeToFilterGroup } from "@rfjs/filter-builder";

export function MyEditor() {
  const { tree, schema, setTree, setSchema, createField } = useFilterTree();

  // compile whenever you need the query (logic stays in filter-builder)
  const out = getEngine("jsonb").compile(
    treeToFilterGroup(tree),
    { fields: schema.map((f) => ({ path: f.path, kind: f.kind, dataType: f.dataType, elementType: f.elementType })) },
  );

  return (
    <FilterTreeEditor
      group={tree}
      engineId="jsonb"
      schema={schema}
      onChange={setTree}
      onCreateField={createField}
      labels={{
        logic: { and: "ALL", or: "ANY", nor: "NONE", not: "NOT" },
        addCondition: "+ condition", addGroup: "+ group",
        removeGroup: "remove group", removeCondition: "remove condition",
        elemMatch: "elemmatch",
      }}
    />
  );
}
```

## `<FilterTreeEditor>` props

| prop | type | purpose |
|------|------|---------|
| `group` | `BuilderGroup` | the tree to render / edit |
| `engineId` | `EngineId` | which engine's operators to offer (`"jsonb"` `"data-filter"` `"sql-filter"` `"mongo"` `"pg-filter"`) |
| `schema` | `FieldSchema[]` | known fields — drives the field combobox, operator availability, and (pg-filter) column/jsonb kind |
| `onChange` | `(next: BuilderGroup) => void` | called on every edit with the new tree |
| `onCreateField` | `(path: string) => void` | user typed a field path not in `schema` |
| `labels` | `FilterTreeLabels` | all UI strings (labels-as-props; see below) |
| `onRemove?` / `depth?` | — | internal (used by the recursion) |

The editor is fully controlled — it holds **no** tree state itself except a
per-group *collapsed* view flag (collapsing is view-only and never enters
`BuilderGroup`).

## `FilterTreeLabels`

```ts
interface FilterTreeLabels {
  logic: Record<"and"|"or"|"nor"|"not", string>;
  addCondition: string; addGroup: string;
  removeGroup: string; removeCondition: string;
  elemMatch: string;
  valueHint?: string;                       // placeholder for list/tag inputs
  // group collapse:
  toggleGroup?: string;                     // chevron aria-label
  collapsedConditions?: string;             // unit word, e.g. "cond" → "2 cond"
  collapsedGroups?: string;                 // unit word, e.g. "grp"  → "1 grp"
  collapsedEmpty?: string;                  // empty-group summary
  // operator i18n:
  operatorLabels?: Record<string, string>;  // op key → localized label (else raw op)
}
```

> `collapsed*` are **unit words**, not `{count}` templates — the component
> prepends the number. (next-intl interprets `{count}` as an ICU var and would
> throw if retrieved without it.)

## Other exports

- **`useFilterTree(init?)`** → `{ tree, schema, setTree, setSchema, createField }` — minimal state holder (wraps `filter-builder`'s `emptyGroup` / `addInferredField`).
- **`ValueEditor`** — type/arity-aware value input (single, range, and tag/list inputs).
- **`FieldCombobox`** — field picker with create-on-type.
- **`OPERATOR_KEYS`** — canonical operator key list; build an `operatorLabels` map from it (`Object.fromEntries(OPERATOR_KEYS.map(k => [k, t(k)]))`).
- **`colors`** — `logicBadge`, `dataTypeBadge`, `dataTypeShort`, `logicColor`, `dataTypeColor`.

## Related

- **[@rfjs/filter-builder](../filter-builder)** — the logic/data layer this renders (tree-ops, engines, compile, operator matrix).
- **[@rfjs/web-ui](../web-ui)** — design tokens & components used for styling.
