# Form Builder v2 Group 1 (rules: validation + conditional) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add field-level **validation rules** and **conditional display** to the config-driven form — engine + renderer + builder editors. These are field-level config extensions (no section/item-kind restructure — that's Group 2).

**Architecture:** `@rfjs/form-builder` gains `FieldConfig.validation` (→ `configToZod`) and `FieldConfig.conditional` (a `@rfjs/data-filter` filter group, evaluated via `compileMatchQuery`). `<ConfigForm>` displays validation messages and show/hides fields by conditional (watching form values). `FieldRow` gains Validation + Conditional sub-blocks.

**Tech Stack:** TypeScript, zod v4, react-hook-form, `@rfjs/data-filter`, @rfjs/web-ui, vitest jsdom.

## Global Constraints

- Field-level only — no `items[]`/section/rows restructure (Group 2). `FieldConfig` extends; `FormConfig.fields` stays.
- Validation maps to zod in `configToZod`: `min`/`max` (numeric), `minLength`/`maxLength` (string), `pattern` (regex on string), `message` (custom error). Applied on top of the existing base/required/optional logic — must not break the empty→undefined optional handling.
- Conditional = a `@rfjs/data-filter` filter group over the current form values; evaluate with `compileMatchQuery` (verify its exact signature/predicate shape in the package). Absent conditional → always shown.
- `<ConfigForm>` must keep its reactive-preview behaviour (no remount). Show/hide must not break field registration/validation for hidden fields (hidden fields should not block submit — exclude their validation when hidden).
- shadcn controls (Group v2-A standard). Co-locate `*.spec`. Conventional Commits; pre-commit passes. Fresh worktree → `pnpm install`.

---

### Task 1: Engine — `FieldConfig.validation` + `configToZod`
**Files:** `packages/form-builder/src/types.ts`, `config-schema.ts`, `config-to-zod.ts`, `config-to-zod.spec.ts`, `config-schema.spec.ts`.
- [ ] `pnpm install`.
- [ ] Add `FieldValidation` type + `FieldConfig.validation?: FieldValidation`:
```ts
export interface FieldValidation {
  min?: number; max?: number;        // numeric
  minLength?: number; maxLength?: number;  // string
  pattern?: string;                  // regex source, string fields
  message?: string;                  // custom error message
}
```
- [ ] Schema: validate `validation` (all optional; numbers; `pattern` string).
- [ ] `config-to-zod.ts`: apply validation to the per-field base BEFORE the required/optional wrap. For numeric: `.min(v.min, msg)` / `.max(v.max, msg)`. For string: `.min(v.minLength, msg)` / `.max(v.maxLength, msg)` / `.regex(new RegExp(v.pattern), msg)`. Keep `message` as the zod error message where given. Preserve the existing empty→undefined optional handling (apply validation to the base, then wrap).
- [ ] TDD: tests — numeric min/max reject out-of-range; string minLength/maxLength/pattern reject; `message` surfaces; an optional field with validation still omits on empty.
- [ ] `build` engine; `vitest:run` green; commit `feat(form-builder): add FieldConfig.validation and apply in configToZod`.

---

### Task 2: Renderer — show validation messages in `<ConfigForm>`
**Files:** `packages/form-builder-ui/src/config-form.tsx`, `config-form.spec.tsx`.
- [ ] Render `formState.errors[field.key]?.message` under each field (a `<p className="text-xs text-destructive">`). Use RHF's `formState` from `useForm`.
- [ ] TDD: a config with a required/min-length field → submit invalid → the error message renders; valid → no message. Keep existing tests green.
- [ ] `check-types`; commit `feat(form-builder-ui): render field validation messages`.

---

### Task 3: Builder — Validation sub-block in `FieldRow`
**Files:** `packages/form-builder-ui/src/field-row.tsx`, `field-row.spec.tsx`.
- [ ] In the expanded property editor, add a **Validation** sub-block: inputs for the fields relevant to the field's `dataType` (numeric → min/max; string/date → minLength/maxLength/pattern) + a `message` input. Each updates `onUpdate({ validation: { ...field.validation, [k]: v } })` (numbers parsed; empty clears the key). Use shadcn `Input`.
- [ ] TDD: editing a validation input calls `onUpdate` with the merged `validation`. Existing FieldRow tests green.
- [ ] `check-types`; commit `feat(form-builder-ui): add validation editor to FieldRow`.

---

### Task 4: Engine — `FieldConfig.conditional` + `evaluateConditional`
**Files:** `packages/form-builder/src/types.ts`, `config-schema.ts`, new `conditional.ts`, `conditional.spec.ts`, barrel.
- [ ] Add `conditional?: ConditionalRule` to `FieldConfig`, where `ConditionalRule` is a `@rfjs/data-filter` filter group (import its `FilterGroup`/query type; alias it). Schema validates it as the data-filter group shape (use a permissive object schema if data-filter exposes no zod — validate structurally: `{ logic, filters }`).
- [ ] `conditional.ts`: `export function evaluateConditional(rule: ConditionalRule | undefined, values: Record<string, unknown>): boolean` — `if (!rule) return true;` else use `@rfjs/data-filter`'s `compileMatchQuery(rule)` (VERIFY exact signature — it returns a predicate `(item)=>boolean` or similar) → `predicate(values)`. Add `@rfjs/data-filter` to `@rfjs/form-builder` deps (workspace).
- [ ] TDD: `evaluateConditional(undefined, {})===true`; a rule `{logic:'and',filters:[{field:'role',operator:'eq',value:'admin'}]}` returns true for `{role:'admin'}`, false otherwise. (Match the actual data-filter group/condition shape — read its types.)
- [ ] `build`; `vitest:run`; commit `feat(form-builder): add conditional rule + evaluateConditional (data-filter)`.

---

### Task 5: Renderer — conditional show/hide in `<ConfigForm>`
**Files:** `packages/form-builder-ui/src/config-form.tsx`, `config-form.spec.tsx`.
- [ ] Use RHF `watch()` to get current values; for each field with `conditional`, render only when `evaluateConditional(field.conditional, values)` is true. Hidden fields must NOT block submit — when building the resolver, exclude hidden fields' validation (e.g. `configToZod` over only-visible fields, recomputed from watched values) OR mark hidden fields optional. Simplest robust approach: compute visible fields from watched values and pass a `{ ...config, fields: visibleFields }` to a memoized resolver + render only visible.
- [ ] TDD: a field with `conditional` shows/hides as a controlling field's value changes; a hidden required field does not block submit.
- [ ] `check-types`; commit `feat(form-builder-ui): conditional field show/hide in ConfigForm`.

---

### Task 6: Builder — Conditional sub-block in `FieldRow` (simplified editor)
**Files:** `packages/form-builder-ui/src/field-row.tsx`, `field-row.spec.tsx`.
- [ ] Add a **Conditional display** sub-block: a mode toggle (shadcn) "Always" | "When…"; when "When…", a small list of condition rows `[field-select(other fields) · operator-select · value-input]` (shadcn) building a `{ logic: 'and', filters: [{field, operator, value}, …] }` data-filter group → `onUpdate({ conditional })`. "Always" → `onUpdate({ conditional: undefined })`. `FieldRow` needs the list of other field keys — pass `siblingFields` (key + label) from `ConfigFormBuilder`.
- [ ] TDD: switching to "When…" + setting a condition calls `onUpdate` with the expected group; "Always" clears it. Use shadcn-trigger-value assertions (radix not driven in jsdom) + the test-only radix shim already present.
- [ ] In `config-form-builder.tsx`: pass `siblingFields={builder.config.fields.filter(f=>f.key!==field.key).map(f=>({key:f.key,label:f.label}))}` to each `FieldRow`.
- [ ] `check-types`; commit `feat(form-builder-ui): add conditional editor to FieldRow`.

---

## Self-Review
**Spec coverage:** Group 1 = v2-B validation (T1 engine, T2 render, T3 editor) + v2-C conditional (T4 engine, T5 render, T6 editor). No item-kind/section restructure (Group 2). dataSource/more-types (Group 3) excluded.
**Placeholder scan:** engine tasks have concrete zod/eval code; the conditional editor + `compileMatchQuery` signature are flagged "verify exact data-filter shape" (real API to confirm at impl, not open TODOs).
**Risk notes:** (1) hidden-field-must-not-block-submit — Task 5 recomputes resolver over visible fields. (2) `compileMatchQuery` exact API — Task 4 verifies. (3) radix editors — trigger-value assertions + existing shim. (4) validation must not break the empty→undefined optional handling in configToZod — Task 1 applies validation to the base before the optional wrap.
