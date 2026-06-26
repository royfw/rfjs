# ConfigFormBuilder — Phase 3b (collapsible field editor) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make `<ConfigFormBuilder>` fully edit each field — harden the state hook, then turn `FieldRow` into a **collapsible property editor** (type / label / width / required) with a **Select options editor**.

**Architecture:** Builds on merged P3a (`useConfigBuilder` + `FieldRow` + `<ConfigFormBuilder>`). Editor *chrome* (type/width pickers) uses native `<select>` (fully testable in jsdom; the rendered form still uses web-ui's radix Select via `FieldControl` — unchanged). `key` editing, columns UI, JSON round-trip, and per-locale label editing are **P3c** (out of scope).

**Tech Stack:** React 19, @dnd-kit, @rfjs/web-ui, vitest jsdom, @testing-library/react.

## Global Constraints

- Use the engine's pure `list-ops` via the hook — never reimplement field mutation.
- Changing a field's component must remap `dataType` (`DATATYPE_BY_COMPONENT`) and `options` (`Select`→keep/empty array, else `undefined`).
- Native `<select>` for the type/width editor controls (testable); web-ui `Input`/`Checkbox`/`Button` for the rest.
- `field.label` may be a `LocalizedLabel`; render via `typeof label === 'string' ? label : Object.values(label)[0] ?? ''`; edits write a plain string (per-locale editing is P3c).
- Co-locate `*.spec.tsx`. Conventional Commits; pre-commit passes (no `--no-verify`). Fresh worktree → `pnpm install` (Task 1). `noUncheckedIndexedAccess` is on.

---

### Task 1: Harden `useConfigBuilder` (ref-based, stable ops)

**Files:**
- Modify: `packages/form-builder-ui/src/use-config-builder.ts`
- Modify: `packages/form-builder-ui/src/use-config-builder.spec.ts` (add a back-to-back test)

**Why:** the current ops close over `config`, so two ops dispatched in one tick both read the pre-update config (stale). Switch to refs so ops are stable and always read the latest config, and `onChange` fires once (outside the setState updater — no StrictMode double-fire).

- [ ] **Step 1:** `pnpm install`.

- [ ] **Step 2: Write the failing test.** Add to `use-config-builder.spec.ts`:
```ts
it('applies back-to-back ops against the latest config (no stale closure)', () => {
  const { result } = renderHook(() => useConfigBuilder({ version: 1, fields: [] }));
  act(() => {
    result.current.add(f('a'));
    result.current.add(f('b'));
  });
  expect(result.current.config.fields.map((x) => x.key)).toEqual(['a', 'b']);
});
```
(With the current impl both `add`s read the empty initial config → result is `['b']`, so this FAILS. After the fix it is `['a','b']`.)

- [ ] **Step 3: Run — verify fail.** `pnpm -F @rfjs/form-builder-ui vitest:run`.

- [ ] **Step 4: Implement.** Replace the body of `useConfigBuilder` with a ref-based version (keep the `ConfigBuilderApi` interface unchanged):
```ts
export function useConfigBuilder(
  initial: FormConfig,
  onChange?: (config: FormConfig) => void,
): ConfigBuilderApi {
  const [config, setConfig] = React.useState<FormConfig>(initial);
  const configRef = React.useRef(config);
  configRef.current = config;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const apply = React.useCallback((next: FormConfig) => {
    configRef.current = next; // so back-to-back ops in one tick see the latest
    setConfig(next);
    onChangeRef.current?.(next);
  }, []);

  const ops = React.useMemo(
    () => ({
      add: (field: FieldConfig, index?: number) => apply(addField(configRef.current, field, index)),
      remove: (key: string) => apply(removeField(configRef.current, key)),
      update: (key: string, patch: Partial<FieldConfig>) => apply(updateField(configRef.current, key, patch)),
      move: (from: number, to: number) => apply(moveField(configRef.current, from, to)),
      setColumns: (columns: FormConfig['columns']) => apply({ ...configRef.current, columns }),
      replace: (next: FormConfig) => apply(next),
    }),
    [apply],
  );

  return { config, ...ops };
}
```

- [ ] **Step 5: Run + check-types + commit.** All hook tests pass (existing + new); `check-types` clean.
```bash
git add packages/form-builder-ui/src/use-config-builder.ts packages/form-builder-ui/src/use-config-builder.spec.ts
git commit -m "fix(form-builder-ui): make useConfigBuilder ops ref-based (no stale closure)"
```

---

### Task 2: `FieldRow` → collapsible property editor

**Files:**
- Modify: `packages/form-builder-ui/src/field-row.tsx`
- Modify: `packages/form-builder-ui/src/field-row.spec.tsx`

**Behavior:** a header (collapse chevron · drag handle · `component` tag · label summary · `required` badge · delete) over a collapsible body (default **open**) with: **Type** (`<select>` of the 5 components — remaps dataType/options), **Label** (`Input`), **Width** (`<select>` full/half), **Required** (`Checkbox`).

- [ ] **Step 1: Write the failing tests.** Replace `field-row.spec.tsx`'s interaction tests with (keep `makeField` test):
```tsx
function renderRow(field: FieldConfig, onUpdate = vi.fn(), onRemove = vi.fn()) {
  render(
    <DndContext><SortableContext items={[field.key]}>
      <FieldRow field={field} onUpdate={onUpdate} onRemove={onRemove} />
    </SortableContext></DndContext>,
  );
  return { onUpdate, onRemove };
}
const base: FieldConfig = { key: 'name', label: 'Name', component: 'Input', dataType: 'string' };

it('shows the property editor by default and collapses on toggle', () => {
  renderRow(base);
  expect(screen.getByLabelText('label for name')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /collapse field/i }));
  expect(screen.queryByLabelText('label for name')).toBeNull();
});
it('edits the label', () => {
  const { onUpdate } = renderRow(base);
  fireEvent.change(screen.getByLabelText('label for name'), { target: { value: 'Full name' } });
  expect(onUpdate).toHaveBeenCalledWith({ label: 'Full name' });
});
it('changes width', () => {
  const { onUpdate } = renderRow(base);
  fireEvent.change(screen.getByLabelText('width for name'), { target: { value: 'half' } });
  expect(onUpdate).toHaveBeenCalledWith({ width: 'half' });
});
it('changes type and remaps dataType/options', () => {
  const { onUpdate } = renderRow(base);
  fireEvent.change(screen.getByLabelText('type for name'), { target: { value: 'Select' } });
  expect(onUpdate).toHaveBeenCalledWith({ component: 'Select', dataType: 'string', options: [] });
});
it('toggles required', () => {
  const { onUpdate } = renderRow(base);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(onUpdate).toHaveBeenCalledWith({ required: true });
});
it('removes the field', () => {
  const { onRemove } = renderRow(base);
  fireEvent.click(screen.getByRole('button', { name: /remove field/i }));
  expect(onRemove).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Implement** `field-row.tsx` (keep `makeField`/`DATATYPE_BY_COMPONENT`; add `ChevronDown`/`ChevronRight` imports + `FieldWidth` type import). Header + collapsible body; native `<select>` for type/width styled with web-ui input classes:
```tsx
const COMPONENTS: FieldComponent[] = ['Input', 'Textarea', 'Select', 'Checkbox', 'Date'];
const SELECT_CLASS = 'h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground';
function labelOf(label: FieldConfig['label']): string {
  return typeof label === 'string' ? label : (Object.values(label)[0] ?? '');
}

export function FieldRow({ field, onUpdate, onRemove }: FieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.key });
  const [open, setOpen] = React.useState(true);
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  function changeComponent(component: FieldComponent) {
    onUpdate({
      component,
      dataType: DATATYPE_BY_COMPONENT[component],
      options: component === 'Select' ? (field.options ?? []) : undefined,
    });
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-md border border-input bg-background">
      <div className="flex items-center gap-2 p-2">
        <button type="button" className="text-muted-foreground" aria-label={open ? 'collapse field' : 'expand field'} onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <button type="button" className="cursor-grab text-muted-foreground" aria-label="drag" {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
        <span className="font-mono text-xs text-muted-foreground">{field.component}</span>
        <span className="flex-1 truncate text-sm">{labelOf(field.label)}</span>
        {field.required ? <span className="text-xs text-destructive">required</span> : null}
        <Button type="button" variant="ghost" size="icon" aria-label="remove field" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      {open ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 border-t border-input p-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Type
            <select className={SELECT_CLASS} aria-label={`type for ${field.key}`} value={field.component} onChange={(e) => changeComponent(e.target.value as FieldComponent)}>
              {COMPONENTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Label
            <Input className="h-8" aria-label={`label for ${field.key}`} value={labelOf(field.label)} onChange={(e) => onUpdate({ label: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Width
            <select className={SELECT_CLASS} aria-label={`width for ${field.key}`} value={field.width ?? 'full'} onChange={(e) => onUpdate({ width: e.target.value as FieldWidth })}>
              <option value="full">Full</option>
              <option value="half">Half</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 self-end text-xs text-muted-foreground">
            <Checkbox checked={Boolean(field.required)} onCheckedChange={(c) => onUpdate({ required: c === true })} />
            required
          </label>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run + check-types + commit.** All form-builder-ui tests pass (FieldRow new tests + ConfigFormBuilder/ConfigForm/hook). Note: `ConfigFormBuilder` tests query `getByLabelText(/^label for /)` which still match the editor label inputs (body open by default) — confirm they pass.
```bash
git add packages/form-builder-ui/src/field-row.tsx packages/form-builder-ui/src/field-row.spec.tsx
git commit -m "feat(form-builder-ui): collapsible FieldRow property editor (type/label/width/required)"
```

---

### Task 3: Select options editor

**Files:**
- Modify: `packages/form-builder-ui/src/field-row.tsx` (add `OptionsEditor`, render when component is Select)
- Modify: `packages/form-builder-ui/src/field-row.spec.tsx` (add option tests)

- [ ] **Step 1: Write the failing tests.** Add:
```tsx
const selectField: FieldConfig = { key: 'role', label: 'Role', component: 'Select', dataType: 'string', options: [{ label: 'Admin', value: 'admin' }] };
it('adds an option to a Select field', () => {
  const { onUpdate } = renderRow(selectField);
  fireEvent.click(screen.getByRole('button', { name: /add option/i }));
  expect(onUpdate).toHaveBeenCalledWith({ options: [{ label: 'Admin', value: 'admin' }, { label: '', value: '' }] });
});
it('edits an option label', () => {
  const { onUpdate } = renderRow(selectField);
  fireEvent.change(screen.getByLabelText('option 0 label'), { target: { value: 'Administrator' } });
  expect(onUpdate).toHaveBeenCalledWith({ options: [{ label: 'Administrator', value: 'admin' }] });
});
it('removes an option', () => {
  const { onUpdate } = renderRow(selectField);
  fireEvent.click(screen.getByRole('button', { name: /remove option 0/i }));
  expect(onUpdate).toHaveBeenCalledWith({ options: [] });
});
it('shows no options editor for a non-Select field', () => {
  renderRow({ key: 'name', label: 'Name', component: 'Input', dataType: 'string' });
  expect(screen.queryByRole('button', { name: /add option/i })).toBeNull();
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Implement.** Add `OptionsEditor` to `field-row.tsx` and render it in the open body when `field.component === 'Select'`:
```tsx
import type { FieldComponent, FieldConfig, FieldOption, FieldWidth } from '@rfjs/form-builder';

function OptionsEditor({ field, onUpdate }: { field: FieldConfig; onUpdate: (patch: Partial<FieldConfig>) => void }) {
  const options = field.options ?? [];
  const set = (next: FieldOption[]) => onUpdate({ options: next });
  return (
    <div className="col-span-full flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Options</span>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="h-8" aria-label={`option ${i} label`} value={opt.label} onChange={(e) => set(options.map((o, j) => (j === i ? { ...o, label: e.target.value } : o)))} />
          <Input className="h-8" aria-label={`option ${i} value`} value={String(opt.value)} onChange={(e) => set(options.map((o, j) => (j === i ? { ...o, value: e.target.value } : o)))} />
          <Button type="button" variant="ghost" size="icon" aria-label={`remove option ${i}`} onClick={() => set(options.filter((_, j) => j !== i))}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => set([...options, { label: '', value: '' }])}>
        + Add option
      </Button>
    </div>
  );
}
```
In `FieldRow`'s open body, after the required label, add:
```tsx
{field.component === 'Select' ? <OptionsEditor field={field} onUpdate={onUpdate} /> : null}
```

- [ ] **Step 4: Run + check-types + commit.**
```bash
git add packages/form-builder-ui/src/field-row.tsx packages/form-builder-ui/src/field-row.spec.tsx
git commit -m "feat(form-builder-ui): add Select options editor to FieldRow"
```

---

## Self-Review

**Spec coverage:** Phase 3b targets richer field editing. This plan delivers: hook hardening (Task 1, the deferred P3a item), collapsible per-field property editor — type/label/width/required (Task 2), Select options editor (Task 3). **Deferred to P3c:** columns UI control, Config(JSON) round-trip tab, per-locale label editing, `key` editing, panel-level "collapse all".

**Placeholder scan:** complete code for hook, FieldRow, OptionsEditor.

**Type consistency:** `changeComponent` remap matches the engine's `dataType`/`options` shape; `FieldWidth`/`FieldOption` imported from `@rfjs/form-builder`; aria-labels (`type for`/`label for`/`width for`/`option N label`/`remove option N`) consistent between impl and tests.

**Regression watch:** `ConfigFormBuilder` tests rely on `getByLabelText(/^label for /)` (editor body open by default → still present) and `getByRole('button', {name:/remove field/i})` (header delete → unchanged). Task 2 Step 4 verifies they stay green. The live preview is unaffected (it renders `<ConfigForm>`, not `FieldRow`).
