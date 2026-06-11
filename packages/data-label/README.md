# @rfjs/data-label

Compose display label strings from data paths, with optional value translation and a safe `${path}` template.

## Installation

```bash
npm install @rfjs/data-label
```

## Usage

```typescript
import { composeLabel } from '@rfjs/data-label';

const source = { contract: [{ type: 'ProductSales' }], qty: 3 };

// With a template (${aliasKey}, ${_index}, or ${path}):
composeLabel(
  {
    fields: [{ path: 'contract[0].type', aliasKey: 'type' }, { path: 'qty' }],
    valueMap: [{ key: 'ProductSales', value: '產品銷售契約' }],
    template: '${type} x${_1}',
  },
  source,
);
// → '產品銷售契約 x3'

// No template → the field values are space-joined:
composeLabel({ fields: [{ path: 'contract[0].type' }, { path: 'qty' }] }, source);
// → 'ProductSales 3'
```

`${token}` looks up the value table by the **bracket/dot-stripped** form of the token, so
`${contract[0]}`, `${_0}`, and `${alias1}` all resolve. Unknown tokens and nullish values
render as an empty string — composition never throws.

## Custom renderer

The default engine only substitutes `${path}` (no code execution). For advanced templating,
pass your own `render`:

```typescript
import _ from 'lodash';
import { composeLabel, normalizeKey } from '@rfjs/data-label';

composeLabel(spec, source, {
  render: (template, values) => _.template(normalizeKey(template))(values),
});
```

## API

- `composeLabel(spec, source, options?)` → `string`
- `buildLabelValues(spec, source)` → the lookup table (`_N`, raw path, normalized path, `aliasKey`)
- `normalizeKey(path)` → the path with `[`, `]`, `.` removed
