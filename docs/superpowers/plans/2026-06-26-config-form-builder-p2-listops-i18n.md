# ConfigFormBuilder — Phase 2 (engine list-ops + multilingual labels) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the editing primitives the visual builder (Phase 3) needs — pure `list-ops` over `FormConfig` — and multilingual labels (`LocalizedLabel` + `resolveLabel`), wiring label resolution into `<ConfigForm>`.

**Architecture:** Pure functions in `@rfjs/form-builder` (no React). `label` widens from `string` to `string | Record<locale,string>` — backward-compatible at the value level (a plain string is still valid). The widening + its UI consumer (`<ConfigForm>`) land in ONE task so no intermediate commit leaves `form-builder-ui` type-broken.

**Tech Stack:** TypeScript, zod v4, React 19, vitest (node + jsdom), @testing-library/react.

## Global Constraints

- `@rfjs/form-builder` builds to `dist/` (tsdown); `@rfjs/form-builder-ui` exports `src/`. zod v4.
- list-ops are **pure** — return a new `FormConfig`, never mutate the input.
- `LocalizedLabel = string | Record<string, string>`. `resolveLabel(label, locale, fallbackLocale?)`: string → itself; record → `record[locale]` ?? `record[fallbackLocale]` ?? first value ?? `''`.
- `FormConfigSchema` keeps its `ZodType<FormConfig>` annotation. `configToZod` is untouched (labels are display-only).
- The `label` widening + `<ConfigForm>` label-resolution land in the **same** task/commit so the pre-commit `turbo ... test --affected` (which runs `form-builder-ui` tests when `form-builder` changes) stays green.
- Co-locate `*.spec.ts(x)`. Conventional Commits; pre-commit hook must pass (no `--no-verify`). Fresh worktree → `pnpm install` first.

---

### Task 1: Engine — `list-ops` (add / remove / update / move)

**Files:**
- Create: `packages/form-builder/src/list-ops.ts`
- Test: `packages/form-builder/src/list-ops.spec.ts`
- Modify: `packages/form-builder/src/index.ts` (barrel)

**Interfaces produced (Phase 3 depends on these):**
```ts
export function addField(config: FormConfig, field: FieldConfig, index?: number): FormConfig
export function removeField(config: FormConfig, key: string): FormConfig
export function updateField(config: FormConfig, key: string, patch: Partial<FieldConfig>): FormConfig
export function moveField(config: FormConfig, from: number, to: number): FormConfig
```

- [ ] **Step 1: Install deps**

Run: `pnpm install` (repo root; fresh worktree).

- [ ] **Step 2: Write the failing tests**

`packages/form-builder/src/list-ops.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { addField, removeField, updateField, moveField } from './list-ops';
import type { FormConfig, FieldConfig } from './types';

const f = (key: string): FieldConfig => ({ key, label: key, component: 'Input', dataType: 'string' });
const base: FormConfig = { version: 1, fields: [f('a'), f('b'), f('c')] };

describe('list-ops', () => {
  it('addField appends by default and does not mutate input', () => {
    const out = addField(base, f('d'));
    expect(out.fields.map((x) => x.key)).toEqual(['a', 'b', 'c', 'd']);
    expect(base.fields).toHaveLength(3); // input untouched
  });

  it('addField inserts at an index', () => {
    expect(addField(base, f('x'), 1).fields.map((x) => x.key)).toEqual(['a', 'x', 'b', 'c']);
  });

  it('removeField drops the matching key', () => {
    expect(removeField(base, 'b').fields.map((x) => x.key)).toEqual(['a', 'c']);
  });

  it('updateField merges a patch into the matching field only', () => {
    const out = updateField(base, 'b', { label: 'Bee', required: true });
    expect(out.fields[1]).toMatchObject({ key: 'b', label: 'Bee', required: true });
    expect(out.fields[0]).toEqual(f('a'));
  });

  it('moveField reorders', () => {
    expect(moveField(base, 0, 2).fields.map((x) => x.key)).toEqual(['b', 'c', 'a']);
  });

  it('moveField is a no-op for an out-of-range source', () => {
    expect(moveField(base, 9, 0)).toEqual(base);
  });
});
```

- [ ] **Step 3: Run — verify fail**

Run: `pnpm -F @rfjs/form-builder vitest:run` → FAIL (cannot resolve `./list-ops`).

- [ ] **Step 4: Implement**

`packages/form-builder/src/list-ops.ts`:
```ts
import type { FieldConfig, FormConfig } from './types';

export function addField(config: FormConfig, field: FieldConfig, index?: number): FormConfig {
  const fields = [...config.fields];
  const at = index === undefined ? fields.length : Math.max(0, Math.min(index, fields.length));
  fields.splice(at, 0, field);
  return { ...config, fields };
}

export function removeField(config: FormConfig, key: string): FormConfig {
  return { ...config, fields: config.fields.filter((field) => field.key !== key) };
}

export function updateField(config: FormConfig, key: string, patch: Partial<FieldConfig>): FormConfig {
  return {
    ...config,
    fields: config.fields.map((field) => (field.key === key ? { ...field, ...patch } : field)),
  };
}

export function moveField(config: FormConfig, from: number, to: number): FormConfig {
  if (from < 0 || from >= config.fields.length) return config;
  const fields = [...config.fields];
  const clampedTo = Math.max(0, Math.min(to, fields.length - 1));
  const [moved] = fields.splice(from, 1);
  fields.splice(clampedTo, 0, moved);
  return { ...config, fields };
}
```

- [ ] **Step 5: Export from barrel**

`packages/form-builder/src/index.ts` (append): `export * from './list-ops';`

- [ ] **Step 6: Run + build**

Run: `pnpm -F @rfjs/form-builder vitest:run` → all pass.
Run: `pnpm -F @rfjs/form-builder build` → dist re-emitted.

- [ ] **Step 7: Commit**

```bash
git add packages/form-builder/src
git commit -m "feat(form-builder): add list-ops (add/remove/update/move field)"
```

---

### Task 2: Multilingual labels (engine + `<ConfigForm>` resolution)

**Files:**
- Modify: `packages/form-builder/src/types.ts` (add `LocalizedLabel`, widen `FieldConfig.label`)
- Create: `packages/form-builder/src/localized-label.ts`
- Test: `packages/form-builder/src/localized-label.spec.ts`
- Modify: `packages/form-builder/src/config-schema.ts` (label union)
- Modify: `packages/form-builder/src/config-schema.spec.ts` (add cases)
- Modify: `packages/form-builder/src/index.ts` (barrel)
- Modify: `packages/form-builder-ui/src/config-form.tsx` (locale prop + resolveLabel)
- Test: `packages/form-builder-ui/src/config-form.spec.tsx` (add cases)

**Interfaces produced:**
- `type LocalizedLabel = string | Record<string, string>`; `FieldConfig.label: LocalizedLabel`
- `resolveLabel(label: LocalizedLabel, locale: string, fallbackLocale?: string): string`
- `ConfigFormProps.locale?: string` (default `'en'`)

- [ ] **Step 1: Write the failing engine tests**

`packages/form-builder/src/localized-label.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolveLabel } from './localized-label';

describe('resolveLabel', () => {
  it('returns a plain string as-is', () => {
    expect(resolveLabel('Name', 'zh-TW')).toBe('Name');
  });
  it('returns the locale entry from a record', () => {
    expect(resolveLabel({ en: 'Name', 'zh-TW': '姓名' }, 'zh-TW')).toBe('姓名');
  });
  it('falls back to fallbackLocale, then to the first value', () => {
    expect(resolveLabel({ en: 'Name' }, 'zh-TW', 'en')).toBe('Name');
    expect(resolveLabel({ ja: '名前' }, 'zh-TW')).toBe('名前');
  });
  it('returns empty string for an empty record', () => {
    expect(resolveLabel({}, 'en')).toBe('');
  });
});
```
Add to `packages/form-builder/src/config-schema.spec.ts`:
```ts
describe('localized labels', () => {
  it('accepts a record label', () => {
    const cfg = { version: 1, fields: [{ key: 'n', label: { en: 'Name', 'zh-TW': '姓名' }, component: 'Input', dataType: 'string' }] };
    expect(parseFormConfig(cfg)).toEqual(cfg);
  });
  it('still accepts a string label', () => {
    expect(FormConfigSchema.safeParse({ version: 1, fields: [{ key: 'n', label: 'Name', component: 'Input', dataType: 'string' }] }).success).toBe(true);
  });
  it('rejects a numeric label', () => {
    expect(FormConfigSchema.safeParse({ version: 1, fields: [{ key: 'n', label: 5, component: 'Input', dataType: 'string' }] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Write the failing UI test**

Add to `packages/form-builder-ui/src/config-form.spec.tsx`:
```ts
describe('localized labels', () => {
  const cfg: FormConfig = {
    version: 1,
    fields: [{ key: 'name', label: { en: 'Name', 'zh-TW': '姓名' }, component: 'Input', dataType: 'string' }],
  };
  it('renders the label for the given locale', () => {
    render(<ConfigForm config={cfg} locale="zh-TW" onSubmit={() => {}} />);
    expect(screen.getByText('姓名')).toBeTruthy();
  });
  it('defaults to the en label', () => {
    render(<ConfigForm config={cfg} onSubmit={() => {}} />);
    expect(screen.getByText('Name')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run — verify fail**

Run: `pnpm -F @rfjs/form-builder vitest:run` (resolveLabel/schema fail) and `pnpm -F @rfjs/form-builder-ui vitest:run` (locale test fails). Expected FAIL.

- [ ] **Step 4: Implement the engine**

`packages/form-builder/src/types.ts` — add the type and widen `label`:
```ts
export type LocalizedLabel = string | Record<string, string>;
```
Change `FieldConfig.label` from `label: string;` to `label: LocalizedLabel;`.

`packages/form-builder/src/localized-label.ts`:
```ts
import type { LocalizedLabel } from './types';

export function resolveLabel(label: LocalizedLabel, locale: string, fallbackLocale?: string): string {
  if (typeof label === 'string') return label;
  if (label[locale] !== undefined) return label[locale];
  if (fallbackLocale !== undefined && label[fallbackLocale] !== undefined) return label[fallbackLocale];
  return Object.values(label)[0] ?? '';
}
```

`packages/form-builder/src/config-schema.ts` — change the `label` line in `fieldConfigSchema` from `label: z.string(),` to:
```ts
  label: z.union([z.string(), z.record(z.string(), z.string())]),
```

`packages/form-builder/src/index.ts` (append): `export * from './localized-label';`

Run `pnpm -F @rfjs/form-builder typecheck` — the `ZodType<FormConfig>` annotation must hold (union output `string | Record<string,string>` = `LocalizedLabel`). Then `pnpm -F @rfjs/form-builder build`.

- [ ] **Step 5: Implement `<ConfigForm>` label resolution**

In `packages/form-builder-ui/src/config-form.tsx`:
- import: `import { configToZod, resolveLabel, type FormConfig } from '@rfjs/form-builder';`
- add `locale?: string;` to `ConfigFormProps` (with a brief doc line).
- destructure `locale = 'en'` in the component params.
- render the label resolved: `<Label htmlFor={field.key}>{resolveLabel(field.label, locale)}</Label>`.

- [ ] **Step 6: Run both suites + typecheck**

Run: `pnpm -F @rfjs/form-builder vitest:run` → all pass.
Run: `pnpm -F @rfjs/form-builder-ui vitest:run` → all pass (new locale tests + the existing string-label tests, which still work because a string label resolves to itself).
Run: `pnpm -F @rfjs/form-builder-ui check-types` → clean.

- [ ] **Step 7: Commit (single commit — type widening + consumer together)**

```bash
git add packages/form-builder/src packages/form-builder-ui/src
git commit -m "feat(form-builder): multilingual labels (LocalizedLabel + resolveLabel) and ConfigForm locale"
```

---

## Self-Review

**Spec coverage:** Phase 2 of the spec = engine `list-ops` (Task 1) ✓ + multilingual labels `LocalizedLabel`/`resolveLabel` + schema + `<ConfigForm>` resolution (Task 2) ✓. `<ConfigFormBuilder>`, `@dnd-kit`, and the web tool are Phase 3/4 — out of scope.

**Placeholder scan:** none — full code for every step.

**Type consistency:** `addField`/`removeField`/`updateField`/`moveField`, `LocalizedLabel`, `resolveLabel`, `locale` are consistent across the plan. `configToZod` untouched per constraint.

**Backward compatibility:** `label` widening is value-compatible (string still valid); existing string-label configs and the existing `<ConfigForm>` tests stay green (a string label resolves to itself). The breaking type change + its `<ConfigForm>` consumer are in the same commit (Task 2) so no intermediate state fails `turbo ... test --affected`.
