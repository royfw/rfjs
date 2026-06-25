# Form Builder P1 — Engine + ConfigForm Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@rfjs/form-builder` (config types + zod schemas + `configToZod`) and `@rfjs/form-builder-ui` (`<ConfigForm>` runtime renderer), and dogfood a static config inside `workbench`.

**Architecture:** Mirror the `filter-builder` / `filter-builder-ui` split. `@rfjs/form-builder` is framework-agnostic, builds to `dist/` via tsdown, depends only on `zod`. `@rfjs/form-builder-ui` is a private React package (exports `src/`, consumed via `transpilePackages`) that renders a `FormConfig` with `react-hook-form` + `zodResolver(configToZod(config))` over `@rfjs/web-ui` inputs.

**Tech Stack:** TypeScript 5.7+, zod, react 19, react-hook-form, @hookform/resolvers, tsdown, vitest (node + jsdom), @testing-library/react, pnpm workspace, turbo.

## Global Constraints

- Node >=18; pnpm >=10.24.0; TypeScript 5.7+.
- Package source convention: flat `src/` (these packages are ≤7 modules). Co-locate tests as `*.spec.ts(x)` next to source. One barrel `src/index.ts` is the only `exports` entry.
- `@rfjs/form-builder` builds to `dist/` (tsdown, esm+cjs+dts), `platform: 'neutral'`; `@rfjs/form-builder-ui` does NOT build — it exports `src/index.ts` and is added to consumers' `transpilePackages`.
- `zod` version MUST match `@rfjs/web-core` (run `grep '"zod"' packages/web-core/package.json` and pin the same range). All zod schemas use the version-stable API (`z.object`, `z.string`, `z.coerce.number`, `z.boolean`, `z.enum`, `.optional`, `.min`).
- File naming: camelCase for function/util modules; PascalCase only for class/component modules. React components in `.tsx`.
- P1 field components: **Input, Textarea, Select, Checkbox, Date**. **Switch is out of scope** (no web-ui Switch component yet).
- The data-type vocabulary MUST equal `@rfjs/filter-builder`'s: `"string" | "numeric" | "date" | "boolean" | "object" | "array"`.
- Commit after every task (Conventional Commits). The pre-commit hook runs `turbo run lint-staged test --affected`; it needs deps installed (Task 5 runs `pnpm install`). Code/test commits must pass the hook (do NOT use `--no-verify` for code).

---

### Task 1: Scaffold `@rfjs/form-builder` package

**Files:**
- Create: `packages/form-builder/package.json`
- Create: `packages/form-builder/tsconfig.json`
- Create: `packages/form-builder/tsconfig.build.json`
- Create: `packages/form-builder/tsdown.config.ts`
- Create: `packages/form-builder/vitest.config.mts`
- Create: `packages/form-builder/src/index.ts` (temporary placeholder export)
- Test: `packages/form-builder/src/smoke.spec.ts`

**Interfaces:**
- Produces: an installable workspace package `@rfjs/form-builder` with a working `vitest:run` and `build` script.

- [ ] **Step 1: Write the failing smoke test**

`packages/form-builder/src/smoke.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('@rfjs/form-builder', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@rfjs/form-builder');
  });
});
```

- [ ] **Step 2: Create the package config files**

`packages/form-builder/package.json` (mirror `filter-builder`; deps = `zod` only):
```json
{
  "name": "@rfjs/form-builder",
  "version": "0.0.0",
  "description": "Framework-agnostic config-driven form model: config types, zod schema, and configToZod data-schema derivation",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "sideEffects": false,
  "publishConfig": { "access": "public" },
  "scripts": {
    "clean": "pnpm exec rimraf ./dist ./types",
    "build": "pnpm run clean && tsdown --config-loader unrun",
    "typecheck": "tsc --noEmit",
    "lint": "eslint \"src/**/*.ts\"",
    "test": "pnpm run vitest:run",
    "vitest:run": "vitest --passWithNoTests --run"
  },
  "keywords": ["form", "config-driven", "zod", "schema"],
  "author": "Roy Chuang",
  "license": "ISC",
  "repository": { "type": "git", "url": "git+https://github.com/royfw/rfjs.git", "directory": "packages/form-builder" },
  "files": ["dist", "README.md"],
  "dependencies": {
    "zod": "MATCH_WEB_CORE"
  },
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "eslint": "^9.20.1",
    "eslint-config-prettier": "^10.0.1",
    "rimraf": "^6.0.1",
    "tsdown": "0.17.0-beta.6",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.24.0",
    "vitest": "^3.2.3"
  }
}
```
Replace `MATCH_WEB_CORE`: run `grep '"zod"' packages/web-core/package.json` and copy the exact version range.

`packages/form-builder/tsconfig.json` (copy `packages/filter-builder/tsconfig.json` verbatim).

`packages/form-builder/tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "*.config.*"]
}
```

`packages/form-builder/tsdown.config.ts`:
```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  tsconfig: 'tsconfig.build.json',
  target: 'es2023',
  platform: 'neutral',
  treeshake: true,
  sourcemap: true,
  clean: true,
  dts: true,
});
```

`packages/form-builder/vitest.config.mts` (copy `packages/filter-builder/vitest.config.mts` verbatim — node env, include `src/**/*.spec.(ts|js)`).

`packages/form-builder/src/index.ts`:
```ts
export const PACKAGE_NAME = '@rfjs/form-builder';
```

- [ ] **Step 3: Install and run the smoke test**

Run: `pnpm install` (from repo root — registers the new workspace package)
Run: `pnpm -F @rfjs/form-builder vitest:run`
Expected: PASS (1 test).

- [ ] **Step 4: Commit**

```bash
git add packages/form-builder
git commit -m "chore(form-builder): scaffold @rfjs/form-builder package"
```

---

### Task 2: Config types + `FormConfigSchema` (zod)

**Files:**
- Create: `packages/form-builder/src/types.ts`
- Create: `packages/form-builder/src/config-schema.ts`
- Test: `packages/form-builder/src/config-schema.spec.ts`
- Modify: `packages/form-builder/src/index.ts`

**Interfaces:**
- Produces:
  - `type ScalarType = "string" | "numeric" | "date" | "boolean"`
  - `type FieldType = ScalarType | "object" | "array"`
  - `type FieldComponent = "Input" | "Textarea" | "Select" | "Checkbox" | "Date"`
  - `interface FieldConfig { key: string; label: string; component: FieldComponent; dataType: FieldType; required?: boolean; placeholder?: string; defaultValue?: unknown; options?: { label: string; value: string | number }[] }`
  - `interface FormConfig { version: number; fields: FieldConfig[] }`
  - `FormConfigSchema: ZodType<FormConfig>` and `parseFormConfig(input: unknown): FormConfig`

- [ ] **Step 1: Write the failing test**

`packages/form-builder/src/config-schema.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseFormConfig, FormConfigSchema } from './config-schema';

const valid = {
  version: 1,
  fields: [
    { key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true },
    {
      key: 'role',
      label: 'Role',
      component: 'Select',
      dataType: 'string',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'User', value: 'user' },
      ],
    },
  ],
};

describe('FormConfigSchema', () => {
  it('accepts a valid config', () => {
    expect(parseFormConfig(valid)).toEqual(valid);
  });

  it('rejects a field with an unknown component', () => {
    const bad = { version: 1, fields: [{ key: 'x', label: 'X', component: 'Wat', dataType: 'string' }] };
    expect(FormConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a field with an empty key', () => {
    const bad = { version: 1, fields: [{ key: '', label: 'X', component: 'Input', dataType: 'string' }] };
    expect(FormConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a non-integer version', () => {
    expect(FormConfigSchema.safeParse({ version: 1.5, fields: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/form-builder vitest:run`
Expected: FAIL — cannot resolve `./config-schema`.

- [ ] **Step 3: Write the types**

`packages/form-builder/src/types.ts`:
```ts
// Data-type vocabulary — identical to @rfjs/filter-builder's FieldType.
export type ScalarType = 'string' | 'numeric' | 'date' | 'boolean';
export type FieldType = ScalarType | 'object' | 'array';

// P1 renderable components (Switch deferred — no web-ui Switch yet).
export type FieldComponent = 'Input' | 'Textarea' | 'Select' | 'Checkbox' | 'Date';

export interface FieldOption {
  label: string;
  value: string | number;
}

export interface FieldConfig {
  key: string;
  label: string;
  component: FieldComponent;
  dataType: FieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: FieldOption[];
}

export interface FormConfig {
  version: number;
  fields: FieldConfig[];
}
```

- [ ] **Step 4: Write the schema**

`packages/form-builder/src/config-schema.ts`:
```ts
import { z } from 'zod';

import type { FormConfig } from './types';

const fieldOptionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
});

const fieldConfigSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  component: z.enum(['Input', 'Textarea', 'Select', 'Checkbox', 'Date']),
  dataType: z.enum(['string', 'numeric', 'date', 'boolean', 'object', 'array']),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(fieldOptionSchema).optional(),
});

export const FormConfigSchema = z.object({
  version: z.number().int(),
  fields: z.array(fieldConfigSchema),
});

export function parseFormConfig(input: unknown): FormConfig {
  return FormConfigSchema.parse(input) as FormConfig;
}
```

- [ ] **Step 5: Export from the barrel**

`packages/form-builder/src/index.ts` (replace placeholder):
```ts
export * from './types';
export * from './config-schema';
```
Delete `packages/form-builder/src/smoke.spec.ts` (its `PACKAGE_NAME` export is gone). Run `git rm packages/form-builder/src/smoke.spec.ts`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm -F @rfjs/form-builder vitest:run`
Expected: PASS (4 tests in config-schema.spec.ts).

- [ ] **Step 7: Commit**

```bash
git add packages/form-builder
git commit -m "feat(form-builder): add FormConfig types and FormConfigSchema"
```

---

### Task 3: `configToZod` — derive a data-validation schema from a config

**Files:**
- Create: `packages/form-builder/src/config-to-zod.ts`
- Test: `packages/form-builder/src/config-to-zod.spec.ts`
- Modify: `packages/form-builder/src/index.ts`

**Interfaces:**
- Consumes: `FormConfig`, `FieldConfig` from `./types`.
- Produces: `configToZod(config: FormConfig): z.ZodObject<Record<string, z.ZodTypeAny>>` — a schema validating submitted **data** keyed by `field.key`.

**Rules (P1):**
- Base by `dataType`: `string`/`date` → `z.string()`; `numeric` → `z.coerce.number()`; `boolean` → `z.boolean()`; `object`/`array` → `z.unknown()`.
- A `Select`/with-`options` field overrides the base with `z.enum([...stringified option values])`.
- `required: true` → string-ish bases get `.min(1)`; all other bases are left required. `required` falsy → `.optional()`.
- `date` values are ISO strings in P1 (native `<input type="date">`); Date-object coercion is deferred.

- [ ] **Step 1: Write the failing test**

`packages/form-builder/src/config-to-zod.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { configToZod } from './config-to-zod';
import type { FormConfig } from './types';

const config: FormConfig = {
  version: 1,
  fields: [
    { key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true },
    { key: 'age', label: 'Age', component: 'Input', dataType: 'numeric' },
    { key: 'agree', label: 'Agree', component: 'Checkbox', dataType: 'boolean' },
    {
      key: 'role',
      label: 'Role',
      component: 'Select',
      dataType: 'string',
      options: [{ label: 'Admin', value: 'admin' }, { label: 'User', value: 'user' }],
    },
  ],
};

describe('configToZod', () => {
  it('accepts well-formed data and coerces numeric strings', () => {
    const schema = configToZod(config);
    const parsed = schema.parse({ name: 'Ada', age: '42', agree: true, role: 'admin' });
    expect(parsed).toEqual({ name: 'Ada', age: 42, agree: true, role: 'admin' });
  });

  it('rejects an empty value for a required string field', () => {
    const schema = configToZod(config);
    expect(schema.safeParse({ name: '', age: 1, agree: false, role: 'admin' }).success).toBe(false);
  });

  it('omits optional fields', () => {
    const schema = configToZod(config);
    expect(schema.safeParse({ name: 'Ada', agree: false, role: 'user' }).success).toBe(true);
  });

  it('rejects a Select value outside its options', () => {
    const schema = configToZod(config);
    expect(schema.safeParse({ name: 'Ada', agree: false, role: 'ghost' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/form-builder vitest:run`
Expected: FAIL — cannot resolve `./config-to-zod`.

- [ ] **Step 3: Write the implementation**

`packages/form-builder/src/config-to-zod.ts`:
```ts
import { z } from 'zod';

import type { FieldConfig, FormConfig } from './types';

function baseForField(field: FieldConfig): z.ZodTypeAny {
  if (field.options && field.options.length > 0) {
    const values = field.options.map((o) => String(o.value));
    return z.enum(values as [string, ...string[]]);
  }
  switch (field.dataType) {
    case 'numeric':
      return z.coerce.number();
    case 'boolean':
      return z.boolean();
    case 'object':
    case 'array':
      return z.unknown();
    case 'string':
    case 'date':
    default:
      return z.string();
  }
}

function applyRequired(field: FieldConfig, base: z.ZodTypeAny): z.ZodTypeAny {
  const isStringish = base instanceof z.ZodString;
  if (field.required) {
    return isStringish ? (base as z.ZodString).min(1) : base;
  }
  return base.optional();
}

export function configToZod(config: FormConfig): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of config.fields) {
    shape[field.key] = applyRequired(field, baseForField(field));
  }
  return z.object(shape);
}
```

- [ ] **Step 4: Export from the barrel**

`packages/form-builder/src/index.ts` (append):
```ts
export * from './config-to-zod';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm -F @rfjs/form-builder vitest:run`
Expected: PASS (all config-schema + config-to-zod tests).

- [ ] **Step 6: Verify the build emits dist**

Run: `pnpm -F @rfjs/form-builder build`
Expected: `dist/index.mjs`, `dist/index.js`, `dist/index.d.ts` created, no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/form-builder
git commit -m "feat(form-builder): derive data-validation schema via configToZod"
```

---

### Task 4: Scaffold `@rfjs/form-builder-ui` package

**Files:**
- Create: `packages/form-builder-ui/package.json`
- Create: `packages/form-builder-ui/tsconfig.json`
- Create: `packages/form-builder-ui/vitest.config.mts`
- Create: `packages/form-builder-ui/src/index.ts` (temporary placeholder)
- Test: `packages/form-builder-ui/src/smoke.spec.tsx`

**Interfaces:**
- Produces: private workspace package `@rfjs/form-builder-ui` with a jsdom vitest harness.

- [ ] **Step 1: Write the failing smoke test**

`packages/form-builder-ui/src/smoke.spec.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hello } from './index';

describe('@rfjs/form-builder-ui', () => {
  it('renders', () => {
    render(<Hello />);
    expect(screen.getByText('form-builder-ui')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Create the package config**

`packages/form-builder-ui/package.json` (mirror `filter-builder-ui`; private, exports src):
```json
{
  "name": "@rfjs/form-builder-ui",
  "version": "0.0.0",
  "description": "Config-driven form renderer (React) over @rfjs/form-builder; consumed via transpilePackages",
  "type": "module",
  "private": true,
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "lint": "eslint . --max-warnings 0",
    "check-types": "tsc --noEmit",
    "test": "vitest --passWithNoTests --run",
    "vitest:run": "vitest --passWithNoTests --run"
  },
  "dependencies": {
    "@rfjs/form-builder": "workspace:*",
    "@rfjs/web-ui": "workspace:*",
    "@hookform/resolvers": "^3.9.1",
    "react-hook-form": "^7.54.2",
    "zod": "MATCH_WEB_CORE"
  },
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "eslint": "^9.20.1",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-react": "^7.37.4",
    "eslint-plugin-react-hooks": "^5.1.0",
    "jsdom": "^29.1.1",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "typescript": "6.0.3",
    "typescript-eslint": "^8.61.0",
    "vitest": "^3.2.4"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```
Replace `MATCH_WEB_CORE` with the same zod range as Task 1. Verify `react-hook-form` and `@hookform/resolvers` resolve at install; if newer ranges exist, take the latest stable (the install step surfaces this).

`packages/form-builder-ui/tsconfig.json` (copy `packages/filter-builder-ui/tsconfig.json` verbatim).

`packages/form-builder-ui/vitest.config.mts` (copy `packages/filter-builder-ui/vitest.config.mts` verbatim — jsdom, include `src/**/*.spec.(ts|tsx)`).

`packages/form-builder-ui/src/index.ts`:
```tsx
export function Hello() {
  return <span>form-builder-ui</span>;
}
```

- [ ] **Step 3: Install and run the smoke test**

Run: `pnpm install`
Run: `pnpm -F @rfjs/form-builder-ui vitest:run`
Expected: PASS (1 test). If `toBeTruthy` on the element is fine without jest-dom (it is — `getByText` throws if missing).

- [ ] **Step 4: Commit**

```bash
git add packages/form-builder-ui
git commit -m "chore(form-builder-ui): scaffold @rfjs/form-builder-ui package"
```

---

### Task 5: Field renderer — map a `FieldConfig` to a web-ui control

**Files:**
- Create: `packages/form-builder-ui/src/field-control.tsx`
- Test: `packages/form-builder-ui/src/field-control.spec.tsx`

**Interfaces:**
- Consumes: `FieldConfig` from `@rfjs/form-builder`; web-ui components via `@rfjs/web-ui/components/*`.
- Produces: `FieldControl({ field, value, onChange }: { field: FieldConfig; value: unknown; onChange: (v: unknown) => void })` — a controlled control rendering the right web-ui widget for `field.component`.

- [ ] **Step 1: Write the failing test**

`packages/form-builder-ui/src/field-control.spec.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldControl } from './field-control';
import type { FieldConfig } from '@rfjs/form-builder';

const inputField: FieldConfig = { key: 'name', label: 'Name', component: 'Input', dataType: 'string' };

describe('FieldControl', () => {
  it('renders an Input and reports changes', () => {
    const onChange = vi.fn();
    render(<FieldControl field={inputField} value="" onChange={onChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Ada' } });
    expect(onChange).toHaveBeenCalledWith('Ada');
  });

  it('renders a Date input with type=date', () => {
    const field: FieldConfig = { key: 'dob', label: 'DOB', component: 'Date', dataType: 'date' };
    const { container } = render(<FieldControl field={field} value="" onChange={() => {}} />);
    expect(container.querySelector('input[type="date"]')).toBeTruthy();
  });

  it('renders a Checkbox and reports boolean changes', () => {
    const field: FieldConfig = { key: 'agree', label: 'Agree', component: 'Checkbox', dataType: 'boolean' };
    const onChange = vi.fn();
    render(<FieldControl field={field} value={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run`
Expected: FAIL — cannot resolve `./field-control`.

- [ ] **Step 3: Write the implementation**

`packages/form-builder-ui/src/field-control.tsx`:
```tsx
'use client';

import * as React from 'react';
import type { FieldConfig } from '@rfjs/form-builder';
import { Input } from '@rfjs/web-ui/components/input';
import { Textarea } from '@rfjs/web-ui/components/textarea';
import { Checkbox } from '@rfjs/web-ui/components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rfjs/web-ui/components/select';

export interface FieldControlProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function FieldControl({ field, value, onChange }: FieldControlProps) {
  switch (field.component) {
    case 'Textarea':
      return (
        <Textarea
          id={field.key}
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'Checkbox':
      return (
        <Checkbox
          id={field.key}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
      );
    case 'Select':
      return (
        <Select value={(value as string) ?? ''} onValueChange={onChange}>
          <SelectTrigger id={field.key}>
            <SelectValue placeholder={field.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'Date':
      return (
        <Input
          id={field.key}
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'Input':
    default:
      return (
        <Input
          id={field.key}
          type={field.dataType === 'numeric' ? 'number' : 'text'}
          placeholder={field.placeholder}
          value={(value as string | number | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run`
Expected: PASS (3 tests). The Checkbox test asserts radix `role="checkbox"` fires `onCheckedChange`.

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder-ui/src/field-control.tsx packages/form-builder-ui/src/field-control.spec.tsx
git commit -m "feat(form-builder-ui): add FieldControl web-ui control mapper"
```

---

### Task 6: `<ConfigForm>` — render a config with react-hook-form + zod

**Files:**
- Create: `packages/form-builder-ui/src/config-form.tsx`
- Test: `packages/form-builder-ui/src/config-form.spec.tsx`
- Modify: `packages/form-builder-ui/src/index.ts`

**Interfaces:**
- Consumes: `FormConfig`, `configToZod` from `@rfjs/form-builder`; `FieldControl` from `./field-control`; web-ui `Label`, `Button`.
- Produces:
  - `interface ConfigFormProps { config: FormConfig; defaultValues?: Record<string, unknown>; onSubmit: (values: Record<string, unknown>) => void; submitLabel?: string }`
  - `ConfigForm(props: ConfigFormProps): JSX.Element`

- [ ] **Step 1: Write the failing test**

`packages/form-builder-ui/src/config-form.spec.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigForm } from './config-form';
import type { FormConfig } from '@rfjs/form-builder';

const config: FormConfig = {
  version: 1,
  fields: [
    { key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true },
    { key: 'bio', label: 'Bio', component: 'Textarea', dataType: 'string' },
  ],
};

describe('ConfigForm', () => {
  it('renders a label and control per field', () => {
    render(<ConfigForm config={config} onSubmit={() => {}} />);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Bio')).toBeTruthy();
  });

  it('blocks submit and shows no payload when a required field is empty', async () => {
    const onSubmit = vi.fn();
    render(<ConfigForm config={config} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
  });

  it('submits the typed values when valid', async () => {
    const onSubmit = vi.fn();
    render(<ConfigForm config={config} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Ada', bio: undefined }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run`
Expected: FAIL — cannot resolve `./config-form`.

- [ ] **Step 3: Write the implementation**

`packages/form-builder-ui/src/config-form.tsx`:
```tsx
'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { configToZod, type FormConfig } from '@rfjs/form-builder';
import { Label } from '@rfjs/web-ui/components/label';
import { Button } from '@rfjs/web-ui/components/button';

import { FieldControl } from './field-control';

export interface ConfigFormProps {
  config: FormConfig;
  defaultValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void;
  submitLabel?: string;
}

export function ConfigForm({ config, defaultValues, onSubmit, submitLabel = 'Submit' }: ConfigFormProps) {
  const resolver = React.useMemo(() => zodResolver(configToZod(config)), [config]);
  const { control, handleSubmit } = useForm({ resolver, defaultValues });

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values as Record<string, unknown>))} className="flex flex-col gap-4">
      {config.fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <Label htmlFor={field.key}>{field.label}</Label>
          <Controller
            control={control}
            name={field.key}
            render={({ field: rhf }) => (
              <FieldControl field={field} value={rhf.value} onChange={rhf.onChange} />
            )}
          />
        </div>
      ))}
      <Button type="submit" className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Export from the barrel**

`packages/form-builder-ui/src/index.ts` (replace placeholder):
```ts
export * from './config-form';
export * from './field-control';
```
Delete `packages/form-builder-ui/src/smoke.spec.tsx` (run `git rm packages/form-builder-ui/src/smoke.spec.tsx`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run`
Expected: PASS (field-control + config-form tests). The `getByRole('textbox', { name: 'Name' })` query matches because `Label htmlFor` is wired to the control `id`.

- [ ] **Step 6: Type-check**

Run: `pnpm -F @rfjs/form-builder-ui check-types`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/form-builder-ui/src
git commit -m "feat(form-builder-ui): add ConfigForm runtime renderer"
```

---

### Task 7: Dogfood — render a static config in `workbench`

**Files:**
- Modify: `apps/workbench/next.config.*` (add `@rfjs/form-builder-ui` to `transpilePackages`)
- Modify: `apps/workbench/package.json` (add `@rfjs/form-builder-ui` + `@rfjs/form-builder` workspace deps)
- Create: a demo route under `apps/workbench/src/app/[locale]/(shell)/form-demo/page.tsx` (path adjusted to match the actual `(shell)` route group — confirm by listing `apps/workbench/src/app`)

**Interfaces:**
- Consumes: `ConfigForm` from `@rfjs/form-builder-ui`, `FormConfig` from `@rfjs/form-builder`.
- Produces: a visible page rendering a sample form; manual verification only (no automated test — it is a wiring/dogfood task).

- [ ] **Step 1: Confirm workbench app router layout**

Run: `ls apps/workbench/src/app && ls "apps/workbench/src/app/[locale]"`
Note the `(shell)` group path so the new page lands beside existing pages (e.g. the dataset explorer).

- [ ] **Step 2: Wire transpilePackages + deps**

In `apps/workbench/next.config.*`, add `"@rfjs/form-builder-ui"` to the `transpilePackages` array (mirror how `apps/web` lists `"@rfjs/filter-builder-ui"`).
In `apps/workbench/package.json` dependencies add:
```json
"@rfjs/form-builder": "workspace:*",
"@rfjs/form-builder-ui": "workspace:*"
```
Run: `pnpm install`

- [ ] **Step 3: Create the demo page**

`apps/workbench/src/app/[locale]/(shell)/form-demo/page.tsx` (adjust the segment to the confirmed layout):
```tsx
'use client';

import { ConfigForm } from '@rfjs/form-builder-ui';
import type { FormConfig } from '@rfjs/form-builder';

const demoConfig: FormConfig = {
  version: 1,
  fields: [
    { key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true },
    { key: 'role', label: 'Role', component: 'Select', dataType: 'string', options: [
      { label: 'Admin', value: 'admin' },
      { label: 'User', value: 'user' },
    ] },
    { key: 'dob', label: 'Date of birth', component: 'Date', dataType: 'date' },
    { key: 'agree', label: 'I agree', component: 'Checkbox', dataType: 'boolean' },
    { key: 'bio', label: 'Bio', component: 'Textarea', dataType: 'string' },
  ],
};

export default function FormDemoPage() {
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-lg font-semibold">ConfigForm demo</h1>
      <ConfigForm config={demoConfig} onSubmit={(values) => console.log('submit', values)} />
    </div>
  );
}
```

- [ ] **Step 4: Verify it renders**

Run: `pnpm -F workbench dev` (workbench on port 3001), open `http://localhost:3001/en/form-demo` (locale + confirmed path).
Expected: the five fields render; an empty required Name blocks submit; a valid submit logs the typed values to the console. Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add apps/workbench
git commit -m "feat(workbench): dogfood ConfigForm with a static demo config"
```

---

## Self-Review

**Spec coverage (against `2026-06-25-form-builder-shadcn-registry-design.md`):**
- §4 packages: `@rfjs/form-builder` (Tasks 1-3) + `@rfjs/form-builder-ui` (Tasks 4-6) ✓; registry host = deferred to the follow-on registry plan (noted below).
- §5 config schema: types + `FormConfigSchema` (Task 2), `configToZod` (Task 3) ✓; data-type vocabulary aligned with filter-builder ✓.
- §6 renderer: `<ConfigForm>` with field registry + zod validation, react-hook-form + zod (Open Decision 1) ✓.
- §12 P1 field set: Input/Textarea/Select/Checkbox/Date ✓; **Switch deferred** (web-ui has no Switch — documented deviation; trivial radix add in a later task).
- §12 P1 dogfood: static config renders in workbench (Task 7) ✓.
- §12 P1 registry pipeline (`shadcn add`): **NOT in this plan** — it is a separate subsystem (registry.json + `shadcn build` + serve + import-rewrite spike). It gets its own plan, dependent on this one. This is the scope split called out in the writing-plans scope-check.
- §7 rules engine, §8 builder, §9 persistence demo: P2/P3 — out of scope here.

**Placeholder scan:** No "TBD"/"implement later". `MATCH_WEB_CORE` is an explicit, single-command substitution instruction (the exact zod range), not an open placeholder. The workbench route segment is resolved by a concrete `ls` step before use.

**Type consistency:** `FormConfig`, `FieldConfig`, `FieldComponent`, `configToZod` names are identical across Tasks 2-7. `FieldControl` props (`field`/`value`/`onChange`) match between Task 5 definition and Task 6 usage. `ConfigFormProps` is defined once (Task 6) and used in Task 7.

## Follow-on

After this plan: **Registry distribution plan** — `registry.json` in `apps/web`, `shadcn build` → `public/r/*.json`, one `config-form` item (engine as `registry:lib`, renderer as `registry:component`, `registryDependencies` → web-ui primitives), and the `shadcn add` end-to-end spike incl. the `@rfjs/web-ui` → `@/components/ui` import-rewrite decision (spec §11, Open Decision 3). Verify exact `registry.json` field names against current shadcn docs (context7) at that plan's start.
