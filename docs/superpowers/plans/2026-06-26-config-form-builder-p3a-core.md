# ConfigFormBuilder — Phase 3a (visual builder core) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A working visual `<ConfigFormBuilder>` core in `@rfjs/form-builder-ui`: add fields from a palette, **drag to reorder** (`@dnd-kit`), delete, edit each field's label + required inline, with a **live `<ConfigForm>` preview**. Built on the merged Phase-1/2 engine (`list-ops`, `width`/`columns`, `LocalizedLabel`).

**Architecture:** A `useConfigBuilder` hook owns `FormConfig` state and wraps the pure engine `list-ops`. `<ConfigFormBuilder>` is presentational over that hook + `@dnd-kit` sortable rows; the preview reuses `<ConfigForm>`. This is the structural core — richer per-field editing (type/key/width/options/per-locale), per-field collapse, columns UI, and the JSON round-trip tab are **P3b** (out of scope here).

**Tech Stack:** React 19, `@dnd-kit/core` + `/sortable` + `/utilities`, `@rfjs/web-ui`, vitest jsdom, @testing-library/react + user-event.

## Global Constraints

- `@rfjs/form-builder-ui` is private, exports `src/`, consumed via transpilePackages. It already depends on `@rfjs/form-builder` (engine) + `@rfjs/web-ui`.
- Use the engine's pure `list-ops` (`addField`/`removeField`/`updateField`/`moveField`) — do not reimplement field mutation.
- All field cards need a **stable unique id** for dnd — use `field.key` (keys are unique within a config).
- **Drag itself is not unit-tested in jsdom** (jsdom can't do pointer drag). Test the non-drag interactions (add/delete/label-edit) and the reorder *handler* logic (`onDragEnd` mapping active/over → `moveField`) directly. Note drag as manual/integration verification.
- New field defaults: a sensible default per component type (see Task 2 `makeField`). zod data validation (`configToZod`) is unaffected — this is edit-model UI.
- Co-locate `*.spec.tsx`. Conventional Commits; pre-commit hook passes (no `--no-verify`). Fresh worktree → `pnpm install` (Task 1).

---

### Task 1: `@dnd-kit` deps + `useConfigBuilder` hook

**Files:**
- Modify: `packages/form-builder-ui/package.json` (add dnd-kit deps)
- Create: `packages/form-builder-ui/src/use-config-builder.ts`
- Test: `packages/form-builder-ui/src/use-config-builder.spec.ts`

**Interfaces produced:**
```ts
interface ConfigBuilderApi {
  config: FormConfig;
  add: (field: FieldConfig, index?: number) => void;
  remove: (key: string) => void;
  update: (key: string, patch: Partial<FieldConfig>) => void;
  move: (from: number, to: number) => void;
  setColumns: (columns: FormConfig['columns']) => void;
  replace: (config: FormConfig) => void; // for JSON round-trip later
}
function useConfigBuilder(initial: FormConfig, onChange?: (config: FormConfig) => void): ConfigBuilderApi
```

- [ ] **Step 1: Install deps**

Edit `packages/form-builder-ui/package.json` dependencies to add:
```json
"@dnd-kit/core": "^6.3.1",
"@dnd-kit/sortable": "^10.0.0",
"@dnd-kit/utilities": "^3.2.2"
```
Run `pnpm install` (repo root). Verify the three resolve; if a newer compatible stable exists, take it and note the installed versions.

- [ ] **Step 2: Write the failing hook test**

`packages/form-builder-ui/src/use-config-builder.spec.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfigBuilder } from './use-config-builder';
import type { FormConfig, FieldConfig } from '@rfjs/form-builder';

const f = (key: string): FieldConfig => ({ key, label: key, component: 'Input', dataType: 'string' });
const initial: FormConfig = { version: 1, fields: [f('a'), f('b')] };

describe('useConfigBuilder', () => {
  it('adds, updates, removes and moves fields, and fires onChange', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useConfigBuilder(initial, onChange));

    act(() => result.current.add(f('c')));
    expect(result.current.config.fields.map((x) => x.key)).toEqual(['a', 'b', 'c']);

    act(() => result.current.update('b', { label: 'Bee' }));
    expect(result.current.config.fields[1].label).toBe('Bee');

    act(() => result.current.move(0, 2));
    expect(result.current.config.fields.map((x) => x.key)).toEqual(['b', 'c', 'a']);

    act(() => result.current.remove('c'));
    expect(result.current.config.fields.map((x) => x.key)).toEqual(['b', 'a']);

    act(() => result.current.setColumns(2));
    expect(result.current.config.columns).toBe(2);

    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(result.current.config);
  });
});
```

- [ ] **Step 3: Run — verify fail.** `pnpm -F @rfjs/form-builder-ui vitest:run` → FAIL (no module).

- [ ] **Step 4: Implement the hook**

`packages/form-builder-ui/src/use-config-builder.ts`:
```ts
import * as React from 'react';
import {
  addField,
  removeField,
  updateField,
  moveField,
  type FieldConfig,
  type FormConfig,
} from '@rfjs/form-builder';

export interface ConfigBuilderApi {
  config: FormConfig;
  add: (field: FieldConfig, index?: number) => void;
  remove: (key: string) => void;
  update: (key: string, patch: Partial<FieldConfig>) => void;
  move: (from: number, to: number) => void;
  setColumns: (columns: FormConfig['columns']) => void;
  replace: (config: FormConfig) => void;
}

export function useConfigBuilder(
  initial: FormConfig,
  onChange?: (config: FormConfig) => void,
): ConfigBuilderApi {
  const [config, setConfig] = React.useState<FormConfig>(initial);

  const apply = React.useCallback(
    (next: FormConfig) => {
      setConfig(next);
      onChange?.(next);
    },
    [onChange],
  );

  return React.useMemo<ConfigBuilderApi>(
    () => ({
      config,
      add: (field, index) => apply(addField(config, field, index)),
      remove: (key) => apply(removeField(config, key)),
      update: (key, patch) => apply(updateField(config, key, patch)),
      move: (from, to) => apply(moveField(config, from, to)),
      setColumns: (columns) => apply({ ...config, columns }),
      replace: (next) => apply(next),
    }),
    [config, apply],
  );
}
```

- [ ] **Step 5: Run + commit.** `pnpm -F @rfjs/form-builder-ui vitest:run` → pass; `pnpm -F @rfjs/form-builder-ui check-types` → clean.
```bash
git add packages/form-builder-ui/package.json packages/form-builder-ui/src/use-config-builder.ts packages/form-builder-ui/src/use-config-builder.spec.ts pnpm-lock.yaml
git commit -m "feat(form-builder-ui): add @dnd-kit deps and useConfigBuilder hook"
```

---

### Task 2: `FieldRow` — a sortable, inline-editable field row

**Files:**
- Create: `packages/form-builder-ui/src/field-row.tsx`
- Test: `packages/form-builder-ui/src/field-row.spec.tsx`

**Interfaces produced:**
```ts
interface FieldRowProps {
  field: FieldConfig;
  onUpdate: (patch: Partial<FieldConfig>) => void;
  onRemove: () => void;
}
function FieldRow(props: FieldRowProps): JSX.Element  // a @dnd-kit useSortable row
function makeField(component: FieldComponent): FieldConfig // default field for a palette add
```

- [ ] **Step 1: Write the failing test**

`packages/form-builder-ui/src/field-row.spec.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { FieldRow, makeField } from './field-row';
import type { FieldConfig } from '@rfjs/form-builder';

function renderRow(field: FieldConfig, onUpdate = vi.fn(), onRemove = vi.fn()) {
  render(
    <DndContext>
      <SortableContext items={[field.key]}>
        <FieldRow field={field} onUpdate={onUpdate} onRemove={onRemove} />
      </SortableContext>
    </DndContext>,
  );
  return { onUpdate, onRemove };
}

describe('FieldRow', () => {
  it('edits the label', () => {
    const { onUpdate } = renderRow({ key: 'name', label: 'Name', component: 'Input', dataType: 'string' });
    fireEvent.change(screen.getByDisplayValue('Name'), { target: { value: 'Full name' } });
    expect(onUpdate).toHaveBeenCalledWith({ label: 'Full name' });
  });

  it('toggles required', () => {
    const { onUpdate } = renderRow({ key: 'name', label: 'Name', component: 'Input', dataType: 'string' });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onUpdate).toHaveBeenCalledWith({ required: true });
  });

  it('removes the field', () => {
    const { onRemove } = renderRow({ key: 'name', label: 'Name', component: 'Input', dataType: 'string' });
    fireEvent.click(screen.getByRole('button', { name: /remove|delete/i }));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('makeField', () => {
  it('creates a defaulted field for a component with a unique-ish key', () => {
    const f = makeField('Select');
    expect(f.component).toBe('Select');
    expect(typeof f.key).toBe('string');
    expect(f.key.length).toBeGreaterThan(0);
    expect(typeof f.label).toBe('string');
  });
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Implement**

`packages/form-builder-ui/src/field-row.tsx`. The label edits via `onUpdate({label})`; required via `onUpdate({required})`; the row is a `useSortable` item keyed by `field.key`. `makeField` returns a default field; derive `dataType` from the component (`Checkbox`→`'boolean'`, `Date`→`'date'`, `Select`→`'string'` with empty `options`, else `'string'`) and a unique key (`field_${count}` — pass a counter or use a label-derived slug; for the test a non-empty string suffices, so a module-level counter is fine since `Math.random`/`Date.now` are available in app runtime — DO NOT use them in tests).
```tsx
'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import type { FieldComponent, FieldConfig } from '@rfjs/form-builder';
import { Input } from '@rfjs/web-ui/components/input';
import { Checkbox } from '@rfjs/web-ui/components/checkbox';
import { Button } from '@rfjs/web-ui/components/button';

const DATATYPE_BY_COMPONENT: Record<FieldComponent, FieldConfig['dataType']> = {
  Input: 'string',
  Textarea: 'string',
  Select: 'string',
  Checkbox: 'boolean',
  Date: 'date',
};

let counter = 0;
export function makeField(component: FieldComponent): FieldConfig {
  counter += 1;
  const base: FieldConfig = {
    key: `field_${counter}`,
    label: component,
    component,
    dataType: DATATYPE_BY_COMPONENT[component],
  };
  return component === 'Select' ? { ...base, options: [] } : base;
}

export interface FieldRowProps {
  field: FieldConfig;
  onUpdate: (patch: Partial<FieldConfig>) => void;
  onRemove: () => void;
}

export function FieldRow({ field, onUpdate, onRemove }: FieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.key });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const labelText = typeof field.label === 'string' ? field.label : (Object.values(field.label)[0] ?? '');

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border border-input bg-background p-2">
      <button type="button" className="cursor-grab text-muted-foreground" aria-label="drag" {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <span className="font-mono text-xs text-muted-foreground">{field.component}</span>
      <Input
        className="h-8 flex-1"
        value={labelText}
        aria-label={`label for ${field.key}`}
        onChange={(e) => onUpdate({ label: e.target.value })}
      />
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Checkbox checked={Boolean(field.required)} onCheckedChange={(c) => onUpdate({ required: c === true })} />
        required
      </label>
      <Button type="button" variant="ghost" size="icon" aria-label="remove field" onClick={onRemove}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
```
(If `@rfjs/web-ui`'s `Button` doesn't accept `variant`/`size`, check its API and use the available props — confirm by reading `packages/web-ui/src/components/button.tsx`; adjust the icon button accordingly.)

- [ ] **Step 4: Run + commit.** Tests pass; `check-types` clean.
```bash
git add packages/form-builder-ui/src/field-row.tsx packages/form-builder-ui/src/field-row.spec.tsx
git commit -m "feat(form-builder-ui): add sortable FieldRow with inline label/required edit"
```

---

### Task 3: `<ConfigFormBuilder>` — palette + sortable list + live preview

**Files:**
- Create: `packages/form-builder-ui/src/config-form-builder.tsx`
- Test: `packages/form-builder-ui/src/config-form-builder.spec.tsx`
- Modify: `packages/form-builder-ui/src/index.ts` (export)

**Interfaces produced:**
```ts
interface ConfigFormBuilderProps {
  initialConfig?: FormConfig;
  onChange?: (config: FormConfig) => void;
  locale?: string;
}
function ConfigFormBuilder(props: ConfigFormBuilderProps): JSX.Element
```

- [ ] **Step 1: Write the failing test**

`packages/form-builder-ui/src/config-form-builder.spec.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ConfigFormBuilder } from './config-form-builder';
import type { FormConfig } from '@rfjs/form-builder';

const initial: FormConfig = { version: 1, fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string' }] };

describe('ConfigFormBuilder', () => {
  it('adds a field from the palette', () => {
    render(<ConfigFormBuilder initialConfig={initial} />);
    fireEvent.click(screen.getByRole('button', { name: /add input/i }));
    // two label inputs now exist in the editor (Name + the new Input)
    expect(screen.getAllByLabelText(/^label for /).length).toBe(2);
  });

  it('renders a live preview of the current config', () => {
    render(<ConfigFormBuilder initialConfig={initial} />);
    const preview = screen.getByTestId('config-form-preview');
    // the preview renders the field's label text
    expect(within(preview).getByText('Name')).toBeTruthy();
  });

  it('removes a field', () => {
    render(<ConfigFormBuilder initialConfig={initial} />);
    fireEvent.click(screen.getByRole('button', { name: /remove field/i }));
    expect(screen.queryByLabelText('label for name')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Implement**

`packages/form-builder-ui/src/config-form-builder.tsx`:
```tsx
'use client';

import * as React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { FieldComponent, FormConfig } from '@rfjs/form-builder';
import { Button } from '@rfjs/web-ui/components/button';

import { useConfigBuilder } from './use-config-builder';
import { FieldRow, makeField } from './field-row';
import { ConfigForm } from './config-form';

const PALETTE: FieldComponent[] = ['Input', 'Textarea', 'Select', 'Checkbox', 'Date'];
const EMPTY: FormConfig = { version: 1, fields: [] };

export interface ConfigFormBuilderProps {
  initialConfig?: FormConfig;
  onChange?: (config: FormConfig) => void;
  locale?: string;
}

export function ConfigFormBuilder({ initialConfig = EMPTY, onChange, locale = 'en' }: ConfigFormBuilderProps) {
  const builder = useConfigBuilder(initialConfig, onChange);
  const sensors = useSensors(useSensor(PointerSensor));
  const ids = builder.config.fields.map((f) => f.key);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from !== -1 && to !== -1) builder.move(from, to);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {PALETTE.map((c) => (
          <Button key={c} type="button" variant="outline" size="sm" onClick={() => builder.add(makeField(c))}>
            + {c}
          </Button>
        ))}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {builder.config.fields.map((field) => (
              <FieldRow
                key={field.key}
                field={field}
                onUpdate={(patch) => builder.update(field.key, patch)}
                onRemove={() => builder.remove(field.key)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div data-testid="config-form-preview" className="rounded-md border border-input p-4">
        <ConfigForm key={JSON.stringify(builder.config)} config={builder.config} locale={locale} onSubmit={() => {}} />
      </div>
    </div>
  );
}
```
(Note the `key={JSON.stringify(...)}` on the preview `<ConfigForm>` — it remounts on config change, since `<ConfigForm>` reads `config` once at mount. Adjust the palette `Button` `variant`/`size` to web-ui's actual API per Task 2.)

- [ ] **Step 4: Export from barrel**

`packages/form-builder-ui/src/index.ts` (append):
```ts
export * from './config-form-builder';
export * from './use-config-builder';
export * from './field-row';
```

- [ ] **Step 5: Run + typecheck + commit**

`pnpm -F @rfjs/form-builder-ui vitest:run` → all pass (incl. existing ConfigForm/field-control). `pnpm -F @rfjs/form-builder-ui check-types` → clean.
```bash
git add packages/form-builder-ui/src
git commit -m "feat(form-builder-ui): add ConfigFormBuilder (palette + sortable list + live preview)"
```

---

## Self-Review

**Spec coverage:** Phase 3 of the spec = `<ConfigFormBuilder>` visual editor. This plan delivers the **core (P3a)**: `@dnd-kit` drag reorder, palette add, delete, inline label+required edit, live preview, via `useConfigBuilder` over the engine's `list-ops`. **Deferred to P3b** (call out clearly in the PR): per-field collapse (two-level), type/key/width editing, Select options editor, per-locale label editing, columns UI control, Config(JSON) round-trip tab, big-collapse.

**Placeholder scan:** complete code for the hook, FieldRow, and ConfigFormBuilder. The two `variant`/`size` Button notes are explicit "verify against web-ui's button API" instructions, not placeholders.

**Type consistency:** `useConfigBuilder`/`ConfigBuilderApi`, `FieldRow`/`makeField`, `ConfigFormBuilder` names consistent across tasks. Uses engine `list-ops` (already merged). `field.key` is the dnd id throughout.

**Testing reality:** drag is not simulated in jsdom — the `onDragEnd` handler maps ids→indices→`move` (covered indirectly via the hook's `move` test + the handler being thin); add/delete/label/required and the live preview ARE asserted. Drag-reorder gets manual/integration verification (note in PR).
