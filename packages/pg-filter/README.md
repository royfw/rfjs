# @rfjs/pg-filter

> 繁體中文 → [README.zh-TW.md](./README.zh-TW.md)

Unified PostgreSQL filter builder: **one filter tree that mixes plain SQL columns
and JSONB paths**, compiled to a single parameterized `WHERE` / `ORDER BY` (plus
`LIMIT` / `OFFSET`). It composes [@rfjs/sql-filter](../sql-filter) (the column
side) and [@rfjs/jsonb-query](../jsonb-query) (the JSONB side) — each leaf
declares its `target`, and `buildPgFilter` renders the whole tree together.

---

## Install

```bash
npm i @rfjs/pg-filter
```

## How it works

```
 one PgFilterGroup (and/or/nor/not, nested)
 ├─ { target: 'column', column, operator, value }   ──▶ @rfjs/sql-filter  →  "name" LIKE …
 └─ { target: 'jsonb',  field,  operator, value }    ──▶ @rfjs/jsonb-query →  ("data" #>> …)::numeric > …
                         │
                         ▼
        buildPgFilter(config, input)  ──▶  { where, orderBy, limit, offset, values, countValues }
```

Column leaves resolve against a **column allowlist + type map**; JSONB leaves
resolve against a single JSONB **column** with a chosen dialect. The two streams
of `$N` parameters are merged into one ordered `values` array.

## Usage

```ts
import { buildPgFilter, type PgFilterConfig } from "@rfjs/pg-filter";

const config: PgFilterConfig = {
  columns: { name: { column: "name", type: "text" } },
  jsonb: { column: "data", dialect: "legacy" }, // or 'jsonpath' (PG12+)
};

const { where, orderBy, limit, offset, values, countValues } = buildPgFilter(config, {
  filter: {
    logic: "and",
    filters: [
      { target: "column", column: "name", operator: "contains", value: "cust" },
      { target: "jsonb", field: "score", dataType: "numeric", operator: "gt", value: 80 },
    ],
  },
  sort: [{ target: "jsonb", field: "score", dataType: "numeric", direction: "desc" }],
  page: 1,
  pageSize: 20,
});

// run it
const rows = await client.query(
  `SELECT * FROM datasets WHERE ${where} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
  values,
);
const total = await client.query(`SELECT count(*) FROM datasets WHERE ${where}`, countValues);
```

- `where` is never empty (`'true'` when there's no filter); `orderBy` is `''` when there's no sort.
- `values` = WHERE params **++** ORDER BY params (for the main query). `countValues` = WHERE params only (a prefix of `values`) — use it for the `COUNT(*)` query.

### Composing an app-owned fragment (`paramOffset`)

Pass `paramOffset: k` to start every `$N` placeholder at `$(k + 1)` instead of `$1`,
so you can AND an app-owned SQL fragment (RLS, multi-tenancy, visibility pushdown)
that already consumed `$1..$k` **before** the generated `where` / `orderBy`. It only
shifts the numbering — `values` / `countValues` are unchanged, and `limit` / `offset`
are interpolated as SQL literals (they never enter the parameter array).

```ts
const scope = [tenantId]; // your fragment owns $1
const { where, orderBy, values, countValues } = buildPgFilter(config, {
  filter,
  sort,
  paramOffset: scope.length, // generated placeholders now start at $2
});

const rows = await client.query(
  `SELECT * FROM datasets WHERE tenant_id = $1 AND (${where})${orderBy ? ` ORDER BY ${orderBy}` : ""}`,
  [...scope, ...values],
);
const total = await client.query(
  `SELECT count(*) FROM datasets WHERE tenant_id = $1 AND (${where})`,
  [...scope, ...countValues],
);
```

## Leaf & sort shapes

```ts
type PgColumnLeaf = { target: "column"; column: string; operator: ColumnOperator; value?: unknown };
type PgJsonbLeaf  = { target: "jsonb"; field: string; dataType: JsonbDataType; operator: string;
                      value?: unknown; elementType?: JsonbScalarType | "object"; filters?: JsonbFilterGroup };
type PgSort = { target: "column"; column: string; direction?: "asc"|"desc"; nulls?: "first"|"last" }
            | { target: "jsonb"; field: string; dataType: JsonbScalarType; direction?: "asc"|"desc"; nulls?: "first"|"last" };
```

## Operators

`pg-filter` does **not** define its own operators — each leaf uses its target engine's set:

- `target: 'column'` → the **scalar column** operators of [@rfjs/sql-filter](../sql-filter#column-operators--types) (`eq`/`neq`/`contains`/`startswith`/`endswith`/the case-insensitive `iX` family/`gt`/`gte`/`lt`/`lte`/`isnull`/`isnotnull`, plus `terms` (`= ANY`) and `range` (`BETWEEN`) on the types that support them — see sql-filter's per-type table).
- `target: 'jsonb'` → the full [@rfjs/jsonb-query](../jsonb-query) set (`terms`, `range`, `containsall`, case-insensitive variants, `haskey…`, `elemmatch`, …).

See the cross-engine matrix in [@rfjs/filter-builder](../filter-builder#operator-matrix).

Validation follows the same split: a `column` leaf is validated by sql-filter's column
layer, so a single-value operator given an array/object throws `ColumnQueryError`
(`NON_SCALAR_VALUE`) at build time rather than emitting a `String()`-coerced term.

## Public API

- **`build`** — `buildPgFilter(config, input) → PgFilterResult`
- **`types`** — `PgFilterConfig`, `PgFilterInput`, `PgFilterResult`, `PgFilterGroup`, `PgLeaf` (`PgColumnLeaf` | `PgJsonbLeaf`), `PgSort`
- **`filter`** / **`order-by`** / **`pagination`** — the building blocks `build` composes
- **`errors`** — pg-filter error types

## Related

- **[@rfjs/sql-filter](../sql-filter)** — the column engine.
- **[@rfjs/jsonb-query](../jsonb-query)** — the JSONB engine.
- **[@rfjs/filter-builder](../filter-builder)** — canonical editable tree that compiles to this (`treeToPgFilterGroup` + the `pg-filter` engine).
