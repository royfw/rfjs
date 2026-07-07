# Form Builder v2-G (external API dataSource) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let a field/content item pull values from an **external API** at runtime — to populate dynamic **Select/Radio options**, display a **content** value, or seed a **default** — with a **pluggable fetcher** (the component never hardcodes network/auth), value extraction via **`path` (object-utils)** or **`jsonata` (data-expr)**, and loading / empty / error / **fallback** states.

**Architecture:** Engine `@rfjs/form-builder` gains a `DataSource` type + schema and pure helpers: `extractValue(dialect, expr, data)` (path→`getByPath`, jsonata→`compile().evaluate()`), `loadDataSource(ds, fetcher)`, and `toOptions(list, ds)`. The UI `@rfjs/form-builder-ui` gets a `useDataSource(ds, fetcher)` hook + a `fetcher` prop threaded through `<ConfigForm>`; `<FieldControl>` uses dynamic options for Select/Radio when a `dataSource` is present, content items show the fetched value, all with loading/error/fallback. The builder gets a DataSource editor sub-block.

**Tech Stack:** TypeScript, zod v4, react-hook-form, `@rfjs/object-utils` (`getByPath`), `@rfjs/data-expr` (`compile`), `@rfjs/web-ui`, vitest jsdom.

## Global Constraints

- **Pluggable fetcher (non-negotiable):** the components NEVER call `fetch` directly. `fetcher: (req: DataSourceRequest) => Promise<unknown>` is injected by the consumer (via a `<ConfigForm fetcher={...}>` prop / passed down from the builder). When no `fetcher` is provided, dataSource features are inert (render the static control / fallback) — never throw.
- **Back-compat:** items without `dataSource` behave exactly as today. New field is optional & additive.
- Dialects: **`path`** (`@rfjs/object-utils` `getByPath`) and **`jsonata`** (`@rfjs/data-expr` `compile(expr).evaluate(data)`, async). `'jsonpath'` is reserved in the type union but NOT implemented here (throws a clear "unsupported dialect" — documented; avoids a new dep). 
- Engine builds to dist; build it before UI tests in a fresh worktree. Co-locate `*.spec`. Conventional Commits (header ≤100 chars). pre-commit passes; no `--no-verify`; **no changeset**.
- jsonata `evaluate` is async → `extractValue`/`loadDataSource` are async. The UI hook handles the promise + React state.

## Engine type model (defined once)

```ts
// types.ts
export interface DataSourceRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
}
export type DataSourceDialect = 'path' | 'jsonata' | 'jsonpath';
export interface DataSourceExtract { dialect: DataSourceDialect; expr: string }
export interface DataSource {
  request: DataSourceRequest;
  extract: DataSourceExtract;       // → the value (scalar for content/default; list for options)
  fallback?: string;                // shown on empty/error; default '無'
  optionLabel?: string;             // for options: path within each list item → label (default: the item)
  optionValue?: string;             // for options: path within each list item → value (default: the item)
}
export type DataSourceFetcher = (req: DataSourceRequest) => Promise<unknown>;
// add `dataSource?: DataSource` to FieldItem and ContentItem
```

---

### Task 1: Engine — `DataSource` types + schema

**Files:** `packages/form-builder/src/types.ts`, `config-schema.ts`, `config-schema.spec.ts`.

- [ ] Add the types above to `types.ts`; add `dataSource?: DataSource` to `FieldItem` and `ContentItem` (and to `FieldConfig` so v1 fields can carry it too — put `dataSource?` on `FieldConfig`; `FieldItem extends FieldConfig` inherits it).
- [ ] `config-schema.ts`: a structural `dataSourceSchema` (`request: { url: string, method?: enum, headers?: record, body?: unknown }`, `extract: { dialect: enum['path','jsonata','jsonpath'], expr: string }`, `fallback?: string`, `optionLabel?: string`, `optionValue?: string`), `.optional()` on `fieldConfigSchema` and `contentItemSchema`.
- [ ] TDD: a config with a valid `dataSource` parses; a malformed one (missing `extract.expr`, bad `dialect`) is rejected. RED→GREEN.
- [ ] Build engine; `vitest:run`; commit `feat(form-builder): add DataSource types + schema`.

---

### Task 2: Engine — `extractValue` / `loadDataSource` / `toOptions`

**Files:** Create `packages/form-builder/src/data-source.ts`, `data-source.spec.ts`; export from `src/index.ts`. Add `@rfjs/object-utils` + `@rfjs/data-expr` as workspace deps of `@rfjs/form-builder`.

**Interfaces:**
- `extractValue(dialect, expr, data): Promise<unknown>` — `path`→`getByPath(data, expr)` (wrap sync in resolved promise); `jsonata`→`compile(expr).evaluate(data)`; `jsonpath`→`throw new Error('dataSource: jsonpath dialect not supported yet')`.
- `loadDataSource(ds, fetcher): Promise<unknown>` — `extractValue(ds.extract.dialect, ds.extract.expr, await fetcher(ds.request))`.
- `toOptions(extracted, ds): FieldOption[]` — if `extracted` isn't an array → `[]`; else map each item to `{ label: String(ds.optionLabel ? getByPath(item, ds.optionLabel) : item), value: ... ds.optionValue ... }`; if an item is already `{label,value}` and no optionLabel/Value given, pass through.

- [ ] Add deps (`pnpm install`). TDD `data-source.spec.ts`:
  - `extractValue('path', 'a.b', {a:{b:5}})` → 5; `extractValue('jsonata', 'items[0].name', {...})` → value; `jsonpath` → throws.
  - `loadDataSource` with a fake fetcher returning `{items:[...]}` and `extract path 'items'` → the list.
  - `toOptions([{id:1,name:'A'}], {optionLabel:'name', optionValue:'id'})` → `[{label:'A', value:1}]`; `toOptions(['x','y'], {})` → `[{label:'x',value:'x'},...]`; `toOptions('not-array', {})` → `[]`.
  RED→GREEN.
- [ ] Build; `vitest:run`; commit `feat(form-builder): dataSource extract/load/toOptions (path + jsonata)`.

---

### Task 3: UI — `useDataSource` hook

**Files:** Create `packages/form-builder-ui/src/use-data-source.ts`, `use-data-source.spec.ts`; export from barrel.

**Interfaces:** `useDataSource(ds: DataSource | undefined, fetcher?: DataSourceFetcher): { status: 'idle'|'loading'|'ready'|'error'; value: unknown; options: FieldOption[]; error?: string }`. On mount / when `ds`+`fetcher` identity changes: if both present → `loading` → `loadDataSource` → `ready` (set `value`; `options = toOptions(value, ds)`) or `error`. If `ds` or `fetcher` missing → `idle`. Guard against setState-after-unmount (an `active` flag in the effect).

- [ ] TDD (`@testing-library/react` `renderHook` + `waitFor`): with a resolving fake fetcher → ends `ready` with options; with a rejecting fetcher → `error`; with no fetcher → `idle`. RED→GREEN.
- [ ] Build engine; `vitest:run`; `check-types`; commit `feat(form-builder-ui): useDataSource hook`.

---

### Task 4: UI — dynamic options in `<ConfigForm>`/`<FieldControl>` (Select/Radio)

**Files:** `packages/form-builder-ui/src/config-form.tsx` (thread `fetcher` prop), `field-control.tsx` (consume), specs.

- [ ] `ConfigFormProps` gains `fetcher?: DataSourceFetcher`; pass it to each `<FieldControl fetcher={fetcher} .../>`. `FieldControlProps` gains `fetcher?`.
- [ ] In `FieldControl`, for `Select`/`Radio` when `field.dataSource` is present: call `useDataSource(field.dataSource, fetcher)`. While `loading` → render the control disabled with a "Loading…" placeholder; on `ready` → use the fetched `options` (instead of `field.options`); on `error`/empty → render the `fallback` text (`field.dataSource.fallback ?? '無'`). When no `dataSource` → existing static `field.options` path unchanged.
- [ ] TDD (`field-control.spec.tsx`): a `Select` with a `dataSource` + a resolving fake fetcher → after `waitFor`, the fetched options render (not the static ones); a rejecting fetcher → the fallback text shows. (radix Select popover isn't driven — assert the options exist in the DOM / the trigger/fallback text. For Radio the options are radios — assert count after load.) Keep existing FieldControl tests green.
- [ ] Build engine; `vitest:run`; `check-types`; commit `feat(form-builder-ui): dynamic Select/Radio options via dataSource`.

---

### Task 5: UI — `content` item display value via dataSource

**Files:** `packages/form-builder-ui/src/config-form.tsx`, `config-form.spec.tsx`.

- [ ] In `renderItem` for `kind === 'content'`: if `item.dataSource` is present, render a small `<DataSourceContent ds fetcher fallback />` subcomponent that uses `useDataSource` → shows the resolved `value` (String) when `ready`, a muted "Loading…" while loading, and the `fallback` on error/empty. Without `dataSource`, render the static `resolveLabel(text)` exactly as today.
- [ ] TDD: a content item with a `dataSource` + resolving fetcher → shows the fetched value; rejecting → shows fallback; no dataSource → shows the static text. Keep existing ConfigForm tests green.
- [ ] Build engine; `vitest:run`; `check-types`; commit `feat(form-builder-ui): content item shows external dataSource value`.

---

### Task 6: Builder — DataSource editor sub-block in `FieldRow`

**Files:** `packages/form-builder-ui/src/field-row.tsx`, `field-row.spec.tsx`.

- [ ] In `FieldItemEditor`, add a **Data source** sub-block (Inputs): `url`, `method` (Select GET/POST/…), `dialect` (Select path/jsonata), `expr`, `fallback`, and (for Select/Radio) `optionLabel`/`optionValue`. Each updates `onUpdate({ dataSource: { ...field.dataSource, request: {...}, extract: {...}, ... } })`. Empty `url` clears `dataSource` (→ undefined). Extract pure mergers (mirror `mergeValidation`) so the merge logic is unit-tested.
- [ ] TDD: editing the url sets `dataSource.request.url`; changing dialect sets `extract.dialect`; clearing url removes `dataSource`. (radix Select trigger-value assertions; the pure mergers unit-tested directly.) Keep existing FieldRow tests green.
- [ ] Build engine; `vitest:run`; `check-types`; commit `feat(form-builder-ui): add dataSource editor to FieldRow`.

---

### Task 7: Demo — inject a mock fetcher in apps/web + a dataSource field in the seed

**Files:** `apps/web/src/tools/form-builder/ui.tsx`.

- [ ] Provide a small **mock** `fetcher` (no network — returns canned JSON for a known url, e.g. a list of countries) and pass it to `<ConfigFormBuilder fetcher={...}>` (thread `fetcher` through `ConfigFormBuilder` → `ConfigForm` preview). Add one seed field (e.g. a `Select` "country") with a `dataSource` pointing at the mock url + `extract: { dialect:'path', expr:'data' }` + `optionLabel/optionValue`. (Thread a `fetcher?` prop through `ConfigFormBuilderProps` → the preview `<ConfigForm fetcher>`.)
- [ ] `check-types` for `apps/web`. Commit `feat(web): demo dataSource (mock fetcher) in the form-builder seed`.

---

## Self-Review

**Spec coverage (§4.8):** dataSource shape (request/extract/fallback) → T1; extraction path+jsonata + options mapping → T2; runtime fetch + loading/error/fallback → T3; dynamic Select/Radio options → T4; content display value → T5; pluggable fetcher (injected, never hardcoded) → T3/T4/T7; builder authoring → T6; demo → T7.

**Out of scope (documented):** `jsonpath` dialect (reserved, throws); dataSource-as-field-**default-value** (the spec's "可選" — deferred; options + content cover the main uses); the deferred visual/UX overhaul.

**Placeholder scan:** engine tasks have concrete signatures + tests. UI tasks specify the hook contract + the loading/error/fallback behavior + which assertions (radix not driven). No open TODOs.

**Type consistency:** `DataSource`/`DataSourceFetcher`/`FieldOption` names consistent across engine + UI. `extractValue`/`loadDataSource`/`toOptions` (T2) consumed by `useDataSource` (T3) consumed by FieldControl/ConfigForm (T4/T5). `fetcher` prop threaded `ConfigFormBuilder`→`ConfigForm`→`FieldControl`.

**Risk notes:** (1) jsonata `evaluate` is async → all extraction async; the hook must guard setState-after-unmount. (2) No-fetcher path must be inert, never throw. (3) radix Select dynamic options aren't driveable in jsdom → assert option presence in DOM + fallback text + unit-test the pure helpers. (4) `getByPath` returns `undefined` for missing paths → `toOptions` treats non-array as `[]` (→ fallback). (5) `@rfjs/object-utils`/`@rfjs/data-expr` added as engine deps (workspace).
