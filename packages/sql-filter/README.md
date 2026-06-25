# @rfjs/sql-filter

> 繁體中文 → [README.zh-TW.md](./README.zh-TW.md)

Generic boolean **filter-group → parameterized SQL** builder with **pluggable leaf
renderers**. It owns the tree/logic (`and`/`or`/`nor`/`not`, arbitrary nesting)
and delegates each leaf to a renderer you supply — so it knows *how to combine*
conditions, not *what a condition means*. Ships a built-in **column** renderer for
PostgreSQL `WHERE` / `ORDER BY` over a declared column allowlist. Zero runtime
dependencies.

This is the low-level core that [@rfjs/pg-filter](../pg-filter) builds on for the
column side of its unified trees.

---

## Install

```bash
npm i @rfjs/sql-filter
```

## Two layers

```
 FilterGroup<L>  ──buildFilterGroup(group, renderLeaf, params)──▶  "a=$1 and (b=$2 or c=$3)"
   (tree+logic)         every leaf L handed to YOUR renderLeaf
        │
        └─ built-in column layer: buildColumnQuery(config, group) ──▶ { where, values }
                 leaves are { column, operator, value }, rendered safely
                 against a column allowlist + type map
```

### 1. Generic core — bring your own leaf renderer

```ts
import { buildFilterGroup, ParamBuilder, type FilterGroup } from "@rfjs/sql-filter";

type Leaf = { col: string; val: unknown };
const group: FilterGroup<Leaf> = {
  logic: "and",
  filters: [{ col: "a", val: 1 }, { logic: "or", filters: [{ col: "b", val: 2 }, { col: "c", val: 3 }] }],
};

const params = new ParamBuilder();
const where = buildFilterGroup(group, (leaf, p) => `${leaf.col} = ${p.add(leaf.val)}`, params);
// where  → "a = $1 and (b = $2 or c = $3)"
// params.values → [1, 2, 3]
```

`ParamBuilder.add(value)` returns the next `$N` placeholder and accumulates the
value — so output is always parameterized (no value interpolation).

### 2. Built-in column layer

```ts
import { buildColumnQuery, type ColumnConfig } from "@rfjs/sql-filter";

const config: ColumnConfig = {
  name: { column: "name", type: "text" },
  createdAt: { column: "created_at", type: "timestamp" },
};

const { where, values } = buildColumnQuery(config, {
  logic: "and",
  filters: [
    { column: "name", operator: "contains", value: "sales" },
    { column: "createdAt", operator: "gte", value: "2026-01-01" },
  ],
});
// where  → "\"name\" ilike '%' || $1 || '%' and \"created_at\" >= $2"
// values → ["sales", "2026-01-01"]
```

`buildColumnOrderBy(config, sorts)` produces a parameterized `ORDER BY` the same way.

## Column operators & types

The column layer is intentionally a **scalar, single-value** surface (no `IN`,
no range — those live in the JSONB / Mongo engines). Operators are validated
against each column's declared `type`:

| `ColumnType` | allowed `ColumnOperator` |
|--------------|--------------------------|
| `text` | `eq` `neq` `isnull` `isnotnull` `contains` `startswith` `gt` `gte` `lt` `lte` |
| `numeric` / `timestamp` | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` |
| `boolean` / `uuid` | `eq` `neq` `isnull` `isnotnull` |

Values are single-value (`isnull`/`isnotnull` take none). An unknown column or a
type-disallowed operator throws `ColumnQueryError`
(`UNKNOWN_COLUMN` / `UNSUPPORTED_OPERATOR`).

> For the cross-engine operator picture (which engine has `terms`/`range`/etc.),
> see the matrix in [@rfjs/filter-builder](../filter-builder#operator-matrix).

## Public API

- **`engine`** — `buildFilterGroup(group, renderLeaf, params)`
- **`param-builder`** — `ParamBuilder` (`add(value) → "$N"`, `.values`)
- **`column`** — `buildColumnQuery`, `buildColumnOrderBy`, `ColumnConfig`, `ColumnCondition`, `ColumnOperator`, `ColumnType`, `ColumnSortSpec`
- **`types`** — `FilterGroup<L>`, `LogicalOperator`
- **`errors`** — `ColumnQueryError` (`code`: `UNKNOWN_COLUMN` | `UNSUPPORTED_OPERATOR` | `INVALID_PARAM_OFFSET`)

## Related

- **[@rfjs/pg-filter](../pg-filter)** — composes this (columns) with `jsonb-query` (JSONB) into one tree.
- **[@rfjs/filter-builder](../filter-builder)** — canonical tree + cross-engine operator matrix.

Design notes: `docs/superpowers/specs/2026-06-15-sql-filter-design.md`.
