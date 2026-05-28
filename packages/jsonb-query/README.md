# @rfjs/jsonb-query

PostgreSQL JSONB SQL query builder. Generates `FROM` and `WHERE` clauses for querying JSONB columns.

## Installation

```bash
npm install @rfjs/jsonb-query
```

## API

### `toJsonbQuery(jsonb, field, operator, dataType, value)`

Generate a SQL query fragment for a single JSONB field condition.

```typescript
import { toJsonbQuery } from '@rfjs/jsonb-query';

const query = toJsonbQuery(
  'data::jsonb',    // jsonb expression
  'settings.theme', // field path
  'eq',             // operator
  'string',         // dataType
  'dark'            // value
);
// { from: 'data::jsonb', fromAlias: 'j', where: "(data::jsonb -> 'settings' -> 'theme') = 'dark'" }
```

### `genJsonbQuery(jsonb, filterQuery)`

Generate complete SQL `WHERE` and `FROM` clauses from a nested filter metadata tree.

```typescript
import { genJsonbQuery } from '@rfjs/jsonb-query';

const filter: FilterQueryMetadata = {
  logic: 'and',
  filters: [
    {
      field: 'name',
      dataType: 'string',
      operator: 'eq',
      value: 'test',
    },
    {
      logic: 'or',
      filters: [
        { field: 'age', dataType: 'numeric', operator: 'gte', value: 18 },
        { field: 'active', dataType: 'boolean', operator: 'eq', value: true },
      ],
    },
  ],
};

const { where, from } = genJsonbQuery('payload::jsonb', filter);
```

### `toJsonbQueryList(jsonb, metadataList)`

Convert a list of filter metadata into an array of SQL query objects.

## Operators

`eq`, `neq`, `isnull`, `isnotnull`, `contains`, `startswith`, `endswith`, `terms`, `gt`, `gte`, `lt`, `lte`, `range`

## Data Types

All 16 `JsonbDataType` variants: `string`, `numeric`, `date`, `boolean`, and their `object*` / `array*` / `arrayObject*` forms.
