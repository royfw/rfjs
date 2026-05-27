# @rfjs/data-transform

Data type transformation utilities for converting between string, number, boolean, and date types.

## Installation

```bash
npm install @rfjs/data-transform
```

## API

### `typeTransfer(value, type)`

Convert a value to the specified data type.

```typescript
import { typeTransfer } from '@rfjs/data-transform';

typeTransfer('42', 'number');       // 42
typeTransfer('true', 'boolean');    // true
typeTransfer('2024-01-01', 'date'); // Date object
typeTransfer('hello', 'string');    // 'hello'
```

Supported types: `'string' | 'number' | 'integer' | 'boolean' | 'date' | 'any'`

### `jsonbTypeTransfer(value, type)`

Convert a value for PostgreSQL JSONB query contexts. Supports 16 type variants covering plain, object, and array forms.

```typescript
import { jsonbTypeTransfer } from '@rfjs/data-transform';

jsonbTypeTransfer('42', 'numeric');         // 42
jsonbTypeTransfer('2024-01-01', 'date');    // '2024-01-01T00:00:00...'
jsonbTypeTransfer('true', 'boolean');       // true
jsonbTypeTransfer('42', 'arrayNumeric');    // 42
```

Supported types: `'string' | 'numeric' | 'date' | 'boolean'` and their `object*` / `array*` / `arrayObject*` variants.

### `toBoolean(value)`

Parse boolean values from strings or pass through existing booleans.

```typescript
import { toBoolean } from '@rfjs/data-transform';

toBoolean('true');    // true
toBoolean('false');   // false
toBoolean(true);      // true
toBoolean('');        // false
```

### `toDateString(value)`

Convert a date string or timestamp to an ISO format string.

```typescript
import { toDateString } from '@rfjs/data-transform';

toDateString('2024-01-15');      // '2024-01-15T00:00:00.000Z'
toDateString(1705276800000);     // '2024-01-15T00:00:00.000Z'
```
