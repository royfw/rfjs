---
"@rfjs/flow-core": minor
---

Add `validateFlowConditions(doc)` and re-export `@rfjs/data-filter`'s condition
vocabulary from the copy flow-core actually evaluates with.

`edge.condition` is `unknown` in the schema, so an edge whose condition names a
`dataType`/`operator` the evaluator doesn't know saves and publishes fine and
then throws inside `resolveCondition` — at the moment a user submits, not at the
moment an author saves. `validateFlowConditions(doc)` walks every edge with a
condition and returns each problem as `{ edgeId, code, message, path }`, so a
consumer can turn it into a 400 that names the offending edge.

The re-export is the point, not a convenience. `resolveCondition` evaluates with
the `@rfjs/data-filter` in *flow-core's* dependency tree; a consumer that
depends on `@rfjs/data-filter` separately can resolve a different copy (pnpm
installs both without complaint), and then the vocabulary it validates against
is not the vocabulary that evaluates — the exact drift the vocabulary API exists
to prevent, one layer deeper. Importing `validateCondition`,
`validateMatchQuery`, `supportedOperators`, `MATCH_QUERY_DATA_TYPES`,
`MATCH_QUERY_ELEMENT_TYPES`, `LOGICAL_OPERATORS`, `OPERATORS_BY_DATA_TYPE` or
`ARRAY_OPERATORS_BY_ELEMENT` from `@rfjs/flow-core` makes that impossible.

Vocabulary only: tree *shape* is `@rfjs/filter-builder`'s `parseFilterGroup`,
and operator/value arity is still a runtime throw.
