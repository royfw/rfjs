# Form Builder v2-E (more field types + shadcn DatePicker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add more input types to the config-driven form — **Number, Email, Switch, Radio** — and upgrade `Date` to a real **shadcn DatePicker** (Calendar-in-Popover), adding the missing `@rfjs/web-ui` primitives (Switch, RadioGroup, Calendar).

**Architecture:** New `@rfjs/web-ui` shadcn components (Switch, RadioGroup via the unified `radix-ui` package; Calendar via `react-day-picker`). The engine `FieldComponent` union gains the new kinds with a `dataType` mapping; `configToZod` validates them (Number→numeric, Switch→boolean, Email→string+regex). `<FieldControl>` renders each; the builder's type `Select` offers them. Back-compat: existing `Input/Textarea/Select/Checkbox/Date` configs render unchanged (`Date` still parses; `DatePicker` is the new richer date control).

**Tech Stack:** TypeScript, zod v4, react-hook-form, `radix-ui`, `react-day-picker` (new), `@rfjs/web-ui`, vitest jsdom.

## Global Constraints

- **Back-compat:** existing configs (any current `component`) parse/validate/render unchanged. New components are additive.
- shadcn idiom for web-ui components: `'use client'`, `import { X as XPrimitive } from 'radix-ui'`, `cn()` from `../lib/utils`, semantic tokens, `data-slot`, `export { X }`. Consumed deep: `@rfjs/web-ui/components/<name>`.
- Engine builds to dist; UI exports source. In a fresh worktree build the engine (`pnpm -F "@rfjs/form-builder..." build`) before UI tests that import it. `@rfjs/web-ui` is source-consumed by form-builder-ui via the workspace.
- radix Switch/RadioGroup ARE driveable in jsdom (click → callback); radix Select + the Calendar popover are NOT — test trigger/value + handler, not the popup (reuse the jsdom pointer-capture shims already in the UI specs).
- Co-locate `*.spec`. Conventional Commits (header ≤100 chars). pre-commit (`turbo run lint-staged test --affected`) passes. No `--no-verify`. **No changeset.**

## File Structure

- `packages/web-ui/src/components/switch.tsx` (+ `.spec.tsx`) — create
- `packages/web-ui/src/components/radio-group.tsx` (+ `.spec.tsx`) — create
- `packages/web-ui/src/components/calendar.tsx` — create; `packages/web-ui/package.json` (+ `react-day-picker` dep)
- `packages/form-builder/src/types.ts`, `config-schema.ts`, `config-to-zod.ts` (+ specs) — modify
- `packages/form-builder-ui/src/field-control.tsx` (+ `.spec.tsx`) — modify (render new types + DatePicker)
- `packages/form-builder-ui/src/field-row.tsx` — modify (`DATATYPE_BY_COMPONENT`, `COMPONENTS` list)

---

### Task 1: web-ui — `Switch`

**Files:** Create `packages/web-ui/src/components/switch.tsx`, `switch.spec.tsx`.

**Interfaces:** Produces `Switch` (props = `React.ComponentProps<typeof SwitchPrimitive.Root>`), default export style `export { Switch }`. Consumed as `@rfjs/web-ui/components/switch`.

- [ ] **Step 1: Implement** (mirror `checkbox.tsx`):

```tsx
'use client';
import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from '../lib/utils';

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-colors outline-none',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform',
          'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
export { Switch };
```

- [ ] **Step 2: Write the test** `switch.spec.tsx` (radix Switch is a button — driveable):

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from './switch';

it('toggles via onCheckedChange', () => {
  const onCheckedChange = vi.fn();
  render(<Switch aria-label="x" checked={false} onCheckedChange={onCheckedChange} />);
  fireEvent.click(screen.getByRole('switch'));
  expect(onCheckedChange).toHaveBeenCalledWith(true);
});
```

- [ ] **Step 3: Run** `pnpm -F @rfjs/web-ui vitest:run switch` → PASS.
- [ ] **Step 4: Commit** `feat(web-ui): add Switch component`.

---

### Task 2: web-ui — `RadioGroup`

**Files:** Create `packages/web-ui/src/components/radio-group.tsx`, `radio-group.spec.tsx`.

**Interfaces:** Produces `RadioGroup` (= `RadioGroupPrimitive.Root`) and `RadioGroupItem` (= styled `RadioGroupPrimitive.Item` with an `Indicator`). Consumed as `@rfjs/web-ui/components/radio-group`.

- [ ] **Step 1: Implement** (radix `RadioGroup`, shadcn style; `RadioGroupItem` renders a `Circle`/dot indicator from lucide). Root: `className grid gap-2`. Item: `aspect-square size-4 rounded-full border border-input ... data-[state=checked]` + `<RadioGroupPrimitive.Indicator>` with a filled dot.
- [ ] **Step 2: Write the test** (radio items are buttons — driveable): render a `RadioGroup` with two `RadioGroupItem`s + labels; click one → `onValueChange` called with its value.
- [ ] **Step 3: Run** `pnpm -F @rfjs/web-ui vitest:run radio-group` → PASS.
- [ ] **Step 4: Commit** `feat(web-ui): add RadioGroup component`.

---

### Task 3: web-ui — `Calendar` (+ `react-day-picker`)

**Files:** Create `packages/web-ui/src/components/calendar.tsx`; modify `packages/web-ui/package.json` (add `"react-day-picker": "^9.0.0"`).

**Interfaces:** Produces `Calendar` (props = `React.ComponentProps<typeof DayPicker>`), shadcn-styled wrapper over `react-day-picker`'s `DayPicker`. Consumed as `@rfjs/web-ui/components/calendar`.

- [ ] **Step 1:** Add `react-day-picker` to `packages/web-ui/package.json` dependencies; `pnpm install`.
- [ ] **Step 2: Implement** the shadcn Calendar wrapper over `DayPicker` (mode passthrough; `className`/`classNames` styled with tokens + `buttonVariants` from `./button` for nav; import `react-day-picker/style.css` is NOT needed — use the classNames map). Keep it pragmatic: single-month, navigation chevrons (lucide `ChevronLeft`/`ChevronRight`), selected day uses `bg-primary text-primary-foreground`, today `bg-accent`.
- [ ] **Step 3: Write a smoke test** `calendar.spec.tsx`: renders `<Calendar mode="single" />` and shows a day grid (e.g., a `grid`/`role="grid"` or a known day number is present). (Calendar interaction is exercised at the FieldControl level / manual; jsdom + react-day-picker rendering is enough for a smoke test.)
- [ ] **Step 4: Run** `pnpm -F @rfjs/web-ui vitest:run calendar` → PASS. `pnpm -F @rfjs/web-ui check-types` clean.
- [ ] **Step 5: Commit** `feat(web-ui): add Calendar (react-day-picker)`.

---

### Task 4: engine — new `FieldComponent`s + dataType map + schema + configToZod

**Files:** `packages/form-builder/src/types.ts`, `config-schema.ts`, `config-to-zod.ts` (+ specs).

**Interfaces:**
- Produces: `FieldComponent = 'Input' | 'Textarea' | 'Select' | 'Checkbox' | 'Date' | 'Number' | 'Email' | 'Switch' | 'Radio' | 'DatePicker'`.
- dataType mapping (used by the builder + render): Number→`numeric`, Switch→`boolean`, Radio→`string`, Email→`string`, DatePicker→`date` (Date stays `date`).

- [ ] **Step 1:** Extend `FieldComponent` in `types.ts` with `'Number' | 'Email' | 'Switch' | 'Radio' | 'DatePicker'`.
- [ ] **Step 2:** `config-schema.ts`: extend the `component` enum to include the 5 new values (in BOTH the v1 `fieldConfigSchema` and the v2 `fieldItemSchema` — they share `fieldConfigSchema`, so one change).
- [ ] **Step 3 (TDD):** `config-to-zod.spec.ts` — add: an `Email` field rejects a non-email string and accepts a valid one (Email → `z.string()` with `.email()` / a regex; respect existing `validation` + required/optional wrap); a `Number` field coerces/validates numeric; a `Switch` field validates boolean. Write failing tests first.
- [ ] **Step 4:** Implement in `config-to-zod.ts`: in `baseForField`, branch on `component` where it changes the base — `Email` → `z.string()` then (in `fieldSchema`/`applyValidation`) apply an email check; `Number` → numeric base (same as dataType numeric); `Switch` → boolean base. Keep options-driven enum logic (Radio with options → enum, like Select). Easiest: drive base off `dataType` (already mapped) + add an email refinement when `component === 'Email'`.
- [ ] **Step 5:** Build engine; `pnpm -F @rfjs/form-builder vitest:run` green. Commit `feat(form-builder): add Number/Email/Switch/Radio/DatePicker components`.

---

### Task 5: UI — `<FieldControl>` renders the new components

**Files:** `packages/form-builder-ui/src/field-control.tsx`, `field-control.spec.tsx`.

**Interfaces:** Consumes web-ui `Switch`, `RadioGroup`/`RadioGroupItem`, `Calendar`, `Popover`. Renders each `component`.

- [ ] **Step 1 (TDD):** `field-control.spec.tsx` — add tests:
  - `Number` → `<input type="number">`; editing calls `onChange`.
  - `Email` → `<input type="email">`.
  - `Switch` → a `role="switch"`; toggling calls `onChange(true/false)`.
  - `Radio` → renders one radio per option; selecting calls `onChange(value)`.
  - `DatePicker` → renders a trigger button showing the value/placeholder (calendar popup not driven in jsdom — assert the trigger).
  Write failing first.
- [ ] **Step 2:** Implement the new `case`s in `FieldControl`:
  - `Number`: `<Input type="number" .../>` (onChange passes the value; keep string like Input — configToZod coerces).
  - `Email`: `<Input type="email" .../>`.
  - `Switch`: `<Switch checked={Boolean(value)} onCheckedChange={(c) => onChange(c === true)} />`.
  - `Radio`: `<RadioGroup value={String(value ?? '')} onValueChange={onChange}>` mapping `field.options` to `RadioGroupItem` + `Label`.
  - `DatePicker`: a `Popover` with a `Button` trigger (shows `value` or placeholder) + `<Calendar mode="single" selected={...} onSelect={(d) => onChange(d ? toISO(d) : '')} />`. Store the value as an ISO `yyyy-mm-dd` string (consistent with `Date`/`dataType:'date'`).
  - Keep all existing cases unchanged.
- [ ] **Step 3:** Build engine; `pnpm -F @rfjs/form-builder-ui vitest:run` green; `check-types` clean. Commit `feat(form-builder-ui): render Number/Email/Switch/Radio/DatePicker in FieldControl`.

---

### Task 6: builder — expose the new types

**Files:** `packages/form-builder-ui/src/field-row.tsx`, `field-row.spec.tsx`.

**Interfaces:** Consumes the engine `FieldComponent`. Updates `COMPONENTS` (the type `Select` options) and `DATATYPE_BY_COMPONENT`.

- [ ] **Step 1:** Add the 5 new components to `COMPONENTS` and to `DATATYPE_BY_COMPONENT` (`Number:'numeric'`, `Email:'string'`, `Switch:'boolean'`, `Radio:'string'`, `DatePicker:'date'`). Ensure `Radio` (like `Select`) keeps/initialises `options` on `changeComponent` (a Radio without options is useless) — extend the `component === 'Select'` options-preserving branch to also cover `'Radio'`.
- [ ] **Step 2 (TDD):** `field-row.spec.tsx` — the type `Select` trigger lists the new options (trigger-value / option-presence assertion via the existing radix shim); changing to `Switch` sets `dataType:'boolean'` (assert `onUpdate` patch), changing to `Radio` keeps `options`.
- [ ] **Step 3:** Build engine; `pnpm -F @rfjs/form-builder-ui vitest:run` green; `check-types` clean. Commit `feat(form-builder-ui): offer new field types in the builder type picker`.

---

## Self-Review

**Spec coverage (§4.6–4.7):** more types (Number/Email/Switch/Radio) → Tasks 4,5,6. shadcn DatePicker (Calendar+Popover) → Tasks 3,5. web-ui Switch/RadioGroup/Calendar → Tasks 1,2,3.

**Out of scope (v2-G / Group 3b, next PR):** external `dataSource` (fetch → extract → fallback) — NOT here. Free 2D canvas, registry distribution — later. The deferred visual/UX overhaul — separate.

**Placeholder scan:** component code is concrete for Switch; RadioGroup/Calendar follow the shadcn idiom (concrete structure given, exact classNames at impl per the checkbox/button precedent). Engine + FieldControl tasks have concrete tests + render code.

**Type consistency:** `FieldComponent` literals identical across types.ts / config-schema / DATATYPE_BY_COMPONENT / FieldControl cases. DatePicker stores an ISO date string (same shape as `Date`), so `dataType:'date'` + `configToZod` string handling is unchanged.

**Risk notes:** (1) `react-day-picker` v9 API (DayPicker props/classNames) — verify at impl; keep Calendar pragmatic. (2) radix Switch/RadioGroup are driveable in jsdom (good coverage); DatePicker popover is not (assert trigger). (3) Email validation must compose with existing `validation` + required/optional wrap in configToZod — apply as an added refinement, don't replace the base. (4) web-ui is source-consumed — no build needed for it, but the engine must be built before UI tests.
