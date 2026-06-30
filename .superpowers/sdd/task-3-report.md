# Task 3 Report: ConfigForm Container-Responsive Collapse

## Status: DONE

**Commit:** `f1e2e2e feat(form-builder-ui): container-driven responsive collapse (ResizeObserver + stackBelow)`

---

## What Was Implemented

### Files Modified
- `packages/form-builder-ui/src/config-form.tsx` — implementation
- `packages/form-builder-ui/src/config-form.spec.tsx` — new responsive tests (4 cases in `responsive container collapse` describe block)

### Implementation Details

1. **Container ref + breakpoint hook** — added `rootRef` (`useRef<HTMLFormElement|null>`), `stackBelow = config.responsive?.stackBelow ?? 640`, and `narrow = useContainerBreakpoint(rootRef, stackBelow)` at the top of `ConfigForm`. Attached `ref={rootRef}` to the `<form>` element.

2. **Outer form grid** — replaced `className="grid grid-cols-1 gap-4 md:[…]"` (viewport-based) with `className="grid gap-4"` and moved columns to inline style: `gridTemplateColumns: narrow ? '1fr' : 'repeat(var(--form-cols), minmax(0, 1fr))'`. The `--form-cols` CSS custom property is kept.

3. **Grid-mode section grid** (where `section.layout` exists) — `gridTemplateColumns: narrow ? '1fr' : \`repeat(${layout.columns}, minmax(0, 1fr))\``. When narrow, items are sorted by `(row, colStart)` from the placement map (copy, no mutation) before mapping so single-column stack order equals visual reading order.

4. **Flow-section row grid** — `gridTemplateColumns: narrow ? '1fr' : \`repeat(${sectionCols}, minmax(0, 1fr))\``.

5. **Item-level style overrides** — `placementStyle` and `fieldSpanStyle` both accept an `isNarrow` boolean; when true they return `{ gridColumn: '1 / -1' }`. `renderItem` gains an `isNarrow = false` parameter, threaded through from every call site.

---

## TDD RED → GREEN

### RED phase
```
pnpm -F @rfjs/form-builder build && pnpm -F @rfjs/form-builder-ui vitest:run src/config-form.spec.tsx
```
Result: **3 failed | 39 passed** — new responsive tests failed as expected (grid still used viewport `md:` class, not container-driven logic).

### GREEN phase (after implementation)
```
pnpm -F @rfjs/form-builder-ui vitest:run src/config-form.spec.tsx
```
Result: **42 passed (42)** — all new + pre-existing tests pass.

### Full regression suite
```
pnpm -F @rfjs/form-builder-ui vitest:run
```
Result: **230 passed (230)** across 10 test files. All v1/linear/existing tests remain green.

---

## Self-Review

- **No viewport breakpoints remain** — the `md:[…]` arbitrary Tailwind variant has been fully removed. All responsiveness is now container-driven via `ResizeObserver`.
- **No mutation of `items` array** — grid-mode sort uses `[...allItems].sort(…)`.
- **`stackBelow` default 640** — matches spec §4 and brief.
- **v1 back-compat** — v1 `fields[]` path does not pass `isNarrow` to `renderItem` (uses default `false`), so v1 single-column forms are completely unaffected.
- **SSR-safe** — `useContainerBreakpoint` initialises `narrow=false`; no hydration mismatch risk.
- **`--form-cols` custom property preserved** — kept in the inline style map for downstream CSS targeting.

## Concerns

None. Implementation is straightforward, no ambiguous forks encountered, all 230 tests green.

---

## Review Findings Fix (post-implementation)

### Finding A — Orphaned-item sort fallback (Important)

**Resolution:** Changed `?? 0` to `?? Number.MAX_SAFE_INTEGER` for both `row` and `colStart` fallbacks in the narrow-mode sort inside `sortedGridItems` (`config-form.tsx` line 259). Items without a placement now sort to the end rather than floating to the top before all 1-indexed placed items.

**New test added:** `"orphaned items (no placement) sort after all placed items in narrow mode"` — a grid section with one placed item (row 1) and one orphan (no placement); after `fireWidth(400)` the placed item is first in the DOM.

### Finding B — Wide test never exercised narrow→wide restoration (Confirmed test gap)

**Resolution:** Rewrote the `"keeps multi-column layout when container is wide"` test to fire `fireWidth(400)` first (asserting `gridTemplateColumns === '1fr'`), then `fireWidth(900)` (asserting `repeat(` restored and item `gridColumn` is `'1 / span 7'`). The hook no longer bails without first crossing the narrow threshold.

### Finding C — Module-level `_roCb` shared state (Minor, test hygiene)

**Resolution:** Removed the module-level `_roCb` variable. `installResizeObserverMock()` now holds `roCb` as a closure variable and returns `{ fireWidth }`. All call sites inside `responsive container collapse` destructure `fireWidth` from the return value.

### Test command and result

```
pnpm -F @rfjs/form-builder-ui vitest:run src/config-form.spec.tsx
```
Result: **43 passed (43)** — 1 new test added (Finding A); Finding B and C were existing-test changes only.

```
pnpm -F @rfjs/form-builder-ui vitest:run
```
Result: **231 passed (231)** across 10 test files. No regressions.
