# Filter/query operator matrix (`@rfjs/*` filter stack)

Reference for the operator vocabulary across the filter/query package stack: which
identifier each engine uses for each concept, what each engine supports, and where
operator-name translation happens. See also the "Filter / Query-Builder Package Stack"
section of [`CLAUDE.md`](../CLAUDE.md).

> Snapshot: 2026-07-29 (`main` @ `a16fef1`). Regenerate if the engines' operator sets change.

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
| in / anyOf | `terms` | `terms` | `terms` | `terms` | `terms` (+`term`) | **`in`** |
| notIn | `nin` | — | — | — | `nin` | **`notIn`** |
| between | `range` | `range` | `range` | `range` | `range` | **`between`** |
| contains (substring) | `contains` | `contains` | `contains` | `contains` | →`regex` | `contains` |
| startsWith | `startswith` | `startswith` | `startswith` | `startswith` | →`regex` | **`startsWith`** |
| endsWith | `endswith` | `endswith` | `endswith` | `endswith` | →`regex` | **`endsWith`** |
| gt / gte / lt / lte | `gt`/`gte`/`lt`/`lte` | same | same | same | same | same |
| isNull | `isnull` | `isnull` | `isnull` | `isnull` | →`eq` null | **`isNull`** |
| isNotNull | `isnotnull` | `isnotnull` | `isnotnull` | `isnotnull` | →`neq` null | **`exists`** |
| ci equals | `ieq` | `ieq` | `ieq` | — | — | — |
| ci notEquals | `ineq` | `ineq` | `ineq` | — | — | — |
| ci contains | `icontains` | `icontains` | `icontains` | — | — | — |
| ci startsWith | `istartswith` | `istartswith` | `istartswith` | — | — | — |
| ci endsWith | `iendswith` | `iendswith` | `iendswith` | — | — | — |
| containsAll | `containsall` | — | `containsall` | `containsall` | — | — |
| isEmpty | `isempty` | — | `isempty` | — | — | — |
| isNotEmpty | `isnotempty` | — | `isnotempty` | — | — | — |
| hasKey | `haskey` | — | `haskey` | — | — | — |
| hasAnyKey | `hasanykey` | — | `hasanykey` | — | — | — |
| hasAllKeys | `hasallkeys` | — | `hasallkeys` | — | — | — |
| elemMatch | `elemmatch` | — | `elemmatch` (+ via pg-filter) | `elemmatch` | — | — |
| regex | *(none)* | — | — | — | `regex` | `regex` |
| logic | `and`/`or`/`nor`/`not` | (tree layer) | all | all | `and`/`or`/`nor` (no `not`) | all |

## Per-engine notes

- **`sql-filter`** — the tree layer (`FilterGroup<L>`) is operator-agnostic (only `and/or/nor/not`
  + a pluggable `renderLeaf`). The built-in **column** vocabulary (`sql-filter/src/column/operators.ts`)
  covers scalar comparisons (`eq, neq, gt, gte, lt, lte`), null checks (`isnull, isnotnull`), the
  LIKE text ops (`contains, startswith, endswith`), the case-insensitive `iX` family
  (`ieq, ineq, icontains, istartswith, iendswith`), and `terms`/`range` — all **type-scoped** via
  `ALLOWED` (e.g. LIKE + `iX` are text-only, `range` is numeric/timestamp, `boolean` allows only
  `eq/neq/isnull/isnotnull`). Object/array ops (`haskey`/`containsall`/`isempty`/`elemmatch`) are
  not supported and throw `UNSUPPORTED_OPERATOR`.
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

## Wildcard / LIKE escaping

- **`sql-filter` column** (`sql-filter/src/column/operators.ts`): the LIKE-based text ops
  (`contains`/`startswith`/`endswith`) escape `%`/`_`/`\` in the bound term and emit an
  `ESCAPE '\'` clause, so a term like `50%` or `a_b` matches verbatim. These three are
  case-**sensitive** (`like`), matching jsonb-query's `contains`/`startswith`/`endswith`;
  case-insensitivity lives in the separate `iX` family (`icontains`/`istartswith`/`iendswith`
  → `ilike`, `ieq`/`ineq` → `lower(col) …`).
- **`es-query`** (`es-query/src/toClause.ts`): `contains`/`endsWith` escape the ES wildcard
  metachars (`*`/`?`/`\`) in the term before building the `*term*`/`*term` pattern (`startsWith`
  uses a prefix query, so no wildcard escaping is needed).
- `jsonb-query` and `data-filter` don't use SQL `LIKE` or ES wildcards, so neither concern applies.

## Where translation happens (rename blast radius)

- **Direct group** — a rename in `sql-filter`/`jsonb-query`/`data-filter`/`pg-filter` must be
  synced across all of them + the canonical `OPERATOR_KEYS` + `filter-builder/src/engines/arity.ts`,
  because they share one identity namespace with no adapter in between.
- **Adapter group** — a canonical rename ripples into the `OP_MAP` (es) / switch (mongo) entry
  only; `es-query`/`mongo-query`'s own identifiers are insulated.
