# @rfjs/jsonb-query

Parameterized PostgreSQL JSONB query builder. Turns a filter-metadata tree into
a safe, parameterized `WHERE` expression (node-postgres `$1, $2` placeholders).

## Install

```bash
npm install @rfjs/jsonb-query
```

## Usage

```typescript
import { buildJsonbQuery } from '@rfjs/jsonb-query';

const { where, values } = buildJsonbQuery('data', {
  logic: 'and',
  filters: [
    { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
    {
      logic: 'or',
      filters: [
        { field: 'age', dataType: 'numeric', operator: 'gte', value: 18 },
        { field: 'profile.vip', dataType: 'boolean', operator: 'eq', value: true },
      ],
    },
  ],
});

// where: (("data" #>> $1) = $2) and ((("data" #>> $3)::numeric >= $4) or (("data" #>> $5)::boolean = $6))
// values: [['name'], 'bob', ['age'], 18, ['profile','vip'], true]
await client.query(`SELECT * FROM t WHERE ${where}`, values);
```

### Dialects

```typescript
buildJsonbQuery('data', filter, { dialect: 'jsonpath' });
```

- `legacy` (default) — `#>>` extraction with casts. Works on all supported
  PostgreSQL versions.
- `jsonpath` — `jsonb_path_exists` with SQL/JSON path. Requires PostgreSQL 12+
  (13+ for `date` comparisons, which use `.datetime()`).

Both dialects accept the same filter metadata.

### Embedding in a larger query

Use `paramOffset` when the fragment follows existing parameters:

```typescript
const { where, values } = buildJsonbQuery('data', filter, { paramOffset: 1 });
await client.query(`SELECT * FROM t WHERE org_id = $1 AND ${where}`, [orgId, ...values]);
```

## Safety

Condition **values** and **field paths** are always parameterized — never
interpolated into SQL. The **column** argument is a developer-provided
identifier: it is validated and quoted (`data`, `t.payload`), and anything that
is not a plain (optionally qualified) column reference is rejected.

## Supported types & operators

| dataType | operators |
|----------|-----------|
| `string` | `eq` `neq` `isnull` `isnotnull` `contains` `startswith` `endswith` `terms` |
| `numeric` | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `range` `terms` |
| `date` | `eq` `neq` `isnull` `isnotnull` `gt` `gte` `lt` `lte` `range` `terms` |
| `boolean` | `eq` `neq` `isnull` `isnotnull` |

`range` takes a 2-element `[lo, hi]` value; `terms` takes a non-empty array.

> Nested objects, JSON arrays, and arrays of objects are planned for a later
> release.
