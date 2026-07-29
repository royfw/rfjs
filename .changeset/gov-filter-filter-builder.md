---
"@rfjs/filter-builder": minor
---

Add `validateTree(tree, schema, options?)` with per-node error reporting;
unify `contains` arity to `one` across all engine adapters (cross-engine
portability); expose the full case-insensitive i-family
(`icontains`/`istartswith`/`iendswith`/`ieq`/`ineq`) in the data-filter engine
for cross-engine parity; and surface a malformed condition from `runLiveMatch`
as a distinct `invalid` flag instead of collapsing it into `uncoverable`.
