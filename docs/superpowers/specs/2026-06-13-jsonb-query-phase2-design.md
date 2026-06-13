# @rfjs/jsonb-query — Phase 2 design (elemmatch nesting, empty-group sentinels, typed errors, array `neq`)

**Date:** 2026-06-13
**Branch:** `feat/jsonb-query-phase2`
**Status:** approved (brainstorming)

## Context

`@rfjs/jsonb-query` (0.1.0) turns a filter-metadata tree into a parameterized
PostgreSQL `WHERE` expression across two dialects: `legacy` (`#>>` extraction +
casts, all PG versions) and `jsonpath` (`jsonb_path_exists` / SQL-JSON path, PG
12+). The previously-shipped "phase-2" work (object / scalar-array / elemmatch
conditions) is already on `main`. This round closes the remaining gaps.

> Naming note: the "jsonpath removal" in the repo history was in
> **`@rfjs/data-filter`** (its in-memory `$.a.b[*]` path-syntax engine). The
> `jsonpath` **SQL dialect** in `jsonb-query` is unrelated, fully present, and
> E2E-tested (PG 11.16 / 16). It stays.

## Scope

Four items, all additive except where flagged as a behavior change:

- **A.** Complete `elemmatch` nesting — allow `object` and scalar-array
  conditions inside `elemmatch` (currently rejected in both dialects).
- **B.** Empty-group sentinels — a group that reduces to no parts emits its
  boolean identity instead of an empty string. **(behavior change)**
- **C.** Typed error class — `JsonbQueryError` so consumers can distinguish
  caller-input errors from bugs.
- **D.** Array element `neq` with ∀ ("value not present") semantics
  (currently excluded). **(operator addition)**

Out of scope (explicitly deferred): case-insensitive text operators
(`icontains`/`istartswith`), removal of the always-`[]` `from` field.

---

## A. Complete `elemmatch` nesting

### Current state

`assertCondition(node, scope)` (`src/dialect/base.ts`) throws when `scope ===
'elemmatch'` for:

- `object` conditions — `'Object conditions are not supported inside elemmatch'`
- scalar-array conditions — `'Array conditions with scalar elements are not
  supported inside elemmatch'`

Scalars and nested `elemmatch` already work inside `elemmatch`.

### Design

**Shared:** Remove both `scope === 'elemmatch'` throws in `assertCondition`.
Validation of object / scalar-array conditions becomes scope-independent
(operator-set checks still apply). The `scope` parameter is retained on the
signature but no longer gates these two cases.

**legacy dialect — no rendering change required.** `renderElemMatch` already
renders its body via `ctx.renderGroup(condition.filters, '<alias>.value')`,
which threads the element column down through `buildGroup` → `renderCondition`.
`renderObjectCondition(column, …)` and `renderArray(column, …)` both accept the
column argument, so object / scalar-array conditions render relative to the
element (`e1.value #> {field}`) automatically once the guards are gone.

**jsonpath dialect — two changes.**

1. `conditionPredicate` (used to build the single merged path predicate) gains a
   scalar-array branch:
   - scalar element op → `exists (@."field"[*] ? (<scalarPredicate on @>))`
   - `isnull` / `isnotnull` → predicate on the array field itself
     (`!exists(@."field") || @."field" == null`), reusing `scalarPredicate`.

2. `renderElemMatch` checks `groupNeedsSqlFallback(condition.filters)` first.
   When `true`, it delegates to `legacyDialect.renderElemMatch(column,
   condition, ctx)` — producing a SQL `EXISTS (… jsonb_array_elements …)` shell
   whose body still renders through the jsonpath dialect (scalar leaves →
   `jsonb_path_exists`, object / `containsall` leaves → `#>` / `@>`). No new
   plumbing; `legacy.ts` does not import `jsonpath.ts`, so delegating the other
   way introduces no import cycle.

### `groupNeedsSqlFallback(group)`

Recursively returns `true` when any node in the predicate subtree cannot be
expressed as a SQL-JSON path predicate (i.e. needs `@>` / `#>>`):

```
for node in group.filters:
  if isFilterGroup(node):            recurse; bubble up true
  elif node.dataType === 'object':   return true          # #> / @> / =, never a path predicate
  elif node.dataType === 'array':
      if node.elementType === 'object':   recurse into node.filters  # nested elemmatch
      else:                                                          # scalar-array
          if node.operator === 'containsall': return true           # @> containment
          # isnull/isnotnull/scalar element ops are path-expressible
  # scalars are always path-expressible
return false
```

Rationale for full recursion: a path predicate embeds a nested `elemmatch` as
`exists(@."sub"[*] ? (<inner>))`. If `<inner>` is not path-expressible, the
*outer* predicate cannot be built either, so the outer `elemmatch` must take the
SQL fallback. Once it does, each nested `elemmatch` re-evaluates its own
fallback independently when rendered.

### Worked examples

```ts
// object inside elemmatch — legacy
{ field:'items', dataType:'array', elementType:'object', operator:'elemmatch',
  filters:{ logic:'and', filters:[
    { field:'sku', dataType:'string', operator:'eq', value:'x' },
    { field:'meta', dataType:'object', operator:'contains', value:{ vip:true } },
  ] } }
// legacy: exists (select 1 from jsonb_array_elements(<guarded items>) as e1
//           where ((e1.value #>> $) = $) and ((e1.value #> $) @> $::jsonb))
// jsonpath: same EXISTS shell (fallback), scalar leaf via jsonb_path_exists,
//           object leaf via (e1.value #> $) @> $::jsonb

// scalar-array inside elemmatch — both dialects native
{ …elemmatch over 'items', filters:{ logic:'and', filters:[
    { field:'tags', dataType:'array', elementType:'string', operator:'eq', value:'a' },
] } }
// jsonpath path predicate: $."items"[*] ? (exists (@."tags"[*] ? (@ == $v0)))
```

---

## B. Empty-group sentinels (behavior change)

### Current state

`joinLogic(parts, logic)` returns `''` when `parts.length === 0`; `buildGroup`
drops empty parts via `.filter(sql => sql.length > 0)`. Net effects:

- A wholly-empty top-level filter yields `where: ''` → consumer
  `WHERE ${where}` is a syntax error.
- An empty *inner* group is silently dropped, so `X and (empty-or)` reduces to
  `X` rather than the semantically-correct "match nothing".

### Design — consistent boolean identity

`joinLogic` returns the group logic's identity literal when `parts.length === 0`:

| logic | empty result | reasoning |
|-------|--------------|-----------|
| `and` | `true`  | vacuous AND |
| `or`  | `false` | vacuous OR |
| `not` | `false` | `not(AND of nothing)` = `not(true)` |
| `nor` | `true`  | `not(OR of nothing)` = `not(false)` |

These literals participate in parent joins normally, so `X and (empty or)` →
`X and false` → `false` (correct). PostgreSQL accepts bare `true` / `false` in
`WHERE`. The `.filter(sql.length > 0)` guard in `buildGroup` becomes effectively
dead (every group now renders non-empty) but is kept as defense.

**Scope boundary:** this affects only the SQL group logic in `build.ts`. The
jsonpath dialect's *path-predicate* `groupPredicate` (inside `elemmatch`) is
untouched — `elemmatch` already asserts ≥1 condition, so empty path-predicate
groups cannot occur. No bare-`true`/`false` jsonpath literal is needed.

**Behavior change** — documented in the changeset: previously-dropped inner
empty groups now contribute their identity, which can change results for
filters that relied on the silent-drop. Acceptable pre-1.0 and a correctness
improvement.

---

## C. Typed error class

### Design

New `src/errors.ts`:

```ts
export type JsonbQueryErrorCode =
  | 'INVALID_COLUMN'
  | 'INVALID_DIALECT'
  | 'UNSUPPORTED_OPERATOR'
  | 'INVALID_VALUE'
  | 'INVALID_PREFIX'
  | 'PARAM_MISMATCH';

export class JsonbQueryError extends Error {
  readonly code: JsonbQueryErrorCode;
  constructor(message: string, code: JsonbQueryErrorCode) {
    super(message);
    this.name = 'JsonbQueryError';
    this.code = code;
  }
}
```

Every `throw new Error(...)` in the package becomes `throw new
JsonbQueryError(msg, code)`, mapped:

| throw site | code |
|------------|------|
| `quoteJsonbColumn` invalid segment | `INVALID_COLUMN` |
| unknown dialect (`build.ts`) | `INVALID_DIALECT` |
| operator/type mismatch, unsupported operator, unknown elementType (`base.ts`, dialects, `object-condition.ts`) | `UNSUPPORTED_OPERATOR` |
| value guards — `assertScalarValue` / `assertArrayValue` / `assertObjectValue`, empty elemmatch group | `INVALID_VALUE` |
| invalid named-param prefix (`named-params.ts`) | `INVALID_PREFIX` |
| `toNamedParams` placeholder/value mismatch | `PARAM_MISMATCH` |

Exported from `src/index.ts` (`JsonbQueryError`, `JsonbQueryErrorCode`).

**Contract:** any `JsonbQueryError` signals a caller-input problem; any other
thrown type is an internal bug. Documented in the README.

---

## D. Array element `neq` (∀ semantics)

### Design

- **Type:** `JsonbArrayOperator` changes from
  `Exclude<JsonbScalarOperator, 'neq'> | 'containsall'` to
  `JsonbScalarOperator | 'containsall'`. `ARRAY_OPERATORS_BY_ELEMENT` adds `neq`
  for `string` / `numeric` / `date` / `boolean`.
- **Semantics:** `neq` ≡ "value not present in the array" (∀ element: element ≠
  value) — the negation of `eq`'s ∃-present, identical to the documented
  `{ logic:'not', filters:[{ …eq… }] }` form. Missing / non-array / empty array
  → "does not contain" → matches.
  - legacy: `not (exists (select 1 from jsonb_array_elements_text(<guarded>) as
    e(v) where (e.v = $)))`
  - jsonpath: `not (jsonb_path_exists(col, '$."field"[*] ? (@ == $v)'))`
- Inside `elemmatch`, scalar-array `neq` follows the same negated-existence form
  (legacy nested EXISTS / jsonpath `!exists(@."field"[*] ? (@ == $v))`).
- README: drop "`neq` is not allowed on elements"; document the ∀ meaning and
  its equivalence to `not`+`eq`.

---

## Testing

- **Unit (co-located `*.spec.ts`):**
  - `base.spec.ts` — `assertCondition` no longer throws for object / scalar-array
    in elemmatch scope; `groupNeedsSqlFallback` truth table; new `neq` in
    operator sets; `JsonbQueryError` thrown with correct `code` from each guard.
  - `legacy.spec.ts` — object / scalar-array / nested-elemmatch inside elemmatch;
    array `neq`.
  - `jsonpath.spec.ts` — scalar-array inside elemmatch as native path predicate;
    object / `containsall` inside elemmatch triggers SQL-EXISTS fallback;
    deeply-nested fallback propagation; array `neq`.
  - `build.spec.ts` — empty-group identity literals at top level and nested
    (`and`→`true`, `or`→`false`, `not`→`false`, `nor`→`true`); mixed empty/non-empty.
  - `errors.spec.ts` (new) — `JsonbQueryError` shape, `code` values, `instanceof`.
- **E2E (`test/jsonb-query.e2e.spec.ts`, self-skips without `PG_E2E_URLS`):**
  add result-asserting cases (both dialects) for object-in-elemmatch,
  scalar-array-in-elemmatch, array `neq`, and an empty-group filter. SQL text is
  explicitly non-stable API — assert query *results*, not generated strings.

## Docs & release

- README: update the elemmatch section (object / scalar-array now supported,
  fallback note for jsonpath), the operator table (`neq` on array elements),
  add an "Errors" subsection (`JsonbQueryError` + codes), and an empty-filter
  note.
- Changeset: **minor** bump. Body must flag the two behavior-affecting items
  (B empty-group identity, D new `neq` operator) under "Changed" / "Added".

## Build sequence (for the implementation plan)

1. `errors.ts` + wire `JsonbQueryError` through all throw sites (C) — isolated,
   no behavior change; lands first.
2. Remove elemmatch scope guards + `groupNeedsSqlFallback` + jsonpath
   scalar-array branch + jsonpath fallback delegation (A).
3. Empty-group identity in `joinLogic` (B).
4. Array `neq` type + operator sets + dialect rendering (D).
5. README + changeset + E2E cases.
