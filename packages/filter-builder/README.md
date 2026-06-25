# @rfjs/filter-builder

Framework-agnostic **canonical filter-tree** builder: an editable tree model with
stable node IDs, immutable tree-ops, schema inference, reverse-parse, live
in-memory matching, and a registry of **engines** that compile the same tree to
different execution targets (PostgreSQL, JSONB, MongoDB, in-memory).

This is the **orchestration layer** — it owns the shared tree shape and the
operator/arity contract, and it is the single place that knows about *every*
engine. It contains no UI.

---

## Where it sits

```
 execution engines  (each standalone, independently publishable)
 ┌───────────────┬──────────────┬─────────────┬──────────────┬─────────────┐
 │ @rfjs/        │ @rfjs/       │ @rfjs/      │ @rfjs/       │ @rfjs/      │
 │ data-filter   │ jsonb-query  │ sql-filter  │ mongo-query  │ pg-filter   │
 │ (in-memory)   │ (PG JSONB)   │ (columns)   │ (MongoDB)    │ (col+jsonb) │
 └───────┬───────┴──────┬───────┴──────┬──────┴──────┬───────┴──────┬──────┘
         └──────────────┴──────────────┼─────────────┴──────────────┘
                                       ▼
                          @rfjs/filter-builder          ← you are here
              canonical tree · tree-ops · schema infer · reverse
              · live match · engine registry (compile to any target)
                                       ▼
                         @rfjs/filter-builder-ui
                React editor (<FilterTreeEditor>) over this package
```

- **This package** = the brain: data model + logic + compile. Framework-agnostic
  (pure TS, no React). Consumed as built `dist/` (rebuild after `src` edits).
- **[@rfjs/filter-builder-ui](../filter-builder-ui)** = the face: a React
  `<FilterTreeEditor>` that edits the tree and delegates *all* logic back here.
- **Engines** = the standalone executors. `filter-builder` depends on **all** of
  them (see install note below).

---

## Install

**You only need a single engine's behaviour, no visual builder** — install just
that engine and call it directly; you do *not* need `filter-builder`:

```bash
npm i @rfjs/data-filter      # in-memory matching only
# or @rfjs/jsonb-query / @rfjs/sql-filter / @rfjs/mongo-query / @rfjs/pg-filter
```

**You want the canonical tree + compile-to-any-engine (headless)** — install this
package. It pulls in **all** engines as dependencies:

```bash
npm i @rfjs/filter-builder
```

**You want a ready-made React editor** — install the UI layer (it brings
`filter-builder` with it):

```bash
npm i @rfjs/filter-builder @rfjs/filter-builder-ui   # + peer: react, react-dom
```

> ⚠️ `@rfjs/filter-builder` hard-depends on every engine
> (`pg-filter`, `jsonb-query`, `sql-filter`, `mongo-query`, `data-filter`,
> `data-transform`). Using it — or the UI — pulls them all in, even if you only
> compile to one target. For a minimal footprint with a single engine and no
> visual builder, install that engine alone.

---

## Core concepts

### The canonical tree

A nestable group whose leaves are field conditions, with **stable IDs** for
editing:

```ts
type BuilderGroup = { kind: "group"; id: string; logic: "and"|"or"|"nor"|"not"; children: BuilderItem[] };
type BuilderCondition = { kind: "condition"; id: string; field: string; dataType: FieldType; elementType?: ElementType; operator: string; value?: unknown; filters?: BuilderGroup };
```

`treeToFilterGroup(tree)` strips the IDs to the shared `FilterGroupLike` shape
that engines consume.

### The arity model — a value's *shape* is decided by its operator

`arity.ts` is the single source of truth for how many values an operator takes:

| arity  | value shape   | operators |
|--------|---------------|-----------|
| `none` | *(no value)*  | `isnull` `isnotnull` `isempty` `isnotempty` `elemmatch` |
| `one`  | single value  | `eq` `neq` `gt` `gte` `lt` `lte` `contains` `startswith` `endswith` `ieq` `haskey` … |
| `two`  | `[min, max]`  | `range` |
| `list` | array         | `terms` `containsall` `nin` `hasanykey` `hasallkeys` |

`arityOf(op)` returns the arity (defaults to `"one"`). Build value editors and
validation off this — don't hard-code per-operator value handling.

> So `eq` is **single-value**; to match "any of several values" use `terms`
> (compiles to SQL `IN` / Mongo `$in`), not `eq` with an array.

---

## Usage

```ts
import {
  emptyGroup, addCondition, updateNode,
  treeToFilterGroup, getEngine,
  inferSchema, runLiveMatch,
} from "@rfjs/filter-builder";

const id = () => crypto.randomUUID();

// 1. build / edit the canonical tree (immutable ops return a new tree)
let tree = emptyGroup(id);
tree = addCondition(tree, tree.id, id);
const condId = tree.children[0]!.id;
tree = updateNode(tree, condId, { field: "age", dataType: "numeric", operator: "gt", value: 18 });

// 2a. compile to an engine
const out = getEngine("jsonb").compile(treeToFilterGroup(tree), {
  fields: [{ path: "age", kind: "jsonb", dataType: "numeric" }],
});
// → { ok: true, primary: '(("data" #>> $1)::numeric > $2)', secondary: '[["age"],18]' }

// 2b. …or evaluate it in memory
const { matched } = runLiveMatch([{ age: 36 }, { age: 12 }], tree); // → [{ age: 36 }]

// schema inference from sample rows
const schema = inferSchema([{ age: 36, name: "Ada" }]); // → FieldSchema[]
```

Engine ids for `getEngine(id)`: `"data-filter"`, `"jsonb"`, `"sql-filter"`,
`"mongo"`, `"pg-filter"`. Each returns an `Engine` with
`operators(dataType, elementType?, kind?)` and `compile(group, ctx)`.

---

## Operator matrix

Which operator each engine exposes, and the value shape (arity). For an
operator's exact **semantics and compiled output**, see that engine's own README
(linked below) — this table is the cross-engine map, not a re-statement of each
engine's behaviour.

| Operator | Arity | data-filter | jsonb-query | sql-filter¹ | mongo-query | Meaning |
|----------|-------|:-----------:|:-----------:|:-----------:|:-----------:|---------|
| `eq` | one | ✓ | ✓ | ✓ | ✓ | equals (mongo: `$eq`) |
| `neq` | one | ✓ | ✓ | ✓ | ✓ | not equals |
| `gt` `gte` `lt` `lte` | one | ✓ | ✓ | ✓ | ✓ | comparisons |
| `range` | two `[min,max]` | ✓ | ✓ | – | ✓ | inclusive between |
| `contains` | one² | ✓ | ✓ | ✓ | ✓ | substring (sql: `ILIKE`; mongo: `$regex`) |
| `startswith` | one | ✓ | ✓ | ✓ | ✓ | prefix |
| `endswith` | one | ✓ | ✓ | – | ✓ | suffix (sql column layer has no suffix op) |
| `icontains` `istartswith` `iendswith` `ieq` `ineq` | one | – | ✓ | – | – | case-insensitive variants |
| `terms` | list | ✓ | ✓ | – | ✓ | in a set (sql: —; mongo: `$in`) |
| `nin` | list | – | – | – | ✓ | not in a set (`$nin`) |
| `containsall` | list | ✓ | ✓ | – | – | array contains every value |
| `isnull` `isnotnull` | none | ✓ | ✓ | ✓ | ✓ | null checks (mongo: `$eq`/`$ne null`) |
| `isempty` `isnotempty` | none | – | ✓ | – | – | array empty / non-empty |
| `haskey` | one | – | ✓ | – | – | object has key |
| `hasanykey` `hasallkeys` | list | – | ✓ | – | – | object has any / all keys |
| `elemmatch` | none³ | ✓ | ✓ | – | – | match an element of an array-of-objects |

¹ **`sql-filter`** is the plain-column layer. `pg-filter` composes it with
`jsonb-query`: a leaf with `target: 'column'` uses the **sql-filter** column set
above; a leaf with `target: 'jsonb'` uses the **jsonb-query** set.

² `contains` is single-value in general, but **data-filter** exposes it as
`list` arity on `string` / string-array fields (contains-**any**).

³ `elemmatch` carries a nested `BuilderGroup` (in `condition.filters`) rather
than a scalar value.

Arity comes from the shared `arity.ts` (the single source of truth); the
per-engine ✓ marks are maintained against each engine's `operators()`. A
drift-guard test in `@rfjs/filter-builder-ui` (`operators.spec.ts`) asserts
every operator any engine returns is present in `OPERATOR_KEYS`, so a *new*
operator can't slip in unnoticed — but the ✓/– cells here are hand-checked, so
verify against the engine's own README if in doubt.

---

## Public API (by module)

- **`types`** — `BuilderGroup`, `BuilderCondition`, `FieldSchema`, `LogicOp`, `FieldType`, `ElementType`, `FieldKind`
- **`tree-ops`** — `emptyGroup`, `addCondition`, `addGroup`, `removeNode`, `updateNode`, `setLogic`
- **`schema-infer`** — `inferSchema`
- **`field-create`** / **`field-kind`** — `addInferredField`, `mapColumnType`, …
- **`reverse`** — `parseFilterGroup`, `filterGroupToTree`, `mergeFieldsFromTree`
- **`compile`** — `treeToFilterGroup`, `FilterGroupLike`
- **`pg-group`** — `treeToPgFilterGroup`
- **`live-match`** — `runLiveMatch`
- **`value-coerce`** — value coercion helpers
- **`engines`** — `getEngine`, `ENGINE_IDS`, `Engine`, `OperatorSpec`, `OperatorArity`, `CompileContext`

## Related packages

- **[@rfjs/filter-builder-ui](../filter-builder-ui)** — React `<FilterTreeEditor>` over this package.
- Engines (for per-operator semantics & compiled output):
  [@rfjs/data-filter](../data-filter) ·
  [@rfjs/jsonb-query](../jsonb-query) ·
  [@rfjs/sql-filter](../sql-filter) ·
  [@rfjs/mongo-query](../mongo-query) ·
  [@rfjs/pg-filter](../pg-filter)
