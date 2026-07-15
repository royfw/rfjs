# ConfigFormBuilder — Phase 1 (grid basics) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add grid layout to the config-driven form — per-field `width` and form-level `columns` in `@rfjs/form-builder`, and CSS-grid rendering with RWD in `@rfjs/form-builder-ui`'s `<ConfigForm>`.

**Architecture:** Extend the existing (merged) P1 packages. `width`/`columns` are display-only — `configToZod` is untouched. Backward-compatible: default `width:'full'` + `columns:1` reproduces today's single-column form.

**Tech Stack:** TypeScript, zod v4, React 19, Tailwind (via web-ui), vitest (node + jsdom), @testing-library/react.

## Global Constraints

- `@rfjs/form-builder` builds to `dist/` via tsdown; `@rfjs/form-builder-ui` exports `src/` (consumed via transpilePackages). zod is v4 (`^4.0.0`).
- Data-type vocabulary stays aligned with `@rfjs/filter-builder`.
- `configToZod` behaviour MUST NOT change (width/columns are layout-only).
- `width` values: `'full' | 'half'`; default (absent) = `'full'`. `columns` values: `1 | 2 | 3 | 4`; default (absent) = `1`.
- A `'full'` field spans all columns (`grid-column: 1 / -1`); `'half'` occupies one grid cell.
- Co-locate `*.spec.ts(x)`. Conventional Commits; pre-commit hook must pass (no `--no-verify` for code). The fresh worktree needs `pnpm install` (Task 1).

---

### Task 1: Engine — `width` + `columns` types and schema

**Files:**
- Modify: `packages/form-builder/src/types.ts`
- Modify: `packages/form-builder/src/config-schema.ts`
- Test: `packages/form-builder/src/config-schema.spec.ts` (add cases)

**Interfaces produced:**
- `type FieldWidth = 'full' | 'half'`; `FieldConfig.width?: FieldWidth`
- `FormConfig.columns?: 1 | 2 | 3 | 4`
- `FormConfigSchema` validates both.

- [ ] **Step 1: Install deps in the worktree**

Run: `pnpm install` (repo root — fresh worktree). Then build the engine so downstream typechecks see new types later: `pnpm -F @rfjs/form-builder build`.

- [ ] **Step 2: Write the failing tests**

Append to `packages/form-builder/src/config-schema.spec.ts`:
```ts
describe('grid layout fields', () => {
  it('accepts columns and per-field width', () => {
    const cfg = {
      version: 1,
      columns: 2,
      fields: [
        { key: 'name', label: 'Name', component: 'Input', dataType: 'string', width: 'half' },
        { key: 'bio', label: 'Bio', component: 'Textarea', dataType: 'string', width: 'full' },
      ],
    };
    expect(parseFormConfig(cfg)).toEqual(cfg);
  });

  it('rejects an out-of-range columns value', () => {
    expect(FormConfigSchema.safeParse({ version: 1, columns: 5, fields: [] }).success).toBe(false);
  });

  it('rejects an unknown width value', () => {
    const bad = { version: 1, fields: [{ key: 'x', label: 'X', component: 'Input', dataType: 'string', width: 'wide' }] };
    expect(FormConfigSchema.safeParse(bad).success).toBe(false);
  });

  it('still accepts a config without columns/width (backward compatible)', () => {
    expect(FormConfigSchema.safeParse({ version: 1, fields: [{ key: 'a', label: 'A', component: 'Input', dataType: 'string' }] }).success).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests — verify the new ones fail**

Run: `pnpm -F @rfjs/form-builder vitest:run`
Expected: the two reject-tests FAIL (schema currently allows extra keys? no — zod objects strip unknown keys by default, so `columns:5`/`width:'wide'` are stripped and parse succeeds → the `.success === false` assertions fail). This confirms the schema needs the new fields.

- [ ] **Step 4: Add the types**

In `packages/form-builder/src/types.ts`, add the width type and fields:
```ts
export type FieldWidth = 'full' | 'half';
```
Add `width?: FieldWidth;` to `FieldConfig` (after `options?`):
```ts
export interface FieldConfig {
  key: string;
  label: string;
  component: FieldComponent;
  dataType: FieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: FieldOption[];
  width?: FieldWidth;
}
```
Add `columns?: 1 | 2 | 3 | 4;` to `FormConfig`:
```ts
export interface FormConfig {
  version: number;
  fields: FieldConfig[];
  columns?: 1 | 2 | 3 | 4;
}
```

- [ ] **Step 5: Update the schema**

In `packages/form-builder/src/config-schema.ts`:
- add to `fieldConfigSchema` (after `options`): `width: z.enum(['full', 'half']).optional(),`
- add to `FormConfigSchema`'s object: `columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),`

The `ZodType<FormConfig>` annotation must still hold — `z.literal` union output `1|2|3|4` and `z.enum(['full','half'])` output `'full'|'half'` match the TS types. If TS complains, run `pnpm -F @rfjs/form-builder typecheck` and reconcile (do not loosen the TS types).

- [ ] **Step 6: Run tests + typecheck + build**

Run: `pnpm -F @rfjs/form-builder vitest:run` → all pass (existing + 4 new).
Run: `pnpm -F @rfjs/form-builder typecheck` → clean.
Run: `pnpm -F @rfjs/form-builder build` → dist re-emitted (so `@rfjs/form-builder-ui` sees the new types in Task 2).

- [ ] **Step 7: Commit**

```bash
git add packages/form-builder/src
git commit -m "feat(form-builder): add per-field width and form columns to config"
```

---

### Task 2: `<ConfigForm>` — CSS-grid rendering with RWD

**Files:**
- Modify: `packages/form-builder-ui/src/config-form.tsx`
- Test: `packages/form-builder-ui/src/config-form.spec.tsx` (add cases; keep existing passing)

**Interfaces consumed:** `FieldConfig.width`, `FormConfig.columns` from `@rfjs/form-builder` (Task 1).

- [ ] **Step 1: Write the failing tests**

Append to `packages/form-builder-ui/src/config-form.spec.tsx`:
```tsx
describe('grid layout', () => {
  const gridConfig: FormConfig = {
    version: 1,
    columns: 2,
    fields: [
      { key: 'name', label: 'Name', component: 'Input', dataType: 'string', width: 'half' },
      { key: 'bio', label: 'Bio', component: 'Textarea', dataType: 'string', width: 'full' },
    ],
  };

  it('sets the form column count from config.columns', () => {
    const { container } = render(<ConfigForm config={gridConfig} onSubmit={() => {}} />);
    const form = container.querySelector('form')!;
    expect(form.getAttribute('data-columns')).toBe('2');
    expect(form.style.getPropertyValue('--form-cols')).toBe('2');
  });

  it('spans full-width fields across all columns and leaves half fields in one cell', () => {
    const { container } = render(<ConfigForm config={gridConfig} onSubmit={() => {}} />);
    const half = container.querySelector('[data-width="half"]') as HTMLElement;
    const full = container.querySelector('[data-width="full"]') as HTMLElement;
    expect(half.style.gridColumn).toBe('');
    expect(full.style.gridColumn).toBe('1 / -1');
  });

  it('defaults to a single column when config.columns is absent', () => {
    const cfg: FormConfig = { version: 1, fields: [{ key: 'a', label: 'A', component: 'Input', dataType: 'string' }] };
    const { container } = render(<ConfigForm config={cfg} onSubmit={() => {}} />);
    expect(container.querySelector('form')!.getAttribute('data-columns')).toBe('1');
    // a field with no explicit width defaults to full → spans the single column
    expect((container.querySelector('[data-width="full"]') as HTMLElement).style.gridColumn).toBe('1 / -1');
  });
});
```

- [ ] **Step 2: Run tests — verify the new ones fail**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run`
Expected: FAIL — `data-columns` / `--form-cols` / `data-width` not present yet.

- [ ] **Step 3: Update `<ConfigForm>`**

Replace the `return (...)` block in `packages/form-builder-ui/src/config-form.tsx` with the grid version (compute `columns`, grid class + CSS var, per-field span, full-spanning submit row):
```tsx
  const columns = config.columns ?? 1;

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values as Record<string, unknown>))}
      className="grid grid-cols-1 gap-4 md:[grid-template-columns:repeat(var(--form-cols),minmax(0,1fr))]"
      style={{ '--form-cols': columns } as React.CSSProperties}
      data-columns={columns}
    >
      {config.fields.map((field) => {
        const width = field.width ?? 'full';
        return (
          <div
            key={field.key}
            className="flex flex-col gap-1.5"
            data-width={width}
            style={width === 'full' ? { gridColumn: '1 / -1' } : undefined}
          >
            <Label htmlFor={field.key}>{field.label}</Label>
            <Controller
              control={control}
              name={field.key}
              render={({ field: rhf }) => (
                <FieldControl field={field} value={rhf.value} onChange={rhf.onChange} />
              )}
            />
          </div>
        );
      })}
      <div style={{ gridColumn: '1 / -1' }}>
        <Button type="submit" className="self-start">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
```
(Rationale: base `grid-cols-1` = mobile single column / RWD; `md:` arbitrary property uses the `--form-cols` var so the explicit column count applies only at ≥ md. `data-columns`/`data-width` make the layout assertable in jsdom, which doesn't compute grid geometry.)

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run` → all pass (the 3 existing config-form tests + the 3 new grid tests + field-control tests).
Run: `pnpm -F @rfjs/form-builder-ui check-types` → clean.

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder-ui/src
git commit -m "feat(form-builder-ui): render ConfigForm as a responsive grid"
```

---

## Self-Review

**Spec coverage:** Phase 1 of the spec = grid basics: engine `width`/`columns` + schema (Task 1) ✓; `<ConfigForm>` CSS-grid + RWD (Task 2) ✓. Multilingual labels, list-ops, `<ConfigFormBuilder>`, the web tool, and drag (`@dnd-kit`) are later phases — out of scope here.

**Placeholder scan:** none — exact code given for every change.

**Type consistency:** `FieldWidth`/`width`/`columns` names match across types, schema, and the component. `data-columns`/`data-width`/`--form-cols` are consistent between the component (Task 2 Step 3) and the tests (Task 2 Step 1). `configToZod` is untouched, as the constraint requires.

**Backward compatibility:** a config without `columns`/`width` → `data-columns="1"`, fields default to `'full'` spanning the single column — identical to today's single-column form. The 3 existing config-form tests and all config-schema tests must remain green (verified in Task 2 Step 4 / Task 1 Step 6).
