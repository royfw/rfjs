---
"@rfjs/data-filter": patch
---

refactor(data-filter): type Match operator/value params, drop redundant unions

- The public `TextMatch` / `NumericMatch` / `DateMatch` / `BooleanMatch`
  constructors now take `value: ValueType` instead of `any`.
- Their `operator` params drop the redundant `| DefaultFilterOperator`
  (already included in each per-type operator union), and
  `MatchQueryMetadata.operator` is expressed as a flat, non-overlapping union —
  clearing the package's `no-redundant-type-constituents` lint errors. The
  resulting types are unchanged.
