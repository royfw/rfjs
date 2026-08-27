# @rfjs/filter-builder

## 0.2.0

### Minor Changes

- 78451a2: Add `validateTree(tree, schema, options?)` with per-node error reporting;
  unify `contains` arity to `one` across all engine adapters (cross-engine
  portability); expose the full case-insensitive i-family
  (`icontains`/`istartswith`/`iendswith`/`ieq`/`ineq`) in the data-filter engine
  for cross-engine parity; and surface a malformed condition from `runLiveMatch`
  as a distinct `invalid` flag instead of collapsing it into `uncoverable`.

### Patch Changes

- 78451a2: Stop the data-filter engine adapter from offering an operator the engine
  rejects, and derive its coverage set from `@rfjs/data-filter`'s exported
  vocabulary instead of a hand-maintained copy.

  `operators('array', 'boolean')` advertised `containsall`, which
  `BOOLEAN_ARRAY_OPERATORS` does not carry (`containsall` is string/numeric/date
  by design) — so picking it in the editor produced a condition the evaluator
  throws on: the validator says fine, the engine throws. Removed, and pinned by a
  new subset guard that fails whenever the adapter offers anything
  `supportedOperators()` does not accept. The adapter's lists stay hand-written
  (offering a deliberate _subset_ is legitimate — `ieq`/`ineq` are still withheld
  on string arrays); only offering a _superset_ is now impossible.

  `DATA_FILTER_OPS` (the live-match coverage set) is now computed from
  `MATCH_QUERY_DATA_TYPES` × `supportedOperators()` rather than re-listed, so it
  cannot drift from what `matchQuery` accepts.

- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
  - @rfjs/es-query@0.1.1
  - @rfjs/data-filter@0.3.0
  - @rfjs/pg-filter@0.1.0

## 0.1.0

### Minor Changes

- 3b4cc8f: Add the `es-query` engine: compile the canonical filter-tree to an Elasticsearch / OpenSearch `bool` query via `@rfjs/es-query`. Available through `getEngine('es-query')`.
- f2c1372: The sql-filter engine adapter now offers the new column operators
  (endswith/terms/iX for text, terms/range for numeric/date) in the editor.

### Patch Changes

- Updated dependencies [ddf2103]
- Updated dependencies [f2c1372]
- Updated dependencies [f2c1372]
  - @rfjs/es-query@0.1.0
  - @rfjs/pg-filter@0.0.1
  - @rfjs/sql-filter@0.1.0
