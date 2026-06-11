# @rfjs/data-expr — Safe JSON Expression Engine (Design)

**Status:** Approved (brainstorming; all open items resolved 2026-06-11) — pending implementation plan.
**Date:** 2026-06-11

## Overview

A new package `@rfjs/data-expr`: a **safe expression engine over JSON data**, built by wrapping
**JSONata**. It evaluates a string expression against a data object to produce a value —
arithmetic, aggregates, conditional counts (count-where), string merge/extract, path + filter —
with **no JavaScript `eval`** (no RCE).

It is usable **standalone** (computed values) and **embeddable** into `@rfjs/data-filter`'s
condition `field`/`value` slots (and the `matchAndMap` mapping `value`) as a *computed slot*
primitive. It does NOT merge the existing packages — they **embed** it. The Track-B mapping need
(BPM `times`, etc.) becomes its first consumer.

In the same wave, `@rfjs/data-filter` **removes `jsonpath-plus`**: every capability the jsonpath
wildcard syntax provided now has a replacement (Track A's `array`/`elemmatch` dataTypes, or an
`=`-expression), external consumers are ≈ 0 (only `0.1.0` on npm; BPM still uses its own internal
helper and will be rebuilt), and removal also retires the wildcard ∀/∃ footgun and a dependency
with an eval-related CVE history. Path resolution becomes `_.get`-only plus fail-fast guards.

`@rfjs/jsonb-query` is out of scope (it compiles metadata to SQL; it does not evaluate against
in-memory data).

## Why JSONata (build-vs-buy = buy)

The required capabilities — path + filter projection, aggregates (`$sum`/`$average`/`$min`/`$max`/
`$count`), count-where (`$count(items[status='paid'])`), arithmetic (`+ - * / %`), string
merge/extract (`$join`/`$substring`/`$split`/`$replace`/`$match`), comparison/logical — are
**exactly** what JSONata provides, in one mature, **safe (no JS eval)** library with a built-in
**compile** step (`jsonata(expr)` → reusable). JMESPath was rejected (no arithmetic operators,
weak strings); a hand-rolled engine would re-implement a JSONata subset (parser, functions,
filters/lambdas, regex) — a large, risky build for a weaker v1. Cost of buying: one mid-weight
runtime dependency + adopting JSONata's syntax. The dependency cost is offset by removing
`jsonpath-plus` (see decision 5).

## Locked decisions

1. **Wrap JSONata** (do not hand-roll an expression language).
2. **Security default = treat expression strings as potentially untrusted** (BPM's mappings arrive
   via a request DTO). JSONata gives **no RCE** (no JS eval); residual risks when the *expression
   string itself* is attacker-influenced are **DoS** (expensive expressions; JSONata does not cap
   CPU/time by default) and **ReDoS** (`$match` with a dynamic pattern). v1 ships **guards** (see
   Security); they can be relaxed per call where expressions are author/config-controlled.
3. **Compile-once / evaluate-many** is the performance contract. The engine exposes
   `compile(expr) → CompiledExpr` (parse once) + `CompiledExpr.evaluate(data)`; consumers compile
   once and reuse across rows.
4. **Embed into `@rfjs/data-filter` `field`/`value`**: a slot that is a string beginning with `=`
   is a computed expression evaluated by the engine; anything else is the existing plain path /
   literal. The `matchAndMap` mapping `value` accepts `=`-expressions too (Track B's resolution —
   no per-op mapping `type`s like `times`/`plus` are needed).
5. **Remove `jsonpath-plus` from data-filter (this wave — option B).** Rationale:
   - Every wildcard use now has a replacement: `tags[*]` → `dataType:'array'`; `users[*].x` →
     `elemmatch` (which, unlike wildcard, can express *same-element*); `[?(@.x>1)]` filters,
     `$..x` descent, slices/unions → `=`-expressions (`…[x>1]`, `**.x`, ranges).
   - Capability strictly grows (jsonpath cannot aggregate/compute; JSONata can), only the syntax
     for the wildcard niche changes.
   - npm consumers ≈ 0 and BPM is being rebuilt — the cheapest moment for the break.
   - The legacy wildcard-on-scalar ∀/∃ footgun (review #6) dies with it, and `jsonpath-plus`'s
     filter/script evaluation has an eval-related RCE CVE history (CVE-2024-21534 + follow-up
     bypass; patched in the v10 line we pin, but the attack surface goes away entirely).
   - Mechanics: `resolvePath` (the single chokepoint used by all 7 Match classes) becomes
     `_.get`-only; a `field` with wildcard syntax (`*`, `..`, `[?`, `[:`, `[,`, `[(`) **or a `$`
     prefix** throws a fail-fast error pointing to `array`/`elemmatch`/`=`-expressions (`$`-prefixed
     paths would otherwise silently resolve `undefined` under `_.get`). The dead `resolvePathDetail`
     export is removed. Existing wildcard tests are migrated to their `array`/`elemmatch`/`=`
     equivalents or dropped. This is a breaking change, called out in the changeset (pre-1.0 minor,
     consistent with how the `neq` semantics change shipped).
6. **`=` is the expression sentinel** (string prefix), not a structured `{ expr }` form. `field` is
   a path, `value` is a literal — `=` is what turns either into a computed slot.
7. **`undefined` result semantics: no-match + observability.** An `=`-expression that evaluates to
   `undefined` (e.g. a mistyped path — JSONata returns `undefined` rather than erroring) is a
   **no-match** for conditions (consistent with today's missing-field behavior), but the engine
   exposes an `onUndefined` hook / `strict` option so consumers can warn or throw. data-filter's
   embedding defaults to warn-capable, never silent-by-design.
8. **Computed-slot type contract:** an `=`-expression's result must suit the condition's
   `dataType` (e.g. a numeric comparison needs `$count(...)`/`$sum(...)`, not a raw filter
   projection like `items[status='paid']`, which yields object(s)). Docs must table JSONata's
   **sequence collapse** (0 hits → `undefined`, 1 → scalar, n → array) and provide a
   **jsonpath → JSONata mapping table** (`[*]` → omitted, `[?(@.x>1)]` → `[x>1]`, `$..x` → `**.x`)
   since the team's muscle memory is jsonpath.
9. **`${}` and JSONata syntax stay separate.** Inside an `=`-expression, use JSONata path syntax
   (`userOrderItem.qty`), not `${}`. `${}` remains the alias mechanism for non-expression slots.

## Architecture

- **`@rfjs/data-expr`** (new): the JSONata wrapper. Runtime dep: `jsonata`. Public API
  (**async** — verified against jsonata 2.2.1, whose `evaluate` returns a Promise):
  ```ts
  export interface CompiledExpr {
    /** Async (jsonata v2). Not safe for CONCURRENT calls on one instance (shared timebox state); sequential reuse is the contract. */
    evaluate(data: unknown): Promise<unknown>;
  }
  export interface ExprOptions {
    timeoutMs?: number;            // default 1000
    maxDepth?: number;             // default 100
    strict?: boolean;              // undefined result rejects instead of resolving undefined
    onUndefined?: (expr: string) => void; // observability hook (decision 7)
  }
  export function compile(expr: string, options?: ExprOptions): CompiledExpr;
  export function evaluate(expr: string, data: unknown, options?: ExprOptions): Promise<unknown>; // one-shot convenience
  export function isExpression(slot: string): boolean;        // slot starts with '='
  export function stripExpressionPrefix(slot: string): string; // '=...' -> '...'
  ```
  `compile` parses with JSONata once and wraps it with the guards. **Implementation note
  (verified):** jsonata ≥2 looks the timebox hooks up by `Symbol.for('jsonata.__evaluate_entry'
  / '__evaluate_exit')` — string keys are silently ignored; the timebox state resets at the start
  of each `evaluate()` call so compiled expressions are reusable. Errors are a typed
  `DataExprError` with `kind: 'compile' | 'evaluate' | 'timeout' | 'depth' | 'undefined'`.
  **Phase 2 consequence:** because evaluation is async, data-filter's compiled-filter evaluator
  for `=`-slots must be async (e.g. an async compiled predicate / `matchQueryAsync`); the existing
  sync `matchQuery` stays for expression-free filters. Detailed design belongs to the Phase 2 plan.

- **`@rfjs/data-filter`** (modified, breaking per decision 5):
  - **Embedding:** condition resolution and mapping resolution consult `data-expr` when a slot is
    an `=`-expression. data-filter gains a **compile-once execution model**: a `FilterMatchQuery`
    is compiled once (its `=`-expressions via `data-expr.compile`, plain slots kept as today) into
    a reusable evaluator run per row. Plain (non-`=`) `field`/`value` keep the `_.get` fast path
    and never touch JSONata. (This is the "compile-to-predicate" optimization from the original
    data-filter review — embedding expressions is what motivates it.)
  - **jsonpath removal:** `resolve.ts` drops the engine branch (`_.get` + guards only; the comma
    literal-key heuristic stays on `_.get` as today); `hasWildcardSyntax` remains as the guard
    predicate, extended to `$`-prefixes; `resolvePathDetail` is deleted; `jsonpath-plus` leaves
    `dependencies`; wildcard specs are migrated.

- **`@rfjs/jsonb-query`**: unchanged (compiler, not evaluator).

## Security

- **No RCE:** JSONata parses to an AST and evaluates functionally; it does not execute arbitrary
  JS. This is the core reason to use it over `eval`/`new Function`/`lodash.template` — and, with
  decision 5, the family also sheds `jsonpath-plus`'s script-evaluation surface (eval-related CVE
  history).
- **v1 guards (default = untrusted expressions):**
  - **Time/depth box:** every compiled expression is wrapped with JSONata's `timeboxExpression`
    (configurable `timeoutMs`, `maxDepth`; defaults 1000 ms / depth 100). A runaway expression
    throws rather than hanging.
  - **No custom JS bindings exposed** to the expression beyond the data object; do not pass
    secrets into the evaluation context.
  - **Regex caution:** `$match`/`$replace` with a *dynamic* (data- or user-derived) pattern is a
    ReDoS surface; the timebox bounds it, and the README warns.
  - Evaluation errors are caught and surfaced as a typed error (never leak internals); a failed
    computed slot is a clear error, not a silent wrong value. (`undefined` is not an error —
    decision 7 governs it.)
- **Relaxation:** where expressions are author/config-controlled, `timeoutMs`/guards can be
  raised/disabled per call.

## Embedding contract (data-filter)

- A condition `field` or `value` that is a string starting with `=` is a computed expression:
  ```ts
  // filter rows where the items' amounts sum to > 1000
  { field: '=$sum(items.amount)', dataType: 'numeric', operator: 'gt', value: 1000 }
  // count-where on the RHS
  { field: 'paidCount', operator: 'gte', dataType: 'numeric', value: "=$count(items[status='paid'])" }
  ```
  The engine computes the slot's value; the existing `dataType`/`operator` machinery then compares
  as usual (decision 8 governs result-type fit; decision 7 governs `undefined`). Plain slots are
  unchanged.
- The `matchAndMap` mapping `value` accepts `=`-expressions (Track B):
  ```ts
  { key: 'behaviorBonus', value: '=500 * userOrderItem.qty' }      // replaces the old `times` idea
  { key: 'total',         value: '=$sum(items.amount) * 1.1' }
  ```
  A single `=`-expression covers arithmetic, aggregates, count-where, and strings; the legacy
  mapping `type: 'value'` keeps meaning "assign literal".
- **The structured collection dataTypes (`object`/`array`/`elemmatch` from Track A) REMAIN the
  primary filter DSL** — serializable, UI-buildable, compile-time typed, vocabulary-aligned with
  `@rfjs/jsonb-query`, and synchronous. `=`-expressions are the escape hatch for *computed*
  values (memory-only, async); they do not replace structured conditions. What gets removed is
  only the jsonpath wildcard `field` syntax — whose designated replacements are exactly
  `array`/`elemmatch` (and `=` for the exotic cases).

## Scope (v1) and phasing

- **Phase 1 — `@rfjs/data-expr`:** the JSONata wrapper (`compile`/`evaluate`/`isExpression`/
  guards/`strict`/`onUndefined`), standalone, fully tested. Smallest shippable unit. **Own plan.**
- **Phase 2 — data-filter integration (breaking wave):** compile-once execution model,
  `=`-`field`/`value` resolution, `matchAndMap` `=`-expressions, **and the jsonpath-plus removal**
  (resolve.ts simplification, guards, `resolvePathDetail` deletion, wildcard-test migration,
  README rewrite incl. the mapping table). **Own plan, written after Phase 1 lands** (it depends
  on the engine's real API).
- **Out of scope (deferred):** `@rfjs/data-label` embedding (fast-follow once Phase 2 proves the
  pattern); `@rfjs/jsonb-query` changes; removing the legacy mapping `type` dispatch entirely.

## Dependency impact

data-filter runtime deps stay at 3: `@rfjs/object-utils`, `lodash`, and `@rfjs/data-expr`
(replacing `jsonpath-plus`). `@rfjs/data-expr` itself is a thin wrapper whose only dep is
`jsonata`.

## Testing strategy

- **`@rfjs/data-expr`:** `compile`+`evaluate` for arithmetic, aggregates (`$sum`/`$count`),
  count-where, string merge/extract; `isExpression`/`stripExpressionPrefix`; sequence-collapse
  shapes (0/1/n hits); **security** — a pathological expression hits the timebox and throws (not
  hangs); a malformed expression throws a typed error; `strict`/`onUndefined` behavior; a compiled
  expression is reusable across data inputs (compile-once).
- **data-filter integration:** `=`-`field` computed and compared (`$sum(items.amount) > 1000`);
  `=`-`value` (count-where RHS); plain field/value still uses the `_.get` path (no engine);
  a filter with no `=`-slots behaves exactly as today (regression); mapping `=`-expression (the
  BPM `500 * qty` case); `undefined`-result → no-match (+ hook fires).
- **jsonpath removal:** wildcard/`$`-prefixed `field` throws the guidance error on every dataType;
  plain/single-index paths unaffected; migrated equivalents of the old wildcard specs pass via
  `array`/`elemmatch`/`=`; `jsonpath-plus` absent from the dependency tree.
- **Performance characterization:** an `=`-expression is compiled once per filter compilation, not
  per row.

## Resolved review items

1. ~~jsonpath additive vs remove~~ → **remove this wave** (decision 5, option B confirmed).
2. ~~Trust boundary~~ → **default untrusted, guards on**; relaxable per call (decision 2).
3. ~~`${}` inside expressions~~ → **kept separate** (decision 9).
4. ~~Expression sentinel~~ → **`=` prefix** (decision 6).
5. ~~`undefined` semantics~~ → **no-match + `onUndefined`/`strict`** (decision 7).
