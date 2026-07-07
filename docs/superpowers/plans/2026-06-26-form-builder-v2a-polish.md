# Form Builder v2-A (polish + shadcn controls) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix the rough edges that made v1 feel unfinished — kill the live-preview flicker, replace the builder's native `<select>` controls with shadcn `Select`, and give the tool a seeded/framed first-run instead of a barren empty box.

**Architecture:** Touches `@rfjs/form-builder-ui` (`ConfigForm` preview-reactivity, `FieldRow`/`ConfigFormBuilder` shadcn controls + framing/empty-state) and `apps/web/src/tools/form-builder/ui.tsx` (seed a sample config). No engine/model change (v2-A is polish only; the item-kind model lands later).

**Tech Stack:** React 19, react-hook-form, @dnd-kit, @rfjs/web-ui (shadcn Select), vitest jsdom, @testing-library/react.

## Global Constraints

- v2-A is **polish only** — no config-model changes (no items/sections/validation yet).
- All existing tests must stay green (or be deliberately adapted where a native control becomes a shadcn one — documented in the task).
- shadcn `Select` (radix) replaces native `<select>` for type / width / columns. radix Select is hard to drive in jsdom — **test the value rendering + the `onValueChange` handler wiring, not the radix popover open/click**.
- Co-locate `*.spec.tsx`. Conventional Commits; pre-commit passes (no `--no-verify`). Fresh worktree → `pnpm install`.

---

### Task 1: Live preview without remount flicker

**Problem:** the builder preview is `<ConfigForm key={JSON.stringify(builder.config)} …>` — it remounts on every keystroke → flicker. `ConfigForm` reads `config` once at mount (react-hook-form doesn't re-init from a changed resolver), which is why the key hack exists.

**Files:** `packages/form-builder-ui/src/config-form.tsx`, `config-form.spec.tsx`; `config-form-builder.tsx` (drop the `key`).

- [ ] **Step 1:** `pnpm install`.
- [ ] **Step 2 — make `ConfigForm` reactive to `config`.** Add an effect that re-initialises the form when `config` changes, and recompute the resolver, so the preview updates in place (no remount):
  - Keep `resolver = useMemo(() => zodResolver(configToZod(config)), [config])`.
  - Use `const form = useForm({ resolver, defaultValues })`.
  - Add `React.useEffect(() => { form.reset(defaultValues ?? {}); }, [config]);` so changing `config` resets fields cleanly (RHF picks up the new field set on the next render; the resolver memo already tracks `config`).
  - Verify validation still reflects the latest `config` (zodResolver is read per-submit by RHF v7 via the resolver reference held at mount — if validation does NOT track the new resolver, fall back to keying ConfigForm on a **structure signature** instead of full JSON: `key={config.fields.map(f=>f.key+f.component+(f.width??'')).join('|')+':'+(config.columns??1)}` so label keystrokes don't remount but structural edits do). Pick whichever the tests prove correct; document the choice.
- [ ] **Step 3 — drop the JSON key in the builder.** In `config-form-builder.tsx`, change `<ConfigForm key={JSON.stringify(builder.config)} …>` to no key (or the structure-signature key from Step 2 fallback).
- [ ] **Step 4 — test.** Add a `config-form.spec.tsx` test: render `<ConfigForm>`, rerender with a changed `config` (added field), assert the new field's label appears WITHOUT a full remount losing identity — e.g. assert the new field renders and an existing field's input node is the same element across rerender (`rerender()` from testing-library; compare `getByLabelText` node identity, or simply assert the updated field set renders). Keep existing ConfigForm tests green.
- [ ] **Step 5:** `pnpm -F @rfjs/form-builder-ui vitest:run` + `check-types` clean. Commit: `fix(form-builder-ui): make ConfigForm preview reactive (no remount flicker)`.

---

### Task 2: shadcn `Select` for builder controls

**Files:** `packages/form-builder-ui/src/field-row.tsx` (type, width), `config-form-builder.tsx` (columns), their specs.

- [ ] **Step 1 — swap controls.** Replace the native `<select>` for **type** and **width** in `FieldRow`, and **columns** in `ConfigFormBuilder`, with `@rfjs/web-ui` `Select` (`Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`). Keep an accessible name on the trigger (e.g. `aria-label={\`type for ${field.key}\`}` on `SelectTrigger`) and the same `onValueChange → onUpdate({...})` / `setColumns` wiring + remap logic (`changeComponent` unchanged).
- [ ] **Step 2 — adapt the tests.** The old tests used `fireEvent.change(getByLabelText('type for name'), {value:'Select'})` against a native select — that won't work on radix. Replace those assertions with: (a) the trigger renders the current value (`getByLabelText('type for name')` shows "Select"/"Input"); and (b) the change wiring is exercised by calling the rendered `SelectItem`'s path is NOT reliable in jsdom — instead, extract the change logic so it's unit-testable, OR assert via a thin handler. Concretely: assert the trigger shows the right current value and that `SelectContent` lists the options; do NOT assert a radix open+click. Keep `label`/`required`/`remove`/`key`/per-locale tests (those controls are unchanged) green.
- [ ] **Step 3 — guard radix in jsdom.** Add a minimal jsdom shim in the spec setup if radix Select needs it (`Element.prototype.hasPointerCapture`, `scrollIntoView`) so rendering the trigger doesn't throw; keep the shim test-only.
- [ ] **Step 4:** tests green; `check-types` clean. Commit: `feat(form-builder-ui): use shadcn Select for builder controls (type/width/columns)`.

---

### Task 3: seeded, framed first-run + empty state

**Files:** `config-form-builder.tsx` + spec; `apps/web/src/tools/form-builder/ui.tsx`.

- [ ] **Step 1 — empty state.** In `ConfigFormBuilder`, when `builder.config.fields.length === 0`, render an empty-state hint inside the list area ("No fields yet — add one from the palette above") instead of an empty preview with a lone Submit. Hide/condense the preview's submit row when there are no fields.
- [ ] **Step 2 — framing/polish.** Wrap the field-list + preview each in a clearer panel (`rounded-lg border bg-card p-…`), tighten spacing, give the toolbar a clear grouping. Keep it minimal (no new deps).
- [ ] **Step 3 — seed sample in the web tool.** In `apps/web/src/tools/form-builder/ui.tsx`, pass an `initialConfig` with a small sample (e.g. Name/Email/Role) so the tool is alive on load rather than empty. Keep `locales={['en','zh-TW']}`.
- [ ] **Step 4 — test.** `config-form-builder.spec.tsx`: with an empty config, the empty-state hint renders; with fields, it does not. Existing add/remove/preview tests green.
- [ ] **Step 5:** `pnpm -F @rfjs/form-builder-ui vitest:run` + `pnpm -F web vitest:run` (build packages first) + `check-types` clean. Commit: `feat(form-builder-ui): seeded/framed first-run and empty state`.

---

## Self-Review

**Spec coverage:** v2-A (spec §5 + §4.5) = preview-flicker fix (T1), shadcn controls (T2), seeded/framed/empty-state (T3). No model change — validation/conditional/sections/blocks/dataSource are later phases.

**Placeholder scan:** T1 and T2 carry explicit fallback strategies (structure-signature key; value+wiring assertions) because RHF-reactivity and radix-in-jsdom are genuinely environment-dependent — the implementer picks the approach the tests prove and documents it. These are bounded decisions, not open TODOs.

**Risk notes:** (1) RHF resolver reactivity — if `form.reset` + memo'd resolver doesn't make validation track new config, use the structure-signature key (still kills per-keystroke flicker). (2) radix Select testing — assert trigger value + option list, not popover interaction; shim pointer APIs test-only. Both are flagged for the implementer.
