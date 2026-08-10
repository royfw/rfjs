---
"@rfjs/filter-builder": patch
---

Stop the data-filter engine adapter from offering an operator the engine
rejects, and derive its coverage set from `@rfjs/data-filter`'s exported
vocabulary instead of a hand-maintained copy.

`operators('array', 'boolean')` advertised `containsall`, which
`BOOLEAN_ARRAY_OPERATORS` does not carry (`containsall` is string/numeric/date
by design) — so picking it in the editor produced a condition the evaluator
throws on: the validator says fine, the engine throws. Removed, and pinned by a
new subset guard that fails whenever the adapter offers anything
`supportedOperators()` does not accept. The adapter's lists stay hand-written
(offering a deliberate *subset* is legitimate — `ieq`/`ineq` are still withheld
on string arrays); only offering a *superset* is now impossible.

`DATA_FILTER_OPS` (the live-match coverage set) is now computed from
`MATCH_QUERY_DATA_TYPES` × `supportedOperators()` rather than re-listed, so it
cannot drift from what `matchQuery` accepts.
