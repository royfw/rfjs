# data-filter object / array / elemmatch dataTypes (Track A) Design

**Status:** Approved (brainstorming) — pending spec review → implementation plan.
**Date:** 2026-06-11

## Overview

Add three new dataTypes to `@rfjs/data-filter`'s in-memory matcher: **`object`** (whole-object
match), **`array`** (array of scalars), and **`array` + `elementType: 'object'`** (`elemmatch`,
array of objects). The change is **purely additive** — existing scalar conditions, `resolvePath`
/ jsonpath, and the published scalar API are untouched.

Vocabulary (dataType names, operator names, `LogicalOperator`) is kept **aligned** with
`@rfjs/jsonb-query` where it is free; **semantics are in-memory-natural**, NOT forced to match
jsonb-query result-for-result.

## Goals / Non-goals

**Goals**
- Explicit, unambiguous in-memory matching for object values, scalar arrays, and arrays of objects.
- Replace the implicit, runtime-shape-dependent, operator-dependent ∀/∃ behavior of the
  wildcard-on-scalar path with an explicit, declared `array` dataType.

**Non-goals (decided in brainstorming)**
- **Not** result-for-result parity with `jsonb-query` — already impossible (array `eq` ∀ vs ∃,
  three-valued NULL logic, empty-group divergence). Align vocabulary, keep semantics independent.
- **No** shared `@rfjs/filter-types` package (would couple release cycles of two
  differently-natured tools).
- **No** package rename; **no** change to existing scalar matchers or the wildcard-on-scalar
  legacy path (that stays as-is, documented).

## Locked decisions

1. **`object contains` = recursive object containment, leaf/array values by deep-equal.** For
   each key `k` in `value`: `target` must have `k`, and `contains(target[k], value[k])` — which
   recurses for plain-object values and is **strict deep-equal** for everything else (so
   `null ≠ false`, no coercion). Mirrors Postgres `@>` for the object case. **Array values are
   compared by exact deep-equal, NOT element-containment** (documented difference from `@>`).
2. **`array neq` is excluded** for every `elementType` (∀/∃ ambiguity); "does not contain" is
   `{ logic: 'not', filters: [ <array eq> ] }`.
3. **`date` `containsall` is allowed in-memory** (compares timestamps, no ISO-text limitation
   that made jsonb-query reject it). **`boolean` has no `containsall`** (low value).
4. **Non-array stored value** on a `dataType: 'array'` condition → treated as an empty array →
   no match (forgiving; not thrown). Throwing is reserved for invalid *operators* (developer
   error), per the Task-8 precedent.
5. **`array` conditions are discriminated by `elementType`** for compile-time operator safety,
   plus a runtime `assertOperator` extension for JS callers.
6. **`elemmatch` supports nested groups and nested elemmatch** — free via recursion into
   `matchQuery`.

## Metadata (added to the `MatchQueryMetadata` union)

```ts
// --- object ---
export type ObjectFilterOperator = 'eq' | 'neq' | 'contains' | 'isnull' | 'isnotnull';
export interface ObjectCondition {
  field: string;
  dataType: 'object';
  operator: ObjectFilterOperator;
  value?: Record<string, unknown>; // required for eq/neq/contains; omitted for isnull/isnotnull
}

// --- array of scalars (discriminated by elementType) ---
export type StringArrayOperator =
  | 'eq' | 'contains' | 'startswith' | 'endswith' | 'terms'
  | 'containsall' | 'isnull' | 'isnotnull';
export type NumericArrayOperator =
  | 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'range' | 'terms'
  | 'containsall' | 'isnull' | 'isnotnull';
export type DateArrayOperator =
  | 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'range' | 'terms'
  | 'containsall' | 'isnull' | 'isnotnull';
export type BooleanArrayOperator = 'eq' | 'isnull' | 'isnotnull';

export interface StringArrayCondition {
  field: string; dataType: 'array'; elementType: 'string';
  operator: StringArrayOperator; value?: ValueType;
}
export interface NumericArrayCondition {
  field: string; dataType: 'array'; elementType: 'numeric';
  operator: NumericArrayOperator; value?: ValueType;
}
export interface DateArrayCondition {
  field: string; dataType: 'array'; elementType: 'date';
  operator: DateArrayOperator; value?: ValueType;
}
export interface BooleanArrayCondition {
  field: string; dataType: 'array'; elementType: 'boolean';
  operator: BooleanArrayOperator; value?: ValueType;
}

// --- array of objects (elemmatch) ---
export interface ElemMatchCondition {
  field: string; dataType: 'array'; elementType: 'object';
  operator: 'elemmatch';
  filters: FilterMatchQuery; // applied per element; sub-fields are relative to the element
}

export type MatchQueryMetadata =
  | StringCondition | NumericCondition | DateCondition | BooleanCondition // existing, unchanged
  | ObjectCondition
  | StringArrayCondition | NumericArrayCondition | DateArrayCondition | BooleanArrayCondition
  | ElemMatchCondition;
```

(The exact union/interface split is the plan's concern; the contract above is what matters.)

## Semantics

### object — `ObjectMatch`
Resolve `field` → value (expected: an object).
- `eq` / `neq`: `deepEqual(value, target)` / its negation. `deepEqual` = strict structural
  equality (primitives `===`; `Date` by `getTime`; arrays by length + element-wise; plain
  objects by same keys + recursive). `NaN`/`null`/`false`/`0`/`''` are all distinct.
- `contains`: recursive containment as defined in decision #1.
- `isnull` / `isnotnull`: field missing or `null`.
- Non-object target on `eq`/`contains` → no match.

### array (scalar elementType) — `ArrayMatch`
Resolve `field` → array (non-array / missing → empty → no match).
- Element operators (`eq`, `contains`, `startswith`, `endswith`, `gt`, `gte`, `lt`, `lte`,
  `range`, `terms` per `elementType`): **∃** — `array.some(el => <scalar match>(el, op, value))`,
  reusing the existing scalar matchers' per-element comparison.
- `containsall` (string/numeric/date): every value in the `value` array is present in the array.
- `isnull` / `isnotnull`: the array **field** itself.
- `neq`: excluded (decision #2).

### array of objects — `elemmatch`
Resolve `field` → array (non-array / empty / missing → no match).
- `array.some(element => matchQuery(element, condition.filters))` — each element runs through the
  existing recursive matcher; sub-`field`s are relative to the element. Nested `and`/`or`/`nor`/
  `not` and nested `elemmatch` work via the recursion with no special-casing.

## Architecture / files

- **New:** `src/match/ObjectMatch.ts` (with `deepEqual` + `contains` helpers, kept in a small
  `src/match/objectCompare.ts` so they are unit-testable in isolation), `src/match/ArrayMatch.ts`.
- **Modify:** `src/filter/matchQuery.ts` — `createMatchQuery` switch gains `case 'object'` and
  `case 'array'` (which dispatches by `elementType`: scalar → `ArrayMatch`, `'object'` →
  elemmatch). Existing scalar cases unchanged.
- **Modify:** `src/match/operators.ts` — add `OBJECT_OPERATORS` and per-`elementType` array
  allow-lists; extend the `assertOperator` guard so an operator invalid for the
  (dataType, elementType) throws (consistent with the existing scalar guard).
- **Modify:** `src/types/filter.ts` — add the interfaces above to the union.
- **Import-cycle note:** `elemmatch` must call `matchQuery`, but `matchQuery → createMatchQuery →
  ArrayMatch` would cycle. The plan resolves this WITHOUT a circular import — e.g. handle
  `elemmatch` inside the `matchQuery` module itself, or pass `matchQuery` into `ArrayMatch` as an
  injected evaluator. The spec mandates: no circular import; elemmatch reuses `matchQuery`'s
  logic (not a reimplementation).
- Scalar matchers (`TextMatch`/`NumericMatch`/`BooleanMatch`/`DateMatch`) and `resolvePath` are
  **not modified**.

## Performance & memory

- **No memory leak.** The matchers are pure functions with no global/retained state, caches, or
  listeners. Every intermediate value (the `.some()` scan, `deepEqual` recursion stack) is
  transient and GC-eligible once the call returns. Track A adds no persistent state. The existing
  jsonpath-plus module cache is bounded and not exercised by these (mostly plain-path) dataTypes.
- **Allocation is transient**, proportional to (elements scanned × conditions), and `.some()`
  short-circuits on the first match. For **large arrays**, the per-element path should use a
  lightweight comparison rather than constructing a full Match-class instance per element — the
  plan implements element matching via a shared per-element predicate to avoid N short-lived
  class instances. Typical array sizes are negligible either way.
- **Recursion depth** (nested elemmatch / deep objects) is bounded by the filter + data depth; no
  unbounded growth.

## Error handling

- Operator invalid for a (dataType, elementType) → **throw** via `assertOperator` (Task-8
  precedent). Invalid `dataType` → throw (existing switch `default`).
- Non-array data on an `array` condition, and missing/`null` fields → **no match** (forgiving),
  not thrown.
- Matching returns a boolean and never throws on data *shape*; only an invalid *operator* or
  *dataType* throws.

## Testing strategy

- **objectCompare**: `deepEqual` (primitives incl. `null`/`false`/`0`/`NaN` distinctions, Date,
  nested objects/arrays) and `contains` (recursive object containment, leaf deep-equal, the
  `{vip:null} contains {vip:false}` → false case, missing key → false).
- **ObjectMatch**: eq / neq / contains / isnull / isnotnull; non-object target.
- **ArrayMatch** (per elementType): ∃ element ops; `containsall` (incl. date); non-array → no
  match; isnull/isnotnull on the field; "does not contain" via `not`+`eq`.
- **elemmatch**: same-element AND (the `{items:[{sku,qty}]}` case that wildcard gets wrong),
  nested `or` group, nested elemmatch (orders→items), empty array → false.
- **Type test** (compile-time, `tsc --noEmit`): a valid combo compiles; an invalid one (e.g.
  `dataType:'object', operator:'gt'` or `dataType:'array', elementType:'boolean', operator:'range'`)
  is a compile error (`@ts-expect-error`).

## Out of scope

- Wildcard paths (`users[*].x`) combined with `dataType:'array'/'object'/elemmatch` — undefined /
  unsupported; the explicit dataType is the iteration mechanism. Documented.
- Changing or deprecating the existing wildcard-on-scalar ∀/∃ behavior (separate, breaking,
  future major).
- `@rfjs/jsonb-query` changes, a shared types package, and the Track-B mapping registry.
