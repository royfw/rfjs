# Form Builder v2 Group 2 (structure: item-kinds + section/row arranger) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the config-driven form builder from a flat `fields[]` list to an **item-kind model** (`field`/`content`/`divider`/`spacer`/`ai-note`) arranged as **section → rows → items**, with a `@dnd-kit` row arranger — while keeping every v1 flat-`fields[]` config working unchanged.

**Architecture:** The engine (`@rfjs/form-builder`) gains an `items`/`row`/`section` model on `FormConfig.sections?`, alongside the still-supported v1 `FormConfig.fields?`. A single `normalizeToSections(config)` helper is the canonical read-path: it returns `config.sections` if present, else synthesizes one implicit section (one row per field) from `config.fields`. `configToZod` validates only `field` items (via `collectFieldItems`). The renderer walks normalized sections; the builder edits them via tree-ops + a `@dnd-kit` multi-container arranger. `conditional` (shipped in v2-C) applies per-item to `field` and `content`.

**Tech Stack:** TypeScript, zod v4, react-hook-form, `@rfjs/data-filter` (conditional, already wired), `@dnd-kit/core`+`/sortable`+`/utilities` (already deps), `@rfjs/web-ui` shadcn, vitest jsdom.

## Global Constraints

- **Backward compatible — non-negotiable.** Every existing v1 config (`{ version, fields:[…], columns? }`) must parse, validate (`configToZod`), and render identically. v1 configs are NOT mutated on parse; they are normalized only at read time.
- Engine builds to dist (`pnpm -F @rfjs/form-builder build`); UI exports source (consumed via Next `transpilePackages`). Run engine build before UI tests that import new engine exports.
- shadcn controls only in the builder (v2-A standard). Co-locate `*.spec` next to source. Conventional Commits; pre-commit (`turbo run lint-staged test --affected`) must pass. **No `--no-verify`. No changeset** (consistent with the rest of the form-builder effort).
- radix Select/`@dnd-kit` are not driveable in jsdom → extract decision logic into pure, exported, unit-tested helpers (mirror the `mergeValidation` / conditional-helper pattern from Group 1); component tests cover only driveable parts (Checkbox, Input, buttons) + trigger-value assertions.
- IDs: every item/row/section has a stable `id` (layout identity, used by dnd + tree-ops). A `field` item ALSO has `key` (the data-binding key used by RHF + `configToZod`). These are distinct concerns; do not conflate them.
- Item-kind semantics: `configToZod` produces data validation ONLY for `field` items. `content`/`divider`/`spacer`/`ai-note` carry no form data. `ai-note` is NEVER rendered to the form filler (config/export only).

---

## File Structure

Engine (`packages/form-builder/src/`):
- `types.ts` (modify) — add item/row/section types; extend `FormConfig`.
- `config-schema.ts` (modify) — zod for the item model + section/row; `parseFormConfig` accepts v1 and v2.
- `normalize.ts` (create) — `normalizeToSections`, `collectFieldItems`, `isFieldItem`.
- `config-to-zod.ts` (modify) — iterate `collectFieldItems(config)`.
- `tree-ops.ts` (create) — section/row/item ops + `makeItem`.
- `list-ops.ts` (keep) — v1 field ops unchanged (still exported, still tested).
- co-located `*.spec.ts` for each.

UI (`packages/form-builder-ui/src/`):
- `config-form.tsx` (modify) — render normalized sections → rows → items.
- `item-editor.tsx` (create) — per-kind property editor; reuses the existing field editor body.
- `field-row.tsx` (modify) — extract the field-editor body for reuse; add per-field `aiNote` sub-block.
- `section-arranger.tsx` (create) — `@dnd-kit` multi-container arranger.
- `arranger-logic.ts` (create) — pure drag-end → tree-op mapping (unit-tested).
- `config-form-builder.tsx` (modify) — palette gains item kinds; renders the arranger.
- `use-config-builder.ts` (modify) — add section/row/item ops.
- co-located `*.spec` for each.

---

## Engine type model (defined here once; tasks reference it)

```ts
// types.ts — added to existing FieldConfig/FormConfig
export type ItemKind = 'field' | 'content' | 'divider' | 'spacer' | 'ai-note';
export type SpacerSize = 'sm' | 'md' | 'lg';

export interface FieldItem extends FieldConfig {
  id: string;            // layout identity (dnd / tree-ops)
  kind: 'field';
  aiNote?: string;       // per-field AI note (not rendered to fillers)
}
export interface ContentItem {
  id: string;
  kind: 'content';
  text: LocalizedLabel;  // markdown-ish display text
  locked?: boolean;      // preset, not editable in builder
  conditional?: ConditionalRule;
}
export interface DividerItem { id: string; kind: 'divider'; conditional?: ConditionalRule; }
export interface SpacerItem { id: string; kind: 'spacer'; size?: SpacerSize; conditional?: ConditionalRule; }
export interface AiNoteItem { id: string; kind: 'ai-note'; text: string; }
export type FormItem = FieldItem | ContentItem | DividerItem | SpacerItem | AiNoteItem;

export interface FormRow { id: string; items: FormItem[]; }
export interface FormSection { id: string; title?: LocalizedLabel; rows: FormRow[]; columns?: 1 | 2 | 3 | 4; }

// FormConfig: v1 fields[] OR v2 sections[]; both optional, at least one present.
export interface FormConfig {
  version: number;
  fields?: FieldConfig[];          // v1 (back-compat)
  sections?: FormSection[];        // v2
  columns?: 1 | 2 | 3 | 4;         // v1 grid (back-compat)
}
```

> NOTE: `FormConfig.fields` becomes optional. Audit existing engine/UI code that reads `config.fields` directly (`list-ops.ts`, `use-config-builder.ts`, `config-form-builder.tsx`, `config-form.tsx`); those v1 paths must guard `config.fields ?? []` or go through `normalizeToSections`. Each task that touches such a file fixes its own reads.

---

### Task 1: Engine — item/row/section types + schema + parse (v1 & v2)

**Files:**
- Modify: `packages/form-builder/src/types.ts`
- Modify: `packages/form-builder/src/config-schema.ts`
- Test: `packages/form-builder/src/config-schema.spec.ts`

**Interfaces:**
- Produces: the types in "Engine type model" above; `parseFormConfig(input): FormConfig` now accepts both v1 (`fields`) and v2 (`sections`) shapes.

- [ ] **Step 1: Add the item model types** to `types.ts` exactly as in "Engine type model" above (keep existing `FieldConfig` unchanged; make `FormConfig.fields` optional; add `sections?`).

- [ ] **Step 2: Write failing schema tests** in `config-schema.spec.ts`:

```ts
import { parseFormConfig } from './config-schema';

it('parses a v1 flat fields[] config (back-compat)', () => {
  const cfg = { version: 1, fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string' }] };
  expect(parseFormConfig(cfg)).toEqual(cfg);
});

it('parses a v2 sections config with mixed item kinds', () => {
  const cfg = {
    version: 1,
    sections: [{
      id: 's1', rows: [
        { id: 'r1', items: [{ id: 'i1', kind: 'field', key: 'name', label: 'Name', component: 'Input', dataType: 'string' }] },
        { id: 'r2', items: [{ id: 'i2', kind: 'content', text: 'Hello' }, { id: 'i3', kind: 'divider' }] },
        { id: 'r3', items: [{ id: 'i4', kind: 'spacer', size: 'md' }, { id: 'i5', kind: 'ai-note', text: 'fill carefully' }] },
      ],
    }],
  };
  expect(parseFormConfig(cfg)).toEqual(cfg);
});

it('rejects an item with an unknown kind', () => {
  const cfg = { version: 1, sections: [{ id: 's1', rows: [{ id: 'r1', items: [{ id: 'i1', kind: 'nope' }] }] }] };
  expect(() => parseFormConfig(cfg)).toThrow();
});

it('rejects a config with neither fields nor sections', () => {
  expect(() => parseFormConfig({ version: 1 })).toThrow();
});
```

- [ ] **Step 3: Run** `pnpm -F @rfjs/form-builder vitest:run config-schema` — expect FAIL.

- [ ] **Step 4: Implement schema** in `config-schema.ts`. Reuse the existing `fieldConfigSchema`, `conditionalSchema`. Add:

```ts
const localizedLabelSchema = z.union([z.string(), z.record(z.string(), z.string())]);

const fieldItemSchema = fieldConfigSchema.extend({
  id: z.string().min(1),
  kind: z.literal('field'),
  aiNote: z.string().optional(),
});
const contentItemSchema = z.object({
  id: z.string().min(1), kind: z.literal('content'),
  text: localizedLabelSchema, locked: z.boolean().optional(), conditional: conditionalSchema.optional(),
});
const dividerItemSchema = z.object({ id: z.string().min(1), kind: z.literal('divider'), conditional: conditionalSchema.optional() });
const spacerItemSchema = z.object({ id: z.string().min(1), kind: z.literal('spacer'), size: z.enum(['sm','md','lg']).optional(), conditional: conditionalSchema.optional() });
const aiNoteItemSchema = z.object({ id: z.string().min(1), kind: z.literal('ai-note'), text: z.string() });

const formItemSchema = z.discriminatedUnion('kind', [
  fieldItemSchema, contentItemSchema, dividerItemSchema, spacerItemSchema, aiNoteItemSchema,
]);
const formRowSchema = z.object({ id: z.string().min(1), items: z.array(formItemSchema) });
const formSectionSchema = z.object({
  id: z.string().min(1), title: localizedLabelSchema.optional(),
  rows: z.array(formRowSchema), columns: z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4)]).optional(),
});

export const FormConfigSchema: ZodType<FormConfig> = z.object({
  version: z.number().int(),
  fields: z.array(fieldConfigSchema).optional(),
  sections: z.array(formSectionSchema).optional(),
  columns: z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4)]).optional(),
}).refine((c) => c.fields !== undefined || c.sections !== undefined, 'config must have fields or sections');
```

> `fieldConfigSchema` is currently `z.object({...})` — `.extend` works. If it isn't a `ZodObject`, refactor it to one. Keep `fieldConfigSchema` exported usage intact for the v1 `fields` path.

- [ ] **Step 5: Run** the schema tests — expect PASS. Run the full engine suite to confirm no regression: `pnpm -F @rfjs/form-builder vitest:run`.

- [ ] **Step 6: Build + commit**

```bash
pnpm -F @rfjs/form-builder build
git add packages/form-builder/src/types.ts packages/form-builder/src/config-schema.ts packages/form-builder/src/config-schema.spec.ts
git commit -m "feat(form-builder): add item-kind/section/row model + schema (v1+v2 parse)"
```

---

### Task 2: Engine — `normalizeToSections` + `collectFieldItems`

**Files:**
- Create: `packages/form-builder/src/normalize.ts`
- Test: `packages/form-builder/src/normalize.spec.ts`
- Modify: `packages/form-builder/src/index.ts` (export `./normalize`)

**Interfaces:**
- Produces:
  - `isFieldItem(item: FormItem): item is FieldItem`
  - `normalizeToSections(config: FormConfig): FormSection[]` — `config.sections` if present; else ONE section `{ id: 'section-default', rows: config.fields.map(f => ({ id: 'row-'+f.key, items: [fieldConfigToItem(f)] })), columns: config.columns }`. Empty/absent fields → `[{ id:'section-default', rows: [] }]`.
  - `fieldConfigToItem(f: FieldConfig): FieldItem` — `{ ...f, id: f.key, kind: 'field' }`.
  - `collectFieldItems(config: FormConfig): FieldItem[]` — all `field` items across normalized sections→rows, in order.

- [ ] **Step 1: Write failing tests** in `normalize.spec.ts`:

```ts
import { normalizeToSections, collectFieldItems, isFieldItem } from './normalize';

const v1 = { version: 1, fields: [
  { key: 'name', label: 'Name', component: 'Input', dataType: 'string' },
  { key: 'age', label: 'Age', component: 'Input', dataType: 'numeric' },
], columns: 2 };

it('normalizes v1 fields[] to one section, one row per field, kind=field', () => {
  const secs = normalizeToSections(v1 as any);
  expect(secs).toHaveLength(1);
  expect(secs[0].columns).toBe(2);
  expect(secs[0].rows.map(r => r.items.map(i => (i as any).key))).toEqual([['name'], ['age']]);
  expect(secs[0].rows[0].items[0]).toMatchObject({ kind: 'field', id: 'name', key: 'name' });
});

it('returns sections as-is for a v2 config', () => {
  const v2 = { version: 1, sections: [{ id: 's1', rows: [] }] };
  expect(normalizeToSections(v2 as any)).toBe(v2.sections);
});

it('collectFieldItems returns only field items, in order', () => {
  const v2 = { version: 1, sections: [{ id: 's1', rows: [
    { id: 'r1', items: [{ id: 'a', kind: 'field', key: 'a', label: 'A', component: 'Input', dataType: 'string' }, { id: 'd', kind: 'divider' }] },
    { id: 'r2', items: [{ id: 'c', kind: 'content', text: 'hi' }, { id: 'b', kind: 'field', key: 'b', label: 'B', component: 'Input', dataType: 'string' }] },
  ] }] };
  expect(collectFieldItems(v2 as any).map(f => f.key)).toEqual(['a', 'b']);
});

it('isFieldItem narrows by kind', () => {
  expect(isFieldItem({ id: 'x', kind: 'field', key: 'x', label: '', component: 'Input', dataType: 'string' } as any)).toBe(true);
  expect(isFieldItem({ id: 'x', kind: 'divider' } as any)).toBe(false);
});
```

- [ ] **Step 2: Run** `pnpm -F @rfjs/form-builder vitest:run normalize` — expect FAIL.

- [ ] **Step 3: Implement `normalize.ts`** with the four exports above. `collectFieldItems` = `normalizeToSections(config).flatMap(s => s.rows).flatMap(r => r.items).filter(isFieldItem)`.

- [ ] **Step 4: Run** the tests — expect PASS.

- [ ] **Step 5: Export + commit**: add `export * from './normalize';` to `index.ts`.

```bash
pnpm -F @rfjs/form-builder build
git add packages/form-builder/src/normalize.ts packages/form-builder/src/normalize.spec.ts packages/form-builder/src/index.ts
git commit -m "feat(form-builder): normalizeToSections + collectFieldItems (v1/v2 read-path)"
```

---

### Task 3: Engine — `configToZod` over field items (both shapes)

**Files:**
- Modify: `packages/form-builder/src/config-to-zod.ts`
- Test: `packages/form-builder/src/config-to-zod.spec.ts`

**Interfaces:**
- Consumes: `collectFieldItems` (Task 2).
- Produces: `configToZod(config)` unchanged signature; now derives its field list from `collectFieldItems(config)` so v1 and v2 both work; only `field` items contribute.

- [ ] **Step 1: Write failing tests** appended to `config-to-zod.spec.ts`:

```ts
it('builds the schema from a v2 sections config (field items only)', () => {
  const cfg = { version: 1, sections: [{ id: 's1', rows: [
    { id: 'r1', items: [{ id: 'name', kind: 'field', key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true }] },
    { id: 'r2', items: [{ id: 'c', kind: 'content', text: 'note' }, { id: 'd', kind: 'divider' }] },
  ] }] };
  const schema = configToZod(cfg as any);
  expect(schema.safeParse({ name: 'x' }).success).toBe(true);
  expect(schema.safeParse({}).success).toBe(false);          // required name
  expect(Object.keys(schema.shape)).toEqual(['name']);        // content/divider produce no keys
});

it('still builds the schema from a v1 fields[] config (back-compat)', () => {
  const cfg = { version: 1, fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true }] };
  expect(configToZod(cfg as any).safeParse({ name: 'a' }).success).toBe(true);
});
```

- [ ] **Step 2: Run** `pnpm -F @rfjs/form-builder vitest:run config-to-zod` — expect FAIL (v2 case).

- [ ] **Step 3: Implement** — in `config-to-zod.ts`, replace the loop `for (const field of config.fields)` with `for (const field of collectFieldItems(config))`. `fieldSchema` already takes a `FieldConfig`; a `FieldItem` is a `FieldConfig` plus `id`/`kind`/`aiNote`, so it is structurally compatible — pass it through unchanged. Import `collectFieldItems` from `./normalize`.

- [ ] **Step 4: Run** the full engine suite — expect PASS (all existing validation tests + new ones).

- [ ] **Step 5: Build + commit**

```bash
pnpm -F @rfjs/form-builder build
git add packages/form-builder/src/config-to-zod.ts packages/form-builder/src/config-to-zod.spec.ts
git commit -m "feat(form-builder): configToZod over field items (v1 fields + v2 sections)"
```

---

### Task 4: Engine — section/row/item tree-ops + `makeItem`

**Files:**
- Create: `packages/form-builder/src/tree-ops.ts`
- Test: `packages/form-builder/src/tree-ops.spec.ts`
- Modify: `packages/form-builder/src/index.ts` (export `./tree-ops`)

**Interfaces (all operate on a `FormConfig` carrying `sections`; if given a v1 config, FIRST normalize it to a `sections` config via `normalizeToSections`, then operate, returning a `sections`-shaped config):**
- Produces:
  - `makeItem(kind: ItemKind, seed?: Partial<FieldItem>): FormItem` — fresh `id`; for `field`, default `{ key: 'field_N', label: 'Field', component: 'Input', dataType: 'string' }` (reuse the existing `makeField` counter idea; ids via a module counter — NO `Math.random` needed for ids, use a counter prefixed string).
  - `addItem(config, sectionId, rowId, item, index?): FormConfig`
  - `removeItem(config, itemId): FormConfig` — also removes a row that becomes empty.
  - `updateItem(config, itemId, patch): FormConfig`
  - `moveItemWithinRow(config, rowId, from, to): FormConfig`
  - `moveItemToRow(config, itemId, targetRowId, index?): FormConfig` — removes from old row (drop empty row), inserts into target.
  - `addRow(config, sectionId, index?): FormRow id` … return the new `FormConfig` (new row appended/inserted, empty).
  - `splitToNewRow(config, itemId, sectionId, index?): FormConfig` — move an item into a brand-new row at `index` (used by "drop between rows").
  - `addSection(config, index?): FormConfig`
  - `setSectionColumns(config, sectionId, columns): FormConfig`

- [ ] **Step 1: Write failing tests** in `tree-ops.spec.ts` covering each op. Example core cases:

```ts
import { makeItem, addItem, removeItem, updateItem, moveItemWithinRow, moveItemToRow, splitToNewRow, addSection } from './tree-ops';
import { normalizeToSections } from './normalize';

const base = () => ({ version: 1, sections: [{ id: 's1', rows: [
  { id: 'r1', items: [
    { id: 'a', kind: 'field', key: 'a', label: 'A', component: 'Input', dataType: 'string' },
    { id: 'b', kind: 'field', key: 'b', label: 'B', component: 'Input', dataType: 'string' },
  ] },
] }] } as any);

it('makeItem(field) creates a field item with a unique id + key', () => {
  const a = makeItem('field'); const b = makeItem('field');
  expect(a.kind).toBe('field'); expect(a.id).not.toBe(b.id);
});
it('makeItem(divider) has kind divider and no key', () => {
  expect(makeItem('divider')).toMatchObject({ kind: 'divider' });
});
it('addItem appends to a row', () => {
  const c = addItem(base(), 's1', 'r1', makeItem('divider'));
  expect(c.sections![0].rows[0].items).toHaveLength(3);
});
it('removeItem drops the item and any now-empty row', () => {
  const c = removeItem(base(), 'a');
  expect(c.sections![0].rows[0].items.map((i:any)=>i.id)).toEqual(['b']);
});
it('moveItemWithinRow reorders', () => {
  const c = moveItemWithinRow(base(), 'r1', 0, 1);
  expect(c.sections![0].rows[0].items.map((i:any)=>i.id)).toEqual(['b','a']);
});
it('splitToNewRow moves an item into a new row, leaving the source non-empty', () => {
  const c = splitToNewRow(base(), 'b', 's1', 1);
  expect(c.sections![0].rows.map(r=>r.items.map((i:any)=>i.id))).toEqual([['a'],['b']]);
});
it('normalizes a v1 config before operating', () => {
  const v1 = { version: 1, fields: [{ key:'x', label:'X', component:'Input', dataType:'string' }] } as any;
  const c = addSection(v1);
  expect(c.sections).toHaveLength(2);   // implicit section + new one
  expect(c.fields).toBeUndefined();      // result is sections-shaped
});
```

(Write a test for every exported op — `updateItem`, `moveItemToRow`, `addRow`, `setSectionColumns` — following the same pattern.)

- [ ] **Step 2: Run** `pnpm -F @rfjs/form-builder vitest:run tree-ops` — expect FAIL.

- [ ] **Step 3: Implement `tree-ops.ts`.** Each op starts: `const sections = normalizeToSections(config); ` then returns `{ version: config.version, sections: <new sections> }` (drop `fields`/`columns` from the v1 shape — the canonical edited shape is `sections`). Use immutable maps. `id` counter: `let idc = 0; const nextId = (p) => \`${p}_${(idc += 1)}\`;` (deterministic-enough; the engine has no random constraint, but avoid `Math.random` per repo rule).

- [ ] **Step 4: Run** tree-ops tests — expect PASS; full engine suite green.

- [ ] **Step 5: Export + build + commit**

```bash
pnpm -F @rfjs/form-builder build
git add packages/form-builder/src/tree-ops.ts packages/form-builder/src/tree-ops.spec.ts packages/form-builder/src/index.ts
git commit -m "feat(form-builder): section/row/item tree-ops + makeItem"
```

---

### Task 5: Renderer — `<ConfigForm>` renders normalized sections → rows → items

**Files:**
- Modify: `packages/form-builder-ui/src/config-form.tsx`
- Test: `packages/form-builder-ui/src/config-form.spec.tsx`

**Interfaces:**
- Consumes: `normalizeToSections`, `collectFieldItems`, `evaluateConditional`, `resolveLabel`, `isFieldItem`.
- The stable resolver from v2-C stays; it already builds over `collectFieldItems(config)` once Task 3 lands — confirm it reads field items (update the resolver's `cfg.fields.filter(...)` to `collectFieldItems(cfg)` filtered by conditional).

- [ ] **Step 1: Write failing tests** in `config-form.spec.tsx`:

```ts
it('renders a v2 sections config: field control + content + divider; ai-note absent', () => {
  const cfg = { version: 1, sections: [{ id: 's1', title: 'Profile', rows: [
    { id: 'r1', items: [{ id: 'name', kind: 'field', key: 'name', label: 'Name', component: 'Input', dataType: 'string' }] },
    { id: 'r2', items: [{ id: 'c', kind: 'content', text: 'Please fill in' }, { id: 'div', kind: 'divider' }] },
    { id: 'r3', items: [{ id: 'note', kind: 'ai-note', text: 'internal' }] },
  ] }] };
  render(<ConfigForm config={cfg as any} onSubmit={() => {}} />);
  expect(screen.getByLabelText('Name')).toBeInTheDocument();
  expect(screen.getByText('Please fill in')).toBeInTheDocument();
  expect(screen.queryByText('internal')).not.toBeInTheDocument();   // ai-note never rendered
});

it('hides a content item whose conditional is false', () => {
  const cfg = { version: 1, sections: [{ id: 's1', rows: [
    { id: 'r1', items: [{ id: 'role', kind: 'field', key: 'role', label: 'Role', component: 'Input', dataType: 'string' }] },
    { id: 'r2', items: [{ id: 'c', kind: 'content', text: 'admin only', conditional: { logic:'and', filters:[{ field:'role', dataType:'string', operator:'eq', value:'admin' }] } }] },
  ] }] };
  render(<ConfigForm config={cfg as any} onSubmit={() => {}} />);
  expect(screen.queryByText('admin only')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'admin' } });
  expect(screen.getByText('admin only')).toBeInTheDocument();
});

it('still renders a v1 fields[] config unchanged (back-compat)', () => {
  const cfg = { version: 1, fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string' }] };
  render(<ConfigForm config={cfg as any} onSubmit={() => {}} />);
  expect(screen.getByLabelText('Name')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run** `pnpm -F @rfjs/form-builder build && pnpm -F @rfjs/form-builder-ui vitest:run config-form` — expect FAIL.

- [ ] **Step 3: Implement.** Replace the `config.fields.map(...)` body with: `normalizeToSections(config).map(section => …)` → for each section render an optional title + its rows; each row is a flex container (`flex flex-wrap gap-4`, items share width via `data-width`/grid as today); each item renders by kind:
  - `field` → existing Label + Controller + FieldControl + error `<p>` (the current per-field markup), gated by `evaluateConditional(item.conditional, values)`.
  - `content` → `<div className="text-sm">{resolveLabel(item.text, locale)}</div>`, gated by conditional.
  - `divider` → `<hr className="col-span-full border-input" />`, gated by conditional.
  - `spacer` → `<div style={{ height: { sm: 8, md: 16, lg: 32 }[item.size ?? 'md'] }} />`, gated by conditional.
  - `ai-note` → render `null`.
  Update the show/hide + visible-field logic and the submit-payload strip to use `collectFieldItems` filtered by `evaluateConditional` instead of `config.fields`. Keep the stable-resolver, `watch()`, reactive `reset` from v2-C.

- [ ] **Step 4: Run** the UI suite — expect PASS (new + all existing, incl. v2-C conditional + validation tests). `check-types` clean.

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder-ui/src/config-form.tsx packages/form-builder-ui/src/config-form.spec.tsx
git commit -m "feat(form-builder-ui): render sections/rows/item-kinds in ConfigForm"
```

---

### Task 6: Builder — per-kind item editor + per-field `aiNote`

**Files:**
- Modify: `packages/form-builder-ui/src/field-row.tsx` (extract the field-editor body; add `aiNote` sub-block)
- Create: `packages/form-builder-ui/src/item-editor.tsx`
- Test: `packages/form-builder-ui/src/field-row.spec.tsx`, `packages/form-builder-ui/src/item-editor.spec.tsx`

**Interfaces:**
- Produces: `ItemEditor({ item, siblingFields, locales, onUpdate, onRemove })` — switches on `item.kind`:
  - `field` → the existing FieldRow editor body (rename the reusable inner to `FieldItemEditor`; `FieldRow` stays as the field-kind wrapper) + a new **AI note** `<Input>`/`<Textarea>` sub-block bound to `item.aiNote` via `onUpdate({ aiNote })`.
  - `content` → per-locale text inputs (reuse the locale-label pattern) + `locked` Checkbox (disabled inputs when `locked`).
  - `spacer` → size `Select` (sm/md/lg).
  - `ai-note` → a `Textarea` for `text`.
  - `divider` → a static "Divider — no properties" line.

- [ ] **Step 1: Write failing tests** in `item-editor.spec.tsx` (driveable parts only): editing a content item's text Input calls `onUpdate({ text … })`; toggling a spacer size (trigger-value assertion); editing an ai-note Textarea calls `onUpdate({ text })`; a field item's AI-note input calls `onUpdate({ aiNote })`. Plus a FieldRow test that the new aiNote input is present for field items.

- [ ] **Step 2: Run** `pnpm -F @rfjs/form-builder build && pnpm -F @rfjs/form-builder-ui vitest:run item-editor field-row` — expect FAIL.

- [ ] **Step 3: Implement.** Extract the current expanded field editor body from `FieldRow` into a reusable component; add the `aiNote` sub-block. Create `item-editor.tsx` dispatching on kind. Keep `FieldRow`'s drag handle/header shell for use inside the arranger (Task 7), or fold the header into `ItemEditor` — implementer's call, but `ItemEditor` must render a removable, editable card per kind.

- [ ] **Step 4: Run** UI suite — expect PASS (existing FieldRow validation/conditional tests still green). `check-types` clean.

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder-ui/src/field-row.tsx packages/form-builder-ui/src/item-editor.tsx packages/form-builder-ui/src/*.spec.tsx
git commit -m "feat(form-builder-ui): per-kind item editor + per-field aiNote"
```

---

### Task 7: Builder — `@dnd-kit` section/row arranger + builder wiring

**Files:**
- Create: `packages/form-builder-ui/src/arranger-logic.ts` (pure drag-end → tree-op mapping)
- Create: `packages/form-builder-ui/src/section-arranger.tsx`
- Modify: `packages/form-builder-ui/src/use-config-builder.ts` (section/row/item ops)
- Modify: `packages/form-builder-ui/src/config-form-builder.tsx` (palette item kinds + render arranger)
- Test: `packages/form-builder-ui/src/arranger-logic.spec.ts`, `config-form-builder.spec.tsx`, `use-config-builder.spec.ts`

**Interfaces:**
- Consumes: tree-ops (Task 4), `ItemEditor` (Task 6), `normalizeToSections` (Task 2).
- `use-config-builder.ts` gains: `addItem(sectionId, rowId, item, index?)`, `removeItem(itemId)`, `updateItem(itemId, patch)`, `moveItemWithinRow(rowId, from, to)`, `moveItemToRow(itemId, targetRowId, index?)`, `splitToNewRow(itemId, sectionId, index?)`, `addSection()`, `setSectionColumns(sectionId, columns)` — each wrapping the engine tree-op via `apply`. Keep the v1 field ops for back-compat.
- `arranger-logic.ts`: `resolveDragEnd(config, active, over): FormConfig` — pure function mapping a `@dnd-kit` drag-end (active id, over id / over-zone id) to the right tree-op. Drop targets encode intent in their id: `row:<rowId>` (append/reorder within row), `newrow:<sectionId>:<index>` (split to new row at index). This is the UNIT-TESTED core.

- [ ] **Step 1: Write failing tests** in `arranger-logic.spec.ts` for `resolveDragEnd`: dropping item `b` over item `a` in the same row reorders; dropping item `b` onto `newrow:s1:1` splits it into a new row at index 1; dropping onto another row's zone moves it. Use plain config objects (no DOM). Also `use-config-builder.spec.ts` tests for the new ops (call op → `config` reflects the tree-op result).

- [ ] **Step 2: Run** `pnpm -F @rfjs/form-builder build && pnpm -F @rfjs/form-builder-ui vitest:run arranger-logic use-config-builder` — expect FAIL.

- [ ] **Step 3: Implement `arranger-logic.ts`** (pure, mapping to tree-ops) and the `use-config-builder` ops (thin wrappers over engine tree-ops via `apply(configRef.current)`).

- [ ] **Step 4: Implement `section-arranger.tsx`** with `@dnd-kit`: `DndContext` + nested `SortableContext` per row (items) + droppable "new row" zones between rows. Each item card = `ItemEditor`. `onDragEnd` calls `builder.replace(resolveDragEnd(builder.config, active.id, over.id))`. Wire into `config-form-builder.tsx`: palette buttons now add item kinds (`makeItem(kind)` into the first/last row or a new row), render `<SectionArranger>` instead of the flat `FieldRow` list, keep the JSON tab + preview (preview already handles sections via Task 5). Guard all `builder.config.fields` reads with `normalizeToSections`.

- [ ] **Step 5: Write component tests** for the driveable parts in `config-form-builder.spec.tsx`: palette "+ Content"/"+ Divider"/"+ Field" add the item (assert it appears / `onChange` called with a sections config); existing builder tests adapted to the sections shape. dnd drag itself is NOT driven in jsdom — `resolveDragEnd` (Step 1) covers that logic.

- [ ] **Step 6: Run** full UI suite — expect PASS; `check-types` clean.

- [ ] **Step 7: Commit**

```bash
git add packages/form-builder-ui/src/arranger-logic.ts packages/form-builder-ui/src/section-arranger.tsx packages/form-builder-ui/src/use-config-builder.ts packages/form-builder-ui/src/config-form-builder.tsx packages/form-builder-ui/src/*.spec.*
git commit -m "feat(form-builder-ui): dnd-kit section/row arranger + builder item-kind palette"
```

---

## Self-Review

**Spec coverage (§3, §6, §4.4):**
- §3 item-kind model (field/content/divider/spacer/ai-note) → Tasks 1 (types/schema), 5 (render), 6 (edit).
- §3 section→rows→items nesting + back-compat (v1 flat = implicit section) → Tasks 1, 2 (normalize), 4 (tree-ops), 5/7 (render/edit).
- §3 `configToZod` only validates `field` → Task 3.
- §3 conditional applies to field + content → Task 5 (render gating), model in Task 1.
- §6 row arranger (drag within/between rows, new-row on drop; @dnd-kit multi-container; per-section columns) → Tasks 4 (ops), 7 (arranger).
- §4.4 content (markdown text, locked, conditional, dataSource-display) → Tasks 1/5/6 (dataSource is Group 3 / v2-G — NOT here; content's `dataSource` field is out of scope, omitted).
- §4.4 divider/spacer → Tasks 1/5/6.
- §4.4 ai-note block + per-field aiNote → Tasks 1 (model), 5 (never-render), 6 (editor + per-field sub-block).

**Out of scope (later groups):** more field types + DatePicker (v2-E), external dataSource (v2-G), free 2D canvas, registry distribution. `content.dataSource` display deferred to v2-G.

**Placeholder scan:** engine tasks (1-4) have concrete types/schema/test code. Renderer (5) has concrete per-kind render. Editor (6) and arranger (7) specify exact interfaces, the pure `resolveDragEnd` contract, and the drop-zone id encoding; the @dnd-kit JSX wiring is described structurally (the testable logic is extracted to `arranger-logic.ts`). No open TODOs.

**Type consistency:** `FormItem`/`FormRow`/`FormSection`/`FieldItem` names are used identically across tasks. `normalizeToSections`/`collectFieldItems`/`isFieldItem` (Task 2) consumed by Tasks 3/5/7. tree-ops names (Task 4) consumed by `use-config-builder` (Task 7). Drop-zone id encoding (`row:<id>`, `newrow:<sectionId>:<index>`) defined in Task 7 and used only there.

**Risk notes:** (1) back-compat — every `config.fields` direct read must be guarded/normalized (called out per task). (2) `fieldConfigSchema.extend` requires it be a `ZodObject` (it is). (3) @dnd-kit untestable in jsdom → all decision logic in pure `resolveDragEnd`. (4) `FieldItem extends FieldConfig` keeps validation/conditional working untouched. (5) tree-ops canonicalize to `sections` shape (drop v1 `fields`) on first edit — intended.
