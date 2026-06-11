# @rfjs/data-label Design

**Status:** Approved (brainstorming) — pending spec review → implementation plan.
**Date:** 2026-06-10

## Overview

A new published package `@rfjs/data-label` that composes a **display label string** from
data paths, with an optional **value-translation map** and an optional **template**. It
generalizes an existing internal helper (`alias.helper.ts`) from the BPM API so it can be
reused across projects.

It is the "presentation" sibling to `@rfjs/data-filter` (filtering) — a different concern
(data → label string), so it is a **separate package**, not folded into `data-filter`.

## Background — what it replaces

Extracted from `clinico-bpm-api/src/common/helpers/alias.helper.ts`, used by the Excel
export module to build column values/titles. The original:

- `getAliasValueByInfo(info, formValue)` — resolves several nested paths, translates each
  value via a map, and stores each under four lookup keys (`_${idx}`, raw path, bracket/dot-
  stripped path, optional `aliasKey`).
- `getAliasValueRow(info, formValue)` — composes the final string via a template (lodash
  `_.template`) or, with no template, space-joins the path values.
- `replaceAliasValuePath(path)` — strips `[`, `]`, `.` from a path (so `${contract[0]}`
  becomes the template variable `contract0`).

Its only real coupling to BPM is **type annotations** (`InstancesValuesData`); the logic is
generic. Its only runtime needs are "get a value by a bracket/dot path" and a template
engine.

## Locked decisions

1. **Template engine — safe interpolator + optional `render` hook.** Ship a safe `${path}`
   interpolator as the default (no code execution). Accept an optional `render` function so a
   consumer can plug in `lodash.template` (or anything) when they need advanced templating.
   Rationale: real usage only needs `${...}` interpolation; `lodash.template` executes
   `<% %>` as arbitrary JS, an injection surface for a published package that accepts external
   template strings.
2. **Name — `@rfjs/data-label`.** Fits the `@rfjs/data-*` family; describes the output.
   (`data-alias` rejected: "alias" already means placeholder-substitution in `data-filter`.)
3. **Shared path primitive lives in `@rfjs/object-utils`.** Add a tiny zero-dependency
   `getByPath(obj, path)` to `object-utils`; `data-label` depends on it. This is the shared
   low-level primitive (the only genuinely common piece). `data-filter` is **not** changed now
   but can adopt `getByPath` later.
4. **Internal dependency uses `workspace:*`** (the repo's existing convention, matching how
   `data-filter` depends on `object-utils`). Switching the repo to `workspace:^` is a separate,
   repo-wide decision and out of scope here.

## Architecture

Two packages are touched; a third is intentionally left alone.

- **`@rfjs/object-utils`** (existing, zero runtime deps): add `getByPath`. Minor bump.
- **`@rfjs/data-label`** (new; depends on `@rfjs/object-utils`, **no lodash**): the label
  composer. First release `0.1.0`.
- **`@rfjs/data-filter`**: unchanged.

## `@rfjs/object-utils` — `getByPath`

```ts
/**
 * Read a value from `obj` by a dot/bracket path, e.g. 'a.b[0].c'.
 * Returns `undefined` for a missing path, a nullish intermediate, or a non-object input.
 * Paths are parsed as nested access (a literal key containing '.' is NOT supported, matching
 * lodash `_.get`).
 */
export function getByPath(obj: unknown, path: string): unknown;
```

Behavior:
- Parse: convert `[idx]` → `.idx`, split on `.`, drop empty segments. `'contract[0].name'` →
  `['contract','0','name']`.
- Walk segments; short-circuit to `undefined` the moment an intermediate is `null`/`undefined`
  or not indexable.
- Empty/whitespace path → `undefined` (no segments).

Edge cases (→ tests):
| input | path | result |
|---|---|---|
| `{a:{b:1}}` | `'a.b'` | `1` |
| `{a:[{b:2}]}` | `'a[0].b'` | `2` |
| `{a:{b:1}}` | `'a.x'` | `undefined` |
| `{a:null}` | `'a.b'` | `undefined` |
| `null` | `'a'` | `undefined` |
| `{a:1}` | `''` | `undefined` |
| `{'a.b':5}` | `'a.b'` | `undefined` (parsed as nested `a.b`, not literal key) |

## `@rfjs/data-label` — public API

### Types

```ts
export interface AliasField {
  /** Dot/bracket path into the source, e.g. 'contract[0]'. */
  path: string;
  /** Optional friendly name usable in templates, e.g. 'alias1'. */
  aliasKey?: string;
}

export interface ValueMapEntry {
  /** Raw resolved value to match. */
  key: string | number | boolean;
  /** Replacement value (e.g. an enum code → display label). */
  value: unknown;
}

export interface LabelSpec {
  /** Source paths to resolve, in order. */
  fields: AliasField[];
  /** Optional value-translation entries (enum decode). */
  valueMap?: ValueMapEntry[];
  /** Optional composition template, e.g. '${_0}_${_1}', '${contract[0]}', '${alias1}'. */
  template?: string;
}

export interface ComposeOptions {
  /**
   * Custom template renderer. Receives the raw template and the full value table (which
   * contains positional `_N`, raw-path, normalized-path, and `aliasKey` entries). If omitted,
   * a safe `${path}` interpolator is used.
   */
  render?: (template: string, values: Record<string, unknown>) => string;
}
```

### Functions

```ts
/** Strip '[', ']', '.' from a path so it is usable as a template variable. */
export function normalizeKey(path: string): string;

/**
 * Build the lookup table from a spec + source. Each resolved+translated value is stored under
 * four keys: `_${idx}` (positional), the raw path, the normalized path, and `aliasKey` (if set).
 */
export function buildLabelValues(spec: LabelSpec, source: object): Record<string, unknown>;

/** Compose the final label string from a spec + source. */
export function composeLabel(spec: LabelSpec, source: object, options?: ComposeOptions): string;
```

### Behavior

1. **Resolve** — each `field.path` via `getByPath(source, path)`; missing → `null`.
2. **Translate** — build `Map<key, value>` from `valueMap` once; each resolved value `v`
   becomes `map.get(v) ?? v` (unmatched values pass through; falsy mapped values are kept).
3. **Lookup table** — store the translated value under `_${idx}`, raw `path`,
   `normalizeKey(path)`, and `aliasKey` (when present).
4. **Compose**
   - With `template` + `options.render` → `render(template, values)`.
   - With `template`, no render → **default safe interpolator**: replace each `${token}` with
     `values[normalizeKey(token.trim())]`; nullish → `''`; otherwise `String(value)`. Unknown
     tokens → `''` (never throws).
   - No `template` → join the per-field values (`values[field.path]`) with a single space,
     dropping `null`/`undefined`/`''` (but **keeping** `0`/`false`).

> **Noted deviation from BPM:** the no-template join keeps `0`/`false`; the BPM original used
> a `!!value` filter that dropped them. This is treated as a fix. If exact BPM parity is
> required, flag it in spec review.

### Errors

- `composeLabel` and `getByPath` never throw on missing/invalid input — composition is a
  presentation concern and stays forgiving (unknown token → `''`, missing path → `null`).

## Out of scope

- The column display `name` / column metadata (stays in the caller, e.g. BPM's DTO).
- A built-in `lodash.template` (available only via the `render` hook).
- Any change to `@rfjs/data-filter`'s alias (`aliasData`/`aliasValue`).
- Migrating BPM call sites (separate repo, separate task).
- The unrelated `nested.helper` / camunda `Variables` resolver from BPM.

## Testing strategy

- **object-utils** — `getByPath.spec.ts`: the edge-case table above.
- **data-label**:
  - `normalizeKey` — bracket/dot stripping.
  - `buildLabelValues` — four-key lookup, value translation (hit + pass-through), missing path → null.
  - `composeLabel` — template with `_0`/raw-path/`aliasKey` tokens; no-template join (incl. keeping `0`); `valueMap` translation; `render` hook override; nullish → `''`; unknown token → `''`.

## Packaging / versioning

- `data-label` scaffold mirrors `retry`/`data-filter`: `tsdown` build, `vitest` unit, dual
  `README.md` + `README.zh-TW.md`, `tsconfig.json` + `tsconfig.build.json`, `eslint.config.mjs`.
  `dependencies`: `{ "@rfjs/object-utils": "workspace:*" }`. `publishConfig.access: public`.
  First version `0.1.0`.
- `object-utils` — **minor** changeset (new `getByPath` export).
- `data-label` — changeset for the initial `0.1.0` release.
- No `templates/registry.json` change (that registry is for `start-ts-by` templates, not
  `@rfjs/*` libraries).

## Relationship to the data-filter / jsonb-query convergence

`data-label` is independent of the filter-metadata convergence (object/array/elemmatch,
mapping registry). Its only tie-in is that it establishes `@rfjs/object-utils` as the home for
the shared `getByPath` path primitive — which `data-filter` may later adopt to unify path
resolution across the family.
