# Filter/query operator matrix (`@rfjs/*` filter stack)

Reference for the operator vocabulary across the filter/query package stack: which
identifier each engine uses for each concept, what each engine supports, and where
operator-name translation happens. See also the "Filter / Query-Builder Package Stack"
section of [`CLAUDE.md`](../CLAUDE.md).

> Snapshot: 2026-07-15 (`main` @ `ec0c8b2`). Regenerate if the engines' operator sets change.

## How operators are wired

The canonical tree (`@rfjs/filter-builder`) stores `operator` as a **free `string`**
(`filter-builder/src/types.ts`), *not* an enforced enum — validity is decided per engine
at runtime. `@rfjs/filter-builder-ui`'s `OPERATOR_KEYS` (`filter-builder-ui/src/operators.ts`)
is the de-facto canonical label list (used only to build localized labels, not for
validation); the actual per-field operator set the editor offers comes from each engine's
`operators(dataType, elementType, fieldKind)` adapter in `filter-builder/src/engines/*`.

Engines fall into **two coupling groups**:

### ① Same-name direct group (coupled by raw string identity — no translation layer)

`sql-filter` · `jsonb-query` · `data-filter` · `pg-filter` · the filter-builder canonical tree.

The builder passes **one operator string** for a given leaf straight to these engines with
a raw cast (`filter-builder/src/engines/{sql-filter,jsonb,data-filter,pg-filter}.ts`,
`pg-group.ts`) — no map in between. `jsonb-query`'s naming **is** the canonical spelling.
**Consequence:** renaming an operator in any one of these forces the same rename in all of
them (and in `OPERATOR_KEYS` + `arity.ts`).

### ② Adapter-translated group (own native vocabulary, bridged by an explicit map)

`es-query` · `mongo-query`.

These have their own native identifiers, translated in the filter-builder adapters:
`es-query` via `OP_MAP` (`filter-builder/src/engines/es-query.ts`), `mongo-query` via a
switch (`filter-builder/src/engines/mongo.ts`). A canonical rename touches only that one
map entry; the engine packages' own identifiers do not change.

## Operator matrix

`—` = not supported (dropped or throws `UNSUPPORTED_OPERATOR`). **Bold** = identifier differs
from the canonical spelling for the same concept.

| Concept | canonical | sql-filter (column) | jsonb-query | data-filter | mongo-query | es-query |
|---|---|---|---|---|---|---|
| equals | `eq` | `eq` | `eq` | `eq` | `eq` | `eq` |
| notEquals | `neq` | `neq` | `neq` | `neq` | `neq` | `neq` |
| in / anyOf | `terms` | — | `terms` | `terms` | `terms` (+`term`) | **`in`** |
| notIn | `nin` | — | — | — | `nin` | **`notIn`** |
| between | `range` | — | `range` | `range` | `range` | **`between`** |
| contains (substring) | `contains` | `contains` ⚠ | `contains` | `contains` | →`regex` | `contains` |
| startsWith | `startswith` | `startswith` ⚠ | `startswith` | `startswith` | →`regex` | **`startsWith`** |
| endsWith | `endswith` | — | `endswith` | `endswith` | →`regex` | **`endsWith`** |
| gt / gte / lt / lte | `gt`/`gte`/`lt`/`lte` | same | same | same | same | same |
| isNull | `isnull` | `isnull` | `isnull` | `isnull` | →`eq` null | **`isNull`** |
| isNotNull | `isnotnull` | `isnotnull` | `isnotnull` | `isnotnull` | →`neq` null | **`exists`** |
| ci equals | `ieq` | — | `ieq` | — | — | — |
| ci notEquals | `ineq` | — | `ineq` | — | — | — |
| ci contains | `icontains` | — | `icontains` | — | — | — |
| ci startsWith | `istartswith` | — | `istartswith` | — | — | — |
| ci endsWith | `iendswith` | — | `iendswith` | — | — | — |
| containsAll | `containsall` | — | `containsall` | `containsall` | — | — |
| isEmpty | `isempty` | — | `isempty` | — | — | — |
| isNotEmpty | `isnotempty` | — | `isnotempty` | — | — | — |
| hasKey | `haskey` | — | `haskey` | — | — | — |
| hasAnyKey | `hasanykey` | — | `hasanykey` | — | — | — |
| hasAllKeys | `hasallkeys` | — | `hasallkeys` | — | — | — |
| elemMatch | `elemmatch` | — | `elemmatch` (+ via pg-filter) | `elemmatch` | — | — |
| regex | *(none)* | — | — | — | `regex` | `regex` |
| logic | `and`/`or`/`nor`/`not` | (tree layer) | all | all | `and`/`or`/`nor` (no `not`) | all |

⚠ = the `sql-filter` column path has an ILIKE-wildcard issue on `contains`/`startswith`
(see below).

## Per-engine notes

- **`sql-filter`** — the tree layer (`FilterGroup<L>`) is operator-agnostic (only `and/or/nor/not`
  + a pluggable `renderLeaf`). The built-in **column** vocabulary (`sql-filter/src/column/operators.ts`)
  is just `eq, neq, isnull, isnotnull, contains, startswith, gt, gte, lt, lte` — no
  `terms`/`range`/`endswith`/`iX`/object/array ops (those throw `UNSUPPORTED_OPERATOR`).
- **`jsonb-query`** — the widest set and the canonical spelling: scalar + `terms`/`range`/`iX`
  family, object ops (`haskey`/…), array ops (`containsall`/`isempty`/`elemmatch`). Two
  dialects (`legacy` `#>>`+cast, `jsonpath` for PG12+).
- **`pg-filter`** — no own vocabulary; a single tree mixes `target:'column'` (→ sql-filter
  column renderer) and `target:'jsonb'` (→ jsonb-query) leaves.
- **`data-filter`** — in-memory; matches the canonical spelling (no `iX`, no `haskey`/`isempty`;
  `contains` is multi-value "contains-any").
- **`mongo-query`** — native `$`-ops; `contains/startswith/endswith → regex` (anchored),
  `isnull/isnotnull → eq/neq null`; no `$not`.
- **`es-query`** — deliberately divergent native vocab to match ES conventions (`in`, `notIn`,
  `between`, camelCase `startsWith/endsWith`, `isNull`/`exists`, plus `match`/`fuzzy`/… ES-only).

## Known issues

- **`sql-filter` column ILIKE wildcards** (`sql-filter/src/column/operators.ts`): `contains`/
  `startswith` concatenate literal `%` wildcards around the bound term but never escape `%`/`_`
  in the term and add no `ESCAPE` clause — so a term like `50%` or `a_b` over-matches. It also
  uses `ilike` (case-insensitive) unconditionally, diverging from jsonb-query's case-*sensitive*
  `contains`/`startswith` (jsonb reserves case-insensitivity to the `iX` family). `jsonb-query`
  and `data-filter` are not affected (they don't use LIKE).
- **`es-query` wildcards** (`es-query/src/toClause.ts`): `contains`/`endsWith` build `*term*`/
  `*term` patterns without escaping `*`/`?` in the term — an analogous (separate) concern.

## Where translation happens (rename blast radius)

- **Direct group** — a rename in `sql-filter`/`jsonb-query`/`data-filter`/`pg-filter` must be
  synced across all of them + the canonical `OPERATOR_KEYS` + `filter-builder/src/engines/arity.ts`,
  because they share one identity namespace with no adapter in between.
- **Adapter group** — a canonical rename ripples into the `OP_MAP` (es) / switch (mongo) entry
  only; `es-query`/`mongo-query`'s own identifiers are insulated.
