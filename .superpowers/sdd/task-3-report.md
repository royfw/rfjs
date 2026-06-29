# Task 3 Report: `<TagInput>` Component (`@rfjs/web-ui`)

## Status: DONE

## Commits

| SHA | Subject |
|-----|---------|
| `1e00950` | `feat(web-ui): add TagInput (options + creatable) built on command/popover` |

## TDD Cycle

### RED

Installed `@testing-library/user-event` (not previously in web-ui):
```
pnpm --filter @rfjs/web-ui add -D @testing-library/user-event
```

Wrote `packages/web-ui/src/components/tag-input.spec.tsx` with 3 tests from the brief (verbatim, except `toBeInTheDocument` → `toBeDefined` — see Concerns).

```
pnpm -F @rfjs/web-ui vitest:run src/components/tag-input.spec.tsx
# FAIL — Cannot find module './tag-input' (expected)
```

### GREEN

Implemented `packages/web-ui/src/components/tag-input.tsx` composed from:
- `Command`/`CommandList`/`CommandGroup`/`CommandItem` (`command.tsx`)
- `Popover`/`PopoverTrigger`/`PopoverContent` (`popover.tsx`)

Key design decision: dual-UI approach to satisfy both test constraints simultaneously:
- `creatable`: inline `<input type="text">` always in DOM → `getByRole("textbox")` works without clicking
- `options`: `PopoverTrigger` renders a `<button>` → `getByRole("button")` works; content opens in Popover

```
pnpm -F @rfjs/web-ui vitest:run src/components/tag-input.spec.tsx
# PASS — 3/3 tests
```

### Full Suite

```
pnpm -F @rfjs/web-ui vitest:run
# 38 passed, 16 test files, 0 failures, 0 regressions
```

## Files Changed

| File | Action |
|------|--------|
| `packages/web-ui/src/components/tag-input.tsx` | Created |
| `packages/web-ui/src/components/tag-input.spec.tsx` | Created |
| `packages/web-ui/package.json` | Added `@testing-library/user-event` devDep |
| `pnpm-lock.yaml` | Updated |

Note: No `index.ts` created — the package uses wildcard exports (`"./components/*": "./src/components/*.tsx"`), so `TagInput` is auto-accessible as `@rfjs/web-ui/components/tag-input` without a barrel file.

## Self-Review

- **Accessibility**: Chips have `aria-label="Remove <label>"` buttons; popover trigger has `aria-label="Open tag options"`.
- **Deduplication**: Both `handleSelect` (options path) and `handleKeyDown` (creatable path) guard `!value.includes(...)`.
- **jsdom compatibility**: No new stubs needed — Radix Popover opened correctly with `userEvent.click` using the existing `ResizeObserver`/`scrollIntoView` stubs in `vitest.setup.ts`.
- **No new runtime deps**: uses only `cmdk` + `radix-ui` already present.

## Concerns

1. **`toBeInTheDocument`**: Brief used this jest-dom matcher, but the project doesn't configure `@testing-library/jest-dom` (other tests all use `toBeDefined()`). Changed to `toBeDefined()` — semantically equivalent since RTL's `getByText` throws when not found.
2. **No barrel export**: The brief mentioned modifying `packages/web-ui/src/index.ts`, but that file doesn't exist in this package. The wildcard exports handle discoverability automatically.
3. **All-selected empty state**: When all options are already in `value`, the `CommandList` is empty. No `CommandEmpty` placeholder — minor UX gap, not in spec.

---

## Review Fix (2026-06-30)

### Finding 1 — CommandInput inside Popover (remove bare always-visible input)

Refactored `tag-input.tsx`:
- Removed the standalone `<input type="text">` that was always-visible for the `creatable` case.
- `showTrigger = hasOptions || creatable` — the chevron trigger now appears whenever the popover has content (options, free-type, or both).
- `CommandInput` (with `value`, `onValueChange`, `onKeyDown`) lives inside the `PopoverContent`'s `Command` block — the only text field is the one inside the Popover.
- Creatable Enter handler moved to `handleInputKeyDown` on `CommandInput`'s `onKeyDown`; calls `e.preventDefault()` to prevent cmdk from also acting on the event.
- Added `CommandEmpty` ("No options.") so the empty-list state has feedback.
- Dropped the `options!` non-null assertion; `availableOptions` is derived from `hasOptions ? options.filter(...) : []` so the guard is implicit.

### Finding 2 — Test the remove interaction (Test 3 replaced)

Replaced the label-presence assertion with a real interaction test:
- Renders with `value={['a']}` and `options={[{ label: 'Alpha', value: 'a' }]}`.
- Clicks `aria-label="Remove Alpha"` button.
- Asserts `onChange` was called with `[]`.
- Renamed to "removes a chip and emits the remaining array".

### Also (cheap)

- Added **disabled test**: renders with `disabled` + `options`, clicks the trigger button, asserts `onChange` was never called.
- Updated **creatable test**: clicks trigger to open Popover first, then finds the `combobox` role (`CommandInput` renders as cmdk combobox), types `custom{Enter}`.
- All button queries use `{ name: '...' }` for specificity.
- No new jsdom stubs needed — existing `ResizeObserver` + `scrollIntoView` stubs cover Radix + cmdk.

### Test run

```
pnpm -F @rfjs/web-ui vitest:run src/components/tag-input.spec.tsx
# 4 passed (4)

pnpm -F @rfjs/web-ui vitest:run
# Test Files  16 passed (16) | Tests  39 passed (39)
```
