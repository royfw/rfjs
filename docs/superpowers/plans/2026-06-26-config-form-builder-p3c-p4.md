# ConfigFormBuilder — Phase 3c + 4 (finish & ship) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Finish the visual builder (columns control, Config(JSON) round-trip, key editing, per-locale labels) and **ship it** as the `apps/web` `form-builder` tool.

**Architecture:** Extend `<ConfigFormBuilder>`/`FieldRow` (merged P3a/P3b) on the ref-based `useConfigBuilder` hook, then wire it into `apps/web` via the registry-driven tool system (`toolModules` → `TOOL_COMPONENTS`, `@rfjs/web-core` `toolRegistry`, `transpilePackages`, per-tool i18n).

**Tech Stack:** React 19, @dnd-kit, @rfjs/web-ui, @rfjs/web-core, next-intl, vitest jsdom, @testing-library/react.

## Global Constraints

- Use the engine via the hook (`setColumns`, `replace`, `update`); `replace` is ref-based (P3b) so JSON round-trip is safe.
- `parseFormConfig` (from `@rfjs/form-builder`) validates pasted JSON; on failure show an error and do not call `replace`.
- Native `<select>` for editor chrome (columns, type, width) — testable. web-ui `Input`/`Button`/`Checkbox` elsewhere.
- Per-locale: `<ConfigFormBuilder locales={['en','zh-TW']}>`; with >1 locale the label editor shows one input per locale and `label` becomes `Record<locale,string>`; with 1 locale it stays a single string input. `resolveLabel` already renders both.
- Key editing commits **on blur** (key is the dnd id + React key — editing per-keystroke would remount and lose focus).
- apps/web tool follows the existing pattern exactly (see `data-filter-builder`): `tools/form-builder/{index.ts,ui.tsx,messages.ts}` + add to `toolModules` + `@rfjs/web-core` `toolRegistry` + `transpilePackages` + deps. Deferred (note in PR): panel-level "collapse all".
- Co-locate `*.spec.tsx`. Conventional Commits; pre-commit passes (no `--no-verify`). Fresh worktree → `pnpm install`.

---

### Task 1: Columns control in `<ConfigFormBuilder>`

**Files:** Modify `packages/form-builder-ui/src/config-form-builder.tsx` + `config-form-builder.spec.tsx`.

- [ ] **Step 1:** `pnpm install`.
- [ ] **Step 2: Failing test.** Add:
```tsx
it('sets form columns from the columns control', () => {
  const onChange = vi.fn();
  render(<ConfigFormBuilder initialConfig={initial} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText(/columns/i), { target: { value: '2' } });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ columns: 2 }));
});
```
(`vi` import + `onChange` may need adding to the spec's imports.)
- [ ] **Step 3: Run — fail.**
- [ ] **Step 4: Implement.** In the palette toolbar `<div>`, add a columns control:
```tsx
<label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
  Columns
  <select
    className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
    aria-label="columns"
    value={builder.config.columns ?? 1}
    onChange={(e) => builder.setColumns(Number(e.target.value) as FormConfig['columns'])}
  >
    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
  </select>
</label>
```
- [ ] **Step 5: Run + check-types + commit.** `git commit -m "feat(form-builder-ui): add columns control to ConfigFormBuilder"`

---

### Task 2: Config(JSON) round-trip tab

**Files:** Modify `config-form-builder.tsx` + `config-form-builder.spec.tsx`.

**Behavior:** two tabs — **Builder** (current editor) and **JSON**. JSON tab shows `JSON.stringify(config, null, 2)` in a textarea; on edit, parse via `parseFormConfig` → `builder.replace(parsed)`; on parse error show a message and don't replace.

- [ ] **Step 1: Failing tests.** Add:
```tsx
it('shows the config as JSON and applies edits back (round-trip)', () => {
  const onChange = vi.fn();
  render(<ConfigFormBuilder initialConfig={initial} onChange={onChange} />);
  fireEvent.click(screen.getByRole('tab', { name: /json/i }));
  const ta = screen.getByLabelText(/config json/i) as HTMLTextAreaElement;
  const next = { version: 1, fields: [{ key: 'email', label: 'Email', component: 'Input', dataType: 'string' }] };
  fireEvent.change(ta, { target: { value: JSON.stringify(next) } });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fields: [expect.objectContaining({ key: 'email' })] }));
});
it('shows an error for invalid JSON and does not apply it', () => {
  const onChange = vi.fn();
  render(<ConfigFormBuilder initialConfig={initial} onChange={onChange} />);
  fireEvent.click(screen.getByRole('tab', { name: /json/i }));
  fireEvent.change(screen.getByLabelText(/config json/i), { target: { value: '{ not json' } });
  expect(screen.getByText(/invalid/i)).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
});
```
- [ ] **Step 2: Run — fail.**
- [ ] **Step 3: Implement.** Add a tab state (`'builder' | 'json'`) and a JSON panel. Use simple `role="tab"` buttons (native, testable). JSON panel:
```tsx
const [tab, setTab] = React.useState<'builder' | 'json'>('builder');
const [jsonError, setJsonError] = React.useState<string | null>(null);

function onJsonChange(text: string) {
  try {
    const parsed = parseFormConfig(JSON.parse(text));
    setJsonError(null);
    builder.replace(parsed);
  } catch (err) {
    setJsonError(err instanceof Error ? err.message : 'Invalid config');
  }
}
```
Render two `<button role="tab">` (Builder / JSON) and switch the body. JSON body:
```tsx
<div>
  <textarea
    aria-label="config json"
    className="h-64 w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
    defaultValue={JSON.stringify(builder.config, null, 2)}
    onChange={(e) => onJsonChange(e.target.value)}
  />
  {jsonError ? <p className="mt-1 text-xs text-destructive">Invalid config: {jsonError}</p> : null}
</div>
```
(Import `parseFormConfig` from `@rfjs/form-builder`. Keep the Builder tab content — palette + dnd list + preview — as-is, shown when `tab==='builder'`. The preview can stay always-visible or move under Builder; keep it under Builder.)
- [ ] **Step 4: Run + check-types + commit.** `git commit -m "feat(form-builder-ui): add Config(JSON) round-trip tab"`

---

### Task 3: Key editing (commit on blur)

**Files:** Modify `field-row.tsx` + `field-row.spec.tsx`.

**Behavior:** a **Key** input in the property editor; local state while typing, commit `onUpdate({ key })` on blur (avoids remount-per-keystroke since key is the dnd/React id).

- [ ] **Step 1: Failing test.** Add:
```tsx
it('commits a key change on blur', () => {
  const { onUpdate } = renderRow(base);
  const keyInput = screen.getByLabelText('key for name');
  fireEvent.change(keyInput, { target: { value: 'full_name' } });
  expect(onUpdate).not.toHaveBeenCalled(); // not on each keystroke
  fireEvent.blur(keyInput);
  expect(onUpdate).toHaveBeenCalledWith({ key: 'full_name' });
});
```
- [ ] **Step 2: Run — fail.**
- [ ] **Step 3: Implement.** In `FieldRow`, add local key draft state synced to `field.key`, and a Key input in the editor grid (before Label):
```tsx
const [keyDraft, setKeyDraft] = React.useState(field.key);
React.useEffect(() => setKeyDraft(field.key), [field.key]);
// ...
<label className="flex flex-col gap-1 text-xs text-muted-foreground">Key
  <Input className="h-8 font-mono" aria-label={`key for ${field.key}`} value={keyDraft}
    onChange={(e) => setKeyDraft(e.target.value)}
    onBlur={() => { if (keyDraft && keyDraft !== field.key) onUpdate({ key: keyDraft }); }} />
</label>
```
- [ ] **Step 4: Run + check-types + commit.** `git commit -m "feat(form-builder-ui): add key editing (commit on blur) to FieldRow"`

---

### Task 4: Per-locale label editing

**Files:** Modify `field-row.tsx` + `field-row.spec.tsx`; thread `locales` through `config-form-builder.tsx`.

**Behavior:** `FieldRow` takes `locales: string[]` (default `['en']`). With 1 locale → single Label input (current). With >1 → one Label input per locale (`aria-label="label (LOCALE) for KEY"`); editing locale L sets `label` to a record: `{ ...(typeof field.label === 'string' ? {} : field.label), [L]: value }` (seed the default locale's existing string under the first locale when converting). `ConfigFormBuilder` passes its `locales` to each `FieldRow`.

- [ ] **Step 1: Failing test.** Add:
```tsx
it('edits a per-locale label when multiple locales', () => {
  const onUpdate = vi.fn();
  render(<DndContext><SortableContext items={['name']}>
    <FieldRow field={{ key: 'name', label: 'Name', component: 'Input', dataType: 'string' }}
      locales={['en', 'zh-TW']} onUpdate={onUpdate} onRemove={() => {}} />
  </SortableContext></DndContext>);
  fireEvent.change(screen.getByLabelText('label (zh-TW) for name'), { target: { value: '姓名' } });
  expect(onUpdate).toHaveBeenCalledWith({ label: { en: 'Name', 'zh-TW': '姓名' } });
});
```
(For the single-locale default, the existing `label for name` test must still pass.)
- [ ] **Step 2: Run — fail.**
- [ ] **Step 3: Implement.** Add `locales?: string[]` to `FieldRowProps` (default `['en']`). Helper to read a locale's text and to write one:
```tsx
function localeText(label: FieldConfig['label'], loc: string, fallback: string): string {
  if (typeof label === 'string') return loc === fallback ? label : '';
  return label[loc] ?? '';
}
function setLocaleLabel(label: FieldConfig['label'], loc: string, value: string, locales: string[]): FieldConfig['label'] {
  const base: Record<string, string> = typeof label === 'string' ? { [locales[0] ?? 'en']: label } : { ...label };
  base[loc] = value;
  return base;
}
```
In the editor body, replace the single Label input: if `locales.length <= 1`, keep the current single `Input` (`aria-label={`label for ${field.key}`}`, value `labelOf(field.label)`, `onUpdate({label})`); else render one `Input` per locale with `aria-label={`label (${loc}) for ${field.key}`}`, value `localeText(field.label, loc, locales[0]!)`, `onChange={(e)=>onUpdate({ label: setLocaleLabel(field.label, loc, e.target.value, locales) })}`.
In `config-form-builder.tsx`, add `locales?: string[]` to its props and pass `locales={locales}` to each `<FieldRow>`.
- [ ] **Step 4: Run + check-types + commit.** All form-builder-ui tests pass (single-locale path unchanged). `git commit -m "feat(form-builder-ui): per-locale label editing in FieldRow"`

---

### Task 5: Ship — `apps/web` `form-builder` tool

**Files:**
- Create: `apps/web/src/tools/form-builder/{index.ts, ui.tsx, messages.ts}`
- Modify: `apps/web/src/tools/index.ts` (add to `toolModules`)
- Modify: `packages/web-core/src/registry/tools.ts` (add `toolRegistry` entry)
- Modify: `apps/web/next.config.js` (`transpilePackages`), `apps/web/package.json` (deps)

- [ ] **Step 1: Confirm patterns.** Read `apps/web/src/tools/data-filter-builder/{index.ts,ui.tsx,messages.ts}`, `apps/web/src/tools/index.ts` (how `toolModules` is assembled), and `packages/web-core/src/registry/schemas.ts` (ToolDefinition + category enum). Mirror them.

- [ ] **Step 2: Implement.**
  - `tools/form-builder/ui.tsx` (`'use client'`): renders `<ConfigFormBuilder locales={['en','zh-TW']} />` inside the shared tool shell; uses `useTranslations('ToolUI')` for any chrome text. Import from `@rfjs/form-builder-ui`.
  - `tools/form-builder/index.ts`: `export const tool: ToolModule = { id: 'form-builder', Component: FormBuilderTool };`
  - `tools/form-builder/messages.ts`: `Tools` namespace (title/description) + `ToolUI` keys, for `en` and `zh-TW`, matching the shape in `data-filter-builder/messages.ts`.
  - `tools/index.ts`: add the form-builder tool module to the `toolModules` array (so `TOOL_COMPONENTS['form-builder']` resolves).
  - `packages/web-core/src/registry/tools.ts`: add `{ id: 'form-builder', category: 'generator', surface: 'web', status: 'preview', relatedPackages: ['@rfjs/form-builder', '@rfjs/form-builder-ui'], tags: ['form', 'builder', 'config'] }` (confirm `'generator'` is in the category enum; if not, use the closest valid one and note it).
  - `apps/web/next.config.js`: add `"@rfjs/form-builder-ui"` to `transpilePackages`.
  - `apps/web/package.json`: add `"@rfjs/form-builder": "workspace:*"` and `"@rfjs/form-builder-ui": "workspace:*"`. Run `pnpm install`.

- [ ] **Step 3: Verify.** The existing `apps/web/src/tools/index.spec.ts` cross-checks `TOOL_COMPONENTS` against the registry — run `pnpm -F web vitest:run` (or the app's test script) and `pnpm -F web check-types`. Build `@rfjs/form-builder` first if needed (`pnpm -F @rfjs/form-builder build`). Confirm the registry↔components consistency test passes for the new tool. Interactive page render is manual (note in PR).

- [ ] **Step 4: Commit.** `git commit -m "feat(web): add form-builder tool (ConfigFormBuilder)"`

---

## Self-Review

**Spec coverage:** P3c = columns control (T1), Config(JSON) round-trip (T2), key editing (T3), per-locale labels (T4); P4 = apps/web tool (T5). Deferred: panel-level "collapse all" (minor polish — note in PR).

**Placeholder scan:** code given for T1-T4; T5 is wiring against confirmed patterns with a "read the sample tool first" step (the apps/web message/registry shapes are project-specific — the implementer mirrors `data-filter-builder`).

**Type consistency:** `setColumns(Number(...) as FormConfig['columns'])`; `replace` for JSON; `locales` threaded builder→FieldRow; `parseFormConfig` for round-trip. Single-locale label path preserved (existing `label for KEY` tests stay green); multi-locale uses `label (LOCALE) for KEY`.

**Regression watch:** existing FieldRow/ConfigFormBuilder/ConfigForm tests must stay green — T4 keeps the single-locale Input, T1/T2 add controls without removing the palette/list/preview, T3 adds a Key input. T5's `apps/web` registry-consistency spec must pass with the new tool.
