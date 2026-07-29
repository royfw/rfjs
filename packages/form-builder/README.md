# @rfjs/form-builder

Framework-agnostic **config-driven form model**: declare a `FormConfig` (an array of typed field descriptors), and `configToZod` derives the matching Zod v4 validation schema — required/optional semantics, enum constraints, and correct coercion — ready to drop into any form library (`react-hook-form`, plain `safeParse`, etc.).

This package contains no UI. For a ready-made React editor, see [`@rfjs/form-builder-ui`](../form-builder-ui).

---

## Install

```bash
npm i @rfjs/form-builder
```

---

## Usage

```ts
import { configToZod } from '@rfjs/form-builder';
import type { FormConfig } from '@rfjs/form-builder';

const config: FormConfig = {
  version: 1,
  fields: [
    { key: 'name',  label: 'Name',  component: 'Input',    dataType: 'string',  required: true },
    { key: 'age',   label: 'Age',   component: 'Input',    dataType: 'numeric' },
    { key: 'agree', label: 'Agree', component: 'Checkbox', dataType: 'boolean', required: true },
    {
      key: 'role', label: 'Role', component: 'Select', dataType: 'string',
      options: [{ label: 'Admin', value: 'admin' }, { label: 'User', value: 'user' }],
    },
  ],
};

const schema = configToZod(config);

// success — numeric string coerced, optional age omitted
schema.parse({ name: 'Ada', age: '30', agree: true, role: 'admin' });
// => { name: 'Ada', age: 30, agree: true, role: 'admin' }

// empty optional numeric → undefined (not 0)
schema.safeParse({ name: 'Ada', age: '', agree: true, role: 'user' });
// => { success: true, data: { name: 'Ada', agree: true, role: 'user' } }

// required field empty → fails
schema.safeParse({ name: '', agree: true, role: 'user' });
// => { success: false, error: ZodError }
```

### Field components

| `component` | `dataType`        | Notes                               |
|-------------|-------------------|-------------------------------------|
| `Input`     | `string`/`numeric`/`date` | `numeric` → `z.coerce.number()` |
| `Textarea`  | `string`          |                                     |
| `Select`    | `string`          | requires `options`; validates enum  |
| `Checkbox`  | `boolean`         |                                     |
| `Date`      | `date`            | kept as string (ISO string from `<input type="date">`) |

### Key semantics

- **Required string / date**: `.min(1)` — empty string fails.
- **Required numeric**: empty string `''` fails (preprocessed to `undefined` before `z.coerce.number()` rejects it).
- **Optional fields**: any `''` input is coerced to `undefined`; the key is omitted from the parsed output (never `0` or `''`).
- **Select / enum**: validated against `options` at all times; an invalid value (including `''`) always fails a required field.

### Coercion vs. empty-value handling

Two behaviours are easy to conflate but are deliberately separate:

- **Boolean / `Switch` — no string coercion.** Only `Number` / `dataType: 'numeric'` fields get
  `z.coerce.number()`. A `Switch` (or any `dataType: 'boolean'`) field maps to a plain `z.boolean()`,
  which does **not** coerce strings — sending the string `"true"` fails validation. The delivery/UI
  layer must send a real JSON boolean (e.g. back a controlled boolean value in the form), not a string.
- **`emptyToUndefined` — built-in empty-value guard.** `configToZod` preprocesses every field so an
  empty string `''` becomes `undefined` before validation. For a required `Number` this means
  `'' → undefined → rejected by required`; for optional fields the key is simply omitted. This is
  generic empty-value handling (not type coercion), so consumers **don't** need their own pre-submit
  empty-string cleanup — the schema already covers it.
