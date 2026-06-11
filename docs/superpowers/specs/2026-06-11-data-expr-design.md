# @rfjs/data-expr — Safe JSON Expression Engine (Feasibility / Design)

**Status:** Brainstorming feasibility design — pending spec review → implementation plan.
**Date:** 2026-06-11

## Overview

A new package `@rfjs/data-expr`: a **safe expression engine over JSON data**, built by wrapping
**JSONata**. It evaluates a string expression against a data object to produce a value —
arithmetic, aggregates, conditional counts (count-where), string merge/extract, path + wildcard +
filter — with **no JavaScript `eval`** (no RCE).

It is usable **standalone** (computed values) and **embeddable** into `@rfjs/data-filter`'s
condition `field`/`value` slots (and the `matchAndMap` mapping `value`) as a *computed slot*
primitive. It does NOT merge the existing packages — they **embed** it. The Track-B mapping need
(BPM `times`, etc.) becomes its first consumer.

`@rfjs/jsonb-query` is out of scope (it compiles metadata to SQL; it does not evaluate against
in-memory data).

## Why JSONata (build-vs-buy = buy)

The required capabilities — path + wildcard + filter, aggregates (`$sum`/`$average`/`$min`/`$max`/
`$count`), count-where (`$count(items[status='paid'])`), arithmetic (`+ - * / %`), string
merge/extract (`$join`/`$substring`/`$split`/`$replace`/`$match`), comparison/logical — are
**exactly** what JSONata provides, in one mature, **safe (no JS eval)** library with a built-in
**compile** step (`jsonata(expr)` → reusable). JMESPath was rejected (no arithmetic operators,
weak strings); a hand-rolled engine would re-implement a JSONata subset (parser, functions,
filters/lambdas, regex) — a large, risky build for a weaker v1. Cost of buying: one mid-weight
runtime dependency + adopting JSONata's syntax.

## Locked decisions

1. **Wrap JSONata** (do not hand-roll an expression language).
2. **Security default = treat expression strings as potentially untrusted** (security is a stated
   priority; BPM's mappings arrive via a request DTO). JSONata gives **no RCE** (no JS eval), but
   the residual risks when the *expression string itself* is attacker-influenced are **DoS**
   (expensive expressions; JSONata does not cap CPU/time by default) and **ReDoS** (`$match` with
   a dynamic pattern). v1 therefore ships **guards** (see Security). **OPEN — confirm at review:**
   if these expressions are in fact author/config-controlled (not raw end-user input), the guards
   can be relaxed.
3. **Compile-once / evaluate-many** is the performance contract. The engine exposes
   `compile(expr) → CompiledExpr` (parse once) + `CompiledExpr.evaluate(data)`; consumers compile
   once and reuse across rows.
4. **Embed into `@rfjs/data-filter` `field`/`value`** (in scope for v1, per the maximize-design
   goal): a slot that is a string beginning with `=` is a computed expression evaluated by the
   engine; anything else is the existing plain path / literal (back-compat). The `matchAndMap`
   mapping `value` accepts `=`-expressions too (this is Track B's resolution).
5. **Keep `jsonpath-plus` for now (additive).** It is used in exactly one place
   (`src/path/resolve.ts`, wildcard paths only; plain paths already use the `_.get` fast path).
   JSONata *could* replace it, but the existing `field` strings use jsonpath syntax, so swapping
   is a breaking field-syntax change. v1 leaves jsonpath-plus in place and uses JSONata only for
   `=`-expressions. **Consolidation (drop jsonpath-plus, route wildcard via JSONata) is a deferred
   follow-up** — cheap later (one usage site) and acceptable once BPM is rebuilt.

## Architecture

- **`@rfjs/data-expr`** (new): the JSONata wrapper. Runtime dep: `jsonata`. Public API:
  ```ts
  export interface CompiledExpr { evaluate(data: unknown): unknown }
  export interface ExprOptions { timeoutMs?: number; maxDepth?: number }
  export function compile(expr: string, options?: ExprOptions): CompiledExpr;
  export function evaluate(expr: string, data: unknown, options?: ExprOptions): unknown; // compile + evaluate, convenience
  export function isExpression(slot: string): boolean;  // true if slot starts with '='
  export function stripExpressionPrefix(slot: string): string; // '=...' -> '...'
  ```
  `compile` parses with JSONata once and wraps it with the guards (timebox). `evaluate` is the
  one-shot convenience (not for hot paths). `isExpression`/`stripExpressionPrefix` are the shared
  convention helpers consumers use to detect `=`-slots.

- **`@rfjs/data-filter`** (modified): condition resolution and mapping resolution consult
  `data-expr` when a slot is an `=`-expression. To stay performant, data-filter gains a
  **compile-once execution model**: a `FilterMatchQuery` is compiled once (its `=`-expressions
  compiled via `data-expr.compile`, its plain slots kept as today) into a reusable evaluator that
  runs per row. Plain (non-`=`) `field`/`value` keep the current fast path and never touch
  JSONata. (This is the "compile-to-predicate" optimization noted in the original data-filter
  review — embedding expressions is what motivates it.)

- **`@rfjs/jsonb-query`**: unchanged (compiler, not evaluator).

## Security

- **No RCE:** JSONata parses to an AST and evaluates functionally; it does not execute arbitrary
  JS. This is the core reason to use it over `eval`/`new Function`/`lodash.template`.
- **v1 guards (default = untrusted expressions):**
  - **Time/depth box:** every compiled expression is wrapped with JSONata's `timeboxExpression`
    (configurable `timeoutMs`, `maxDepth`; sane defaults, e.g. 1000 ms / depth 100). A runaway
    expression throws rather than hanging.
  - **No custom JS bindings exposed** to the expression beyond the data object; do not pass
    secrets into the evaluation context.
  - **Regex caution:** document that `$match`/`$replace` with a *dynamic* (data- or
    user-derived) pattern is a ReDoS surface; the guard timebox bounds it, and the README warns.
  - Evaluation errors are caught and surfaced as a typed error (never leak internals); a failed
    computed slot is a clear error, not a silent wrong value.
- **Relaxation:** if the consumer confirms expressions are author/config-controlled, `timeoutMs`/
  guards can be raised/disabled per call. (Open item #2.)

## Embedding contract (data-filter)

- A condition `field` or `value` that is a string starting with `=` is a computed expression:
  ```ts
  // filter rows where the items' amount sums to > 1000
  { field: '=$sum(items.amount)', dataType: 'numeric', operator: 'gt', value: 1000 }
  // count-where on the RHS
  { field: 'paidCount', operator: 'gte', dataType: 'numeric', value: "=$count(items[status='paid'])" }
  ```
  The engine computes the slot's value; the existing `dataType`/`operator` machinery then compares
  as usual. Plain slots (`field: 'name'`, `field: 'users[*].role'`) are unchanged.
- The `matchAndMap` mapping `value` accepts `=`-expressions (Track B):
  ```ts
  { key: 'behaviorBonus', value: '=500 * userOrderItem.qty' }      // replaces the old `times`
  { key: 'total',         value: '=$sum(items.amount) * 1.1' }
  ```
  This removes the need for per-op mapping `type`s (`times`/`plus`/…) — a single `=`-expression
  covers arithmetic, aggregates, count-where, and strings. The mapping `type` stays only to
  distinguish "assign literal" from "evaluate expression" (or we detect `=` automatically).
- **Alias `${}` vs JSONata:** the existing `aliasData` `${...}` substitution and JSONata path
  refs overlap. v1 rule: inside an `=`-expression, use **JSONata** path syntax
  (`userOrderItem.qty`), NOT `${}`. `${}` remains for the non-expression `value`/alias path.
  (Open item #3: whether to also accept `${}` inside expressions or keep them cleanly separate —
  lean: keep separate.)

## Scope (v1) and phasing

- **Phase 1 — `@rfjs/data-expr`:** the JSONata wrapper (`compile`/`evaluate`/`isExpression`/guards),
  standalone, fully tested. Smallest shippable unit; usable on its own.
- **Phase 2 — data-filter embedding:** the compile-once execution model + `=`-`field`/`value`
  resolution + `matchAndMap` mapping `=`-expressions. This is the substantial part (it adds a
  compiled path to data-filter). Plain-slot behavior and the existing API stay backward-compatible.
- **Out of scope (deferred):** `jsonpath-plus` consolidation; `@rfjs/data-label` embedding (a
  fast-follow once Phase 2 proves the pattern); `@rfjs/jsonb-query` changes; full removal of the
  legacy mapping `type` dispatch.

## Dependency impact

data-filter runtime deps today = 3 (`@rfjs/object-utils`, `jsonpath-plus`, `lodash`). Adding the
engine: `@rfjs/data-expr` depends on `jsonata`; data-filter depends on `@rfjs/data-expr`. Net +1
mid-weight dep short-term; the later jsonpath-plus consolidation would swap `jsonpath-plus` →
`jsonata` (back to parity). `@rfjs/data-expr` itself is a thin wrapper (its only dep is `jsonata`).

## Testing strategy

- **`@rfjs/data-expr`:** `compile`+`evaluate` for arithmetic, aggregates (`$sum`/`$count`),
  count-where, string merge/extract; `isExpression`/`stripExpressionPrefix`; **security** — a
  pathological expression hits the timebox and throws (not hangs); a malformed expression throws a
  typed error; compiled expression is reusable across data inputs (compile-once).
- **data-filter embedding:** `=`-`field` computed and compared (the `$sum(items.amount) > 1000`
  case); `=`-`value` (count-where RHS); a plain field/value still uses the fast path (no engine);
  a filter with no `=`-slots compiles to the same behavior as today (regression); mapping
  `=`-expression (the BPM `500 * qty` case) produces the right computed field.
- **Performance characterization:** an `=`-expression is compiled once per `compileFilter`, not
  per row (assert compile count, or measure that N rows don't re-parse).

## Open items (confirm at spec review)

1. **jsonpath path** — v1 keeps `jsonpath-plus` (additive); confirm consolidation is a later wave.
2. **Trust boundary** — are `=`-expressions author/config-controlled or end-user-supplied? Default
   here = untrusted (guards on). Confirm to keep or relax.
3. **`${}` inside expressions** — keep `${}` and JSONata path syntax separate (lean) or also accept
   `${}` inside `=`-expressions.
4. **`=` as the expression sentinel** — confirm `=` prefix is the chosen marker (vs a structured
   `{ expr: '...' }` form).
