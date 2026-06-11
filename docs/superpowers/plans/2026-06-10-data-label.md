# @rfjs/data-label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a zero-dependency `getByPath` to `@rfjs/object-utils`, and create a new published package `@rfjs/data-label` that composes display label strings from data paths (with value translation + a safe `${path}` template and a `render` hook).

**Architecture:** `@rfjs/object-utils` gains one small path-getter (the shared low-level primitive). `@rfjs/data-label` is a new package that depends on `@rfjs/object-utils` (via `workspace:*`, **no lodash**) and layers value-translation + label composition on top. `@rfjs/data-filter` is untouched. Spec: `docs/superpowers/specs/2026-06-10-data-label-design.md`.

**Tech Stack:** TypeScript 5.7 (strict, `noUnusedLocals`), Vitest 3, tsdown (entry `src/index.ts`, esm+cjs), pnpm workspace, Changesets. Mirror the `@rfjs/object-utils` / `@rfjs/retry` package scaffold.

**Conventions for every task:**
- Run one spec file: `pnpm -F <pkg> exec vitest run <path>`
- Whole package: `pnpm -F <pkg> test` · typecheck: `pnpm -F <pkg> typecheck` · lint: `pnpm -F <pkg> lint` · build: `pnpm -F <pkg> build`
- `<pkg>` is `@rfjs/object-utils` or `@rfjs/data-label`.
- The repo pre-commit hook runs `turbo run lint-staged test --affected`; each commit must be green. Commit subjects are lowercase (commitlint). Branch: `feat/data-label` (already created off main).
- **Build order:** `@rfjs/data-label` imports `@rfjs/object-utils` from its built `dist/`. So `@rfjs/object-utils` must be **built** (Task 1) and `pnpm install` must have linked the workspace dep (Task 2) before any `data-label` test runs (Tasks 3-6).

---

## File Structure

**`@rfjs/object-utils` (existing — modify):**
- Create `packages/object-utils/src/getByPath.ts` — the path getter.
- Create `packages/object-utils/src/getByPath.spec.ts` — its tests.
- Modify `packages/object-utils/src/index.ts` — export `getByPath`.
- Create `.changeset/object-utils-getbypath.md` — minor bump.

**`@rfjs/data-label` (new — create):**
- `packages/data-label/package.json` — manifest (dep on object-utils).
- `packages/data-label/tsconfig.json`, `tsconfig.build.json`, `tsdown.config.ts`, `vitest.config.mts`, `eslint.config.mjs` — scaffold (copied from object-utils).
- `packages/data-label/README.md`, `README.zh-TW.md` — docs.
- `packages/data-label/src/types.ts` — `AliasField`, `ValueMapEntry`, `LabelSpec`, `ComposeOptions`.
- `packages/data-label/src/normalizeKey.ts` (+ `.spec.ts`) — strip `[`,`]`,`.`.
- `packages/data-label/src/buildLabelValues.ts` (+ `.spec.ts`) — build the lookup table.
- `packages/data-label/src/composeLabel.ts` (+ `.spec.ts`) — compose the string.
- `packages/data-label/src/index.ts` — barrel.
- `.changeset/data-label-initial.md` — initial release (minor on a `0.0.0` package → `0.1.0`).

---

## Task 1: `getByPath` in `@rfjs/object-utils`

**Files:**
- Create: `packages/object-utils/src/getByPath.ts`
- Create: `packages/object-utils/src/getByPath.spec.ts`
- Modify: `packages/object-utils/src/index.ts`
- Create: `.changeset/object-utils-getbypath.md`

- [ ] **Step 1: Write the failing test**

Create `packages/object-utils/src/getByPath.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getByPath } from './getByPath';

describe('getByPath', () => {
  it('reads a nested dot path', () => {
    expect(getByPath({ a: { b: 1 } }, 'a.b')).toBe(1);
  });
  it('reads through array bracket indexes', () => {
    expect(getByPath({ a: [{ b: 2 }] }, 'a[0].b')).toBe(2);
  });
  it('returns undefined for a missing key', () => {
    expect(getByPath({ a: { b: 1 } }, 'a.x')).toBeUndefined();
  });
  it('short-circuits on a nullish intermediate', () => {
    expect(getByPath({ a: null }, 'a.b')).toBeUndefined();
  });
  it('returns undefined for nullish input', () => {
    expect(getByPath(null, 'a')).toBeUndefined();
    expect(getByPath(undefined, 'a')).toBeUndefined();
  });
  it('returns undefined for an empty path', () => {
    expect(getByPath({ a: 1 }, '')).toBeUndefined();
  });
  it('parses paths as nested, not as a literal dotted key', () => {
    expect(getByPath({ 'a.b': 5 }, 'a.b')).toBeUndefined();
  });
  it('returns a leaf scalar value as-is', () => {
    expect(getByPath({ a: 'hi' }, 'a')).toBe('hi');
    expect(getByPath({ a: 0 }, 'a')).toBe(0);
    expect(getByPath({ a: false }, 'a')).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @rfjs/object-utils exec vitest run src/getByPath.spec.ts`
Expected: FAIL — `getByPath` is not defined (import error).

- [ ] **Step 3: Implement `getByPath`**

Create `packages/object-utils/src/getByPath.ts`:
```ts
/**
 * Read a value from `obj` by a dot/bracket path, e.g. `'a.b[0].c'`.
 * Returns `undefined` for a missing path, a nullish intermediate, or a non-object
 * input. Paths are parsed as nested access — a literal key containing `.` is NOT
 * supported (matching the common `_.get` convention).
 */
export function getByPath(obj: unknown, path: string): unknown {
  const keys = path
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .filter((k) => k.length > 0);
  if (keys.length === 0) return undefined;
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
```

- [ ] **Step 4: Export it**

Modify `packages/object-utils/src/index.ts` — add the line so it reads:
```ts
export * from './flatten';
export * from './keysToNested';
export * from './toJSONString';
export * from './toFlatString';
export * from './getByPath';
```

- [ ] **Step 5: Run — expect PASS + typecheck**

Run: `pnpm -F @rfjs/object-utils exec vitest run src/getByPath.spec.ts`
Then: `pnpm -F @rfjs/object-utils typecheck`
Expected: all PASS, typecheck clean.

- [ ] **Step 6: Build object-utils (so data-label can consume it)**

Run: `pnpm -F @rfjs/object-utils build`
Expected: succeeds; `packages/object-utils/dist/` contains `index.d.ts`/`index.mjs`/`index.js` with `getByPath`.

- [ ] **Step 7: Add the changeset**

Create `.changeset/object-utils-getbypath.md`:
```markdown
---
"@rfjs/object-utils": minor
---

Add `getByPath(obj, path)` — read a value by a dot/bracket path (e.g. `a.b[0].c`), returning `undefined` for a missing path, a nullish intermediate, or a non-object input.
```

- [ ] **Step 8: Commit**

```bash
git add packages/object-utils/src/getByPath.ts packages/object-utils/src/getByPath.spec.ts packages/object-utils/src/index.ts .changeset/object-utils-getbypath.md
git commit -m "feat(object-utils): add getByPath path getter"
```

---

## Task 2: Scaffold the `@rfjs/data-label` package

No TDD here (config files); the gate is "the empty package type-checks and the test harness runs."

**Files (all Create):** `packages/data-label/package.json`, `tsconfig.json`, `tsconfig.build.json`, `tsdown.config.ts`, `vitest.config.mts`, `eslint.config.mjs`, `README.md`, `README.zh-TW.md`, `src/index.ts`.

- [ ] **Step 1: Create `packages/data-label/package.json`**

Note `version` is `0.0.0` (the initial changeset will bump it to `0.1.0`).
```json
{
  "name": "@rfjs/data-label",
  "version": "0.0.0",
  "description": "Compose display label strings from data paths, value maps, and templates",
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
  "private": false,
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "clean": "pnpm exec npm-run-all --parallel clean:dist clean:types",
    "clean:types": "pnpm exec rimraf ./types",
    "clean:dist": "pnpm exec rimraf ./dist",
    "dev": "pnpm exec npm-run-all --parallel dev:tsdown typecheck:watch",
    "dev:tsdown": "pnpm run clean && tsdown --config-loader unrun --watch",
    "build": "pnpm run build:tsdown",
    "build:tsdown": "pnpm run clean && tsdown --config-loader unrun",
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\"",
    "lint:fix": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "pnpm run vitest:run",
    "vitest:run": "vitest --passWithNoTests --run",
    "vitest:ui": "vitest --passWithNoTests --ui"
  },
  "keywords": [],
  "author": "Roy Chuang",
  "license": "ISC",
  "files": [
    "dist",
    "README.md",
    "README.zh-TW.md"
  ],
  "dependencies": {
    "@rfjs/object-utils": "workspace:*"
  },
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "@vitest/coverage-istanbul": "^3.2.3",
    "@vitest/ui": "^3.2.3",
    "eslint": "^9.20.1",
    "eslint-config-prettier": "^10.0.1",
    "npm-run-all": "^4.1.5",
    "prettier": "^3.5.1",
    "rimraf": "^6.0.1",
    "ts-node": "^10.9.2",
    "tsdown": "0.17.0-beta.6",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.24.0",
    "vitest": "^3.2.3"
  }
}
```

- [ ] **Step 2: Create `packages/data-label/tsconfig.json`** (copied verbatim from object-utils)

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "rootDir": "./src",
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "importHelpers": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "declarationDir": "types",
    "emitDeclarationOnly": false,
    "outDir": "dist",
    "sourceMap": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "resolveJsonModule": true,
    "removeComments": true,
    "newLine": "lf",
    "noUnusedLocals": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "lib": ["ESNext"]
  },
  "exclude": ["node_modules", "dist*", "test", "types", "**/*(spec|test).ts", "**/*e2e-(spec|test).ts", "*.config.*"]
}
```

- [ ] **Step 3: Create `packages/data-label/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "*.config.*"]
}
```

- [ ] **Step 4: Create `packages/data-label/tsdown.config.ts`**

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

- [ ] **Step 5: Create `packages/data-label/vitest.config.mts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.spec.(ts|js)', 'src/**/*.test.(ts|js)'],
  },
});
```

- [ ] **Step 6: Create `packages/data-label/eslint.config.mjs`** (copied verbatim from object-utils)

```js
// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist', '**/*.spec.ts', '**/*.test.ts'],
  },
  eslintConfigPrettier,
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 5,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
    },
  },
);
```

- [ ] **Step 7: Create a placeholder barrel `packages/data-label/src/index.ts`**

(so the package builds before the modules exist; later tasks add real exports)
```ts
export {};
```

- [ ] **Step 8: Create `packages/data-label/README.md`**

````markdown
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
````

- [ ] **Step 9: Create `packages/data-label/README.zh-TW.md`**

````markdown
# @rfjs/data-label

依資料路徑組成顯示用標籤字串,支援值翻譯與安全的 `${path}` 模板。

## 安裝

```bash
npm install @rfjs/data-label
```

## 用法

```typescript
import { composeLabel } from '@rfjs/data-label';

const source = { contract: [{ type: 'ProductSales' }], qty: 3 };

// 有模板(可用 ${aliasKey}、${_索引}、${path}):
composeLabel(
  {
    fields: [{ path: 'contract[0].type', aliasKey: 'type' }, { path: 'qty' }],
    valueMap: [{ key: 'ProductSales', value: '產品銷售契約' }],
    template: '${type} x${_1}',
  },
  source,
);
// → '產品銷售契約 x3'

// 無模板 → 各欄位值以空白 join:
composeLabel({ fields: [{ path: 'contract[0].type' }, { path: 'qty' }] }, source);
// → 'ProductSales 3'
```

`${token}` 會以**去掉 `[ ] .`** 後的形式查表,所以 `${contract[0]}`、`${_0}`、`${alias1}`
都能解析。未知 token 與 nullish 值會輸出空字串 —— 組字不會丟錯。

## 自訂渲染器

預設引擎只做 `${path}` 取值替換(不執行任何程式碼)。需要進階模板時,自行傳入 `render`:

```typescript
import _ from 'lodash';
import { composeLabel, normalizeKey } from '@rfjs/data-label';

composeLabel(spec, source, {
  render: (template, values) => _.template(normalizeKey(template))(values),
});
```

## API

- `composeLabel(spec, source, options?)` → `string`
- `buildLabelValues(spec, source)` → 查找表(`_N`、原始 path、正規化 path、`aliasKey`)
- `normalizeKey(path)` → 去掉 `[`、`]`、`.` 的 path
````

- [ ] **Step 10: Install + verify the harness**

Run (from repo root): `pnpm install`
Expected: succeeds; `packages/data-label/node_modules/@rfjs/object-utils` is symlinked to the workspace package.

Run: `pnpm -F @rfjs/data-label typecheck`
Expected: clean (empty barrel).

Run: `pnpm -F @rfjs/data-label test`
Expected: passes with no tests (`--passWithNoTests`).

- [ ] **Step 11: Commit**

```bash
git add packages/data-label pnpm-lock.yaml
git commit -m "chore(data-label): scaffold package"
```

---

## Task 3: `normalizeKey`

**Files:**
- Create: `packages/data-label/src/normalizeKey.ts`
- Create: `packages/data-label/src/normalizeKey.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/data-label/src/normalizeKey.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalizeKey } from './normalizeKey';

describe('normalizeKey', () => {
  it('strips brackets', () => {
    expect(normalizeKey('contract[0]')).toBe('contract0');
  });
  it('strips dots and brackets together', () => {
    expect(normalizeKey('a.b[1]')).toBe('ab1');
  });
  it('leaves a positional/underscore token unchanged', () => {
    expect(normalizeKey('_0')).toBe('_0');
  });
  it('leaves a plain alias key unchanged', () => {
    expect(normalizeKey('alias1')).toBe('alias1');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-label exec vitest run src/normalizeKey.spec.ts`
Expected: FAIL — `normalizeKey` not defined.

- [ ] **Step 3: Implement**

Create `packages/data-label/src/normalizeKey.ts`:
```ts
/** Strip `[`, `]`, and `.` from a path so it can be used as a template variable. */
export function normalizeKey(path: string): string {
  return path.replace(/[[\].]/g, '');
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm -F @rfjs/data-label exec vitest run src/normalizeKey.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/data-label/src/normalizeKey.ts packages/data-label/src/normalizeKey.spec.ts
git commit -m "feat(data-label): add normalizeKey"
```

---

## Task 4: types + `buildLabelValues`

**Files:**
- Create: `packages/data-label/src/types.ts`
- Create: `packages/data-label/src/buildLabelValues.ts`
- Create: `packages/data-label/src/buildLabelValues.spec.ts`

- [ ] **Step 1: Create the types**

Create `packages/data-label/src/types.ts`:
```ts
export interface AliasField {
  /** Dot/bracket path into the source, e.g. `'contract[0]'`. */
  path: string;
  /** Optional friendly name usable in templates, e.g. `'alias1'`. */
  aliasKey?: string;
}

export interface ValueMapEntry {
  /** Raw resolved value to match. */
  key: string | number | boolean;
  /** Replacement value (e.g. an enum code → display label). */
  value: unknown;
}

export interface LabelSpec {
  /** Source paths to resolve, in order. */
  fields: AliasField[];
  /** Optional value-translation entries (enum decode). */
  valueMap?: ValueMapEntry[];
  /** Optional composition template, e.g. `'${_0}_${_1}'`, `'${contract[0]}'`, `'${alias1}'`. */
  template?: string;
}

export interface ComposeOptions {
  /**
   * Custom template renderer. Receives the raw template and the full value table (which
   * contains positional `_N`, raw-path, normalized-path, and `aliasKey` entries). If omitted,
   * a safe `${path}` interpolator is used.
   */
  render?: (template: string, values: Record<string, unknown>) => string;
}
```

- [ ] **Step 2: Write the failing test**

Create `packages/data-label/src/buildLabelValues.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildLabelValues } from './buildLabelValues';

describe('buildLabelValues', () => {
  it('stores each value under positional, raw-path, normalized-path, and aliasKey keys', () => {
    const values = buildLabelValues(
      { fields: [{ path: 'contract[0]', aliasKey: 'c0' }] },
      { contract: ['X'] },
    );
    expect(values['_0']).toBe('X');
    expect(values['contract[0]']).toBe('X');
    expect(values['contract0']).toBe('X');
    expect(values['c0']).toBe('X');
  });

  it('translates a resolved value via valueMap, passing through unmatched values', () => {
    const values = buildLabelValues(
      {
        fields: [{ path: 'type' }, { path: 'other' }],
        valueMap: [{ key: 'ProductSales', value: '產品銷售契約' }],
      },
      { type: 'ProductSales', other: 'keep' },
    );
    expect(values['_0']).toBe('產品銷售契約');
    expect(values['_1']).toBe('keep');
  });

  it('keeps a falsy mapped value (uses has(), not ??)', () => {
    const values = buildLabelValues(
      { fields: [{ path: 'flag' }], valueMap: [{ key: true, value: '' }] },
      { flag: true },
    );
    expect(values['_0']).toBe('');
  });

  it('resolves a missing path to null', () => {
    const values = buildLabelValues({ fields: [{ path: 'nope' }] }, {});
    expect(values['_0']).toBeNull();
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-label exec vitest run src/buildLabelValues.spec.ts`
Expected: FAIL — `buildLabelValues` not defined.

- [ ] **Step 4: Implement**

Create `packages/data-label/src/buildLabelValues.ts`:
```ts
import { getByPath } from '@rfjs/object-utils';
import { normalizeKey } from './normalizeKey';
import type { LabelSpec } from './types';

/**
 * Resolve each field's path against `source`, translate via `valueMap`, and store the result
 * under four keys: `_${index}` (positional), the raw path, the normalized path, and `aliasKey`
 * (when set). A missing path resolves to `null`. Unmatched values pass through; falsy mapped
 * values are honored (lookup uses `Map.has`).
 */
export function buildLabelValues(
  spec: LabelSpec,
  source: object,
): Record<string, unknown> {
  const translation = new Map<unknown, unknown>(
    (spec.valueMap ?? []).map((entry) => [entry.key, entry.value]),
  );
  const values: Record<string, unknown> = {};
  spec.fields.forEach((field, index) => {
    const raw = getByPath(source, field.path) ?? null;
    const translated = translation.has(raw) ? translation.get(raw) : raw;
    values[`_${index}`] = translated;
    values[field.path] = translated;
    values[normalizeKey(field.path)] = translated;
    if (field.aliasKey) {
      values[field.aliasKey] = translated;
    }
  });
  return values;
}
```

- [ ] **Step 5: Run — expect PASS + typecheck**

Run: `pnpm -F @rfjs/data-label exec vitest run src/buildLabelValues.spec.ts`
Then: `pnpm -F @rfjs/data-label typecheck`
Expected: PASS, typecheck clean. (Requires Task 1's built `@rfjs/object-utils` and Task 2's `pnpm install`.)

- [ ] **Step 6: Commit**

```bash
git add packages/data-label/src/types.ts packages/data-label/src/buildLabelValues.ts packages/data-label/src/buildLabelValues.spec.ts
git commit -m "feat(data-label): add types and buildLabelValues"
```

---

## Task 5: `composeLabel`

**Files:**
- Create: `packages/data-label/src/composeLabel.ts`
- Create: `packages/data-label/src/composeLabel.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/data-label/src/composeLabel.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { composeLabel } from './composeLabel';

const source = { contract: [{ type: 'ProductSales' }], qty: 3 };

describe('composeLabel', () => {
  it('interpolates aliasKey, positional, and path tokens', () => {
    expect(
      composeLabel(
        {
          fields: [{ path: 'contract[0].type', aliasKey: 'type' }, { path: 'qty' }],
          valueMap: [{ key: 'ProductSales', value: '產品銷售契約' }],
          template: '${type} x${_1}',
        },
        source,
      ),
    ).toBe('產品銷售契約 x3');
  });

  it('resolves a ${path} token by its normalized form', () => {
    expect(
      composeLabel(
        { fields: [{ path: 'contract[0].type' }], template: '<${contract[0].type}>' },
        source,
      ),
    ).toBe('<ProductSales>');
  });

  it('renders unknown tokens and nullish values as empty string', () => {
    expect(
      composeLabel({ fields: [{ path: 'missing' }], template: 'a${_0}b${nope}c' }, {}),
    ).toBe('abc');
  });

  it('space-joins field values when there is no template', () => {
    expect(
      composeLabel({ fields: [{ path: 'contract[0].type' }, { path: 'qty' }] }, source),
    ).toBe('ProductSales 3');
  });

  it('keeps 0 and false in the no-template join (drops only null/undefined/"")', () => {
    expect(
      composeLabel(
        { fields: [{ path: 'a' }, { path: 'b' }, { path: 'c' }, { path: 'd' }] },
        { a: 0, b: false, c: '', d: 'x' },
      ),
    ).toBe('0 false x');
  });

  it('uses a custom render hook when provided', () => {
    expect(
      composeLabel(
        { fields: [{ path: 'qty' }], template: 'RAW' },
        source,
        { render: (template, values) => `${template}:${String(values['_0'])}` },
      ),
    ).toBe('RAW:3');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm -F @rfjs/data-label exec vitest run src/composeLabel.spec.ts`
Expected: FAIL — `composeLabel` not defined.

- [ ] **Step 3: Implement**

Create `packages/data-label/src/composeLabel.ts`:
```ts
import { buildLabelValues } from './buildLabelValues';
import { normalizeKey } from './normalizeKey';
import type { ComposeOptions, LabelSpec } from './types';

const TOKEN = /\$\{([^}]+)\}/g;

/**
 * Compose a display label from `spec` + `source`. With a `template`, each `${token}` is
 * replaced by the value table entry for `normalizeKey(token)` (unknown/nullish → ''); a custom
 * `options.render` overrides this. Without a template, the field values are space-joined,
 * dropping `null`/`undefined`/`''` (but keeping `0`/`false`). Never throws.
 */
export function composeLabel(
  spec: LabelSpec,
  source: object,
  options: ComposeOptions = {},
): string {
  const values = buildLabelValues(spec, source);

  if (spec.template !== undefined) {
    if (options.render) {
      return options.render(spec.template, values);
    }
    return spec.template.replace(TOKEN, (_match, token: string) => {
      const value = values[normalizeKey(token.trim())];
      return value === null || value === undefined ? '' : String(value);
    });
  }

  return spec.fields
    .map((field) => values[field.path])
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => String(value))
    .join(' ');
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm -F @rfjs/data-label exec vitest run src/composeLabel.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/data-label/src/composeLabel.ts packages/data-label/src/composeLabel.spec.ts
git commit -m "feat(data-label): add composeLabel"
```

---

## Task 6: Barrel, changeset, full verification

**Files:**
- Modify: `packages/data-label/src/index.ts`
- Create: `.changeset/data-label-initial.md`

- [ ] **Step 1: Replace the barrel**

Overwrite `packages/data-label/src/index.ts`:
```ts
export * from './types';
export * from './normalizeKey';
export * from './buildLabelValues';
export * from './composeLabel';
```

- [ ] **Step 2: Build + verify the public surface**

Run: `pnpm -F @rfjs/data-label build`
Expected: succeeds; `packages/data-label/dist/index.d.ts` exports `composeLabel`, `buildLabelValues`, `normalizeKey`, and the types.

- [ ] **Step 3: Full gate (both packages)**

```bash
pnpm -F @rfjs/object-utils lint && pnpm -F @rfjs/object-utils typecheck && pnpm -F @rfjs/object-utils test && pnpm -F @rfjs/object-utils build
pnpm -F @rfjs/data-label lint && pnpm -F @rfjs/data-label typecheck && pnpm -F @rfjs/data-label test && pnpm -F @rfjs/data-label build
```
Expected: all green; lint 0 errors.

- [ ] **Step 4: Add the initial-release changeset**

Create `.changeset/data-label-initial.md` (a `minor` on the `0.0.0` package versions it to `0.1.0`):
```markdown
---
"@rfjs/data-label": minor
---

Initial release. Compose display label strings from data paths with optional value translation and a safe `${path}` template (plus a `render` hook for custom engines). Depends on `@rfjs/object-utils` for path resolution.
```

- [ ] **Step 5: Validate the changeset set**

Run: `pnpm changeset status`
Expected: lists `@rfjs/object-utils` (minor) and `@rfjs/data-label` (minor) to be bumped. Both must release together (data-label's `workspace:*` pins the object-utils version carrying `getByPath`). Do NOT run `changeset version`/`publish` locally — that goes through CI per `CLAUDE.md`.

- [ ] **Step 6: Commit**

```bash
git add packages/data-label/src/index.ts .changeset/data-label-initial.md
git commit -m "feat(data-label): export public api and add release changeset"
```

---

## Self-Review

**Spec coverage:**
- `getByPath` (object-utils, zero-dep, edge table) → Task 1 ✓
- `data-label` scaffold mirroring object-utils/retry, dep `workspace:*`, no lodash → Task 2 ✓
- `normalizeKey` → Task 3 ✓ | types + `buildLabelValues` (4-key table, translation via `has`, missing→null) → Task 4 ✓
- `composeLabel` (safe interpolator, render hook, no-template join keeping 0/false, never throws) → Task 5 ✓
- Barrel + both changesets (object-utils minor, data-label initial) + release-together note → Task 6 ✓
- Out-of-scope items (no `name`, no built-in lodash.template, data-filter untouched, no BPM migration, no registry.json) → respected (no tasks touch them).

**Placeholder scan:** none — every step has complete code/commands. (Task 2's `src/index.ts` `export {}` is an intentional temporary barrel, replaced in Task 6.)

**Type/name consistency:** `LabelSpec`/`AliasField`/`ValueMapEntry`/`ComposeOptions` defined in Task 4 and consumed identically in Task 5; `normalizeKey` (Task 3) used by both `buildLabelValues` (Task 4) and `composeLabel` (Task 5); `getByPath` (Task 1) imported by `buildLabelValues` (Task 4); barrel (Task 6) exports exactly these names.

**Build-order dependency:** Task 1 builds object-utils; Task 2 `pnpm install` links it; Tasks 4-6 (which import `@rfjs/object-utils`) run after both — called out in the conventions header and Task 4 Step 5.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-10-data-label.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
