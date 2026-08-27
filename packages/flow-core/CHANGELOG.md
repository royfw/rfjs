# @rfjs/flow-core

## 0.2.0

### Minor Changes

- 78451a2: Add `validateFlowConditions(doc)` and re-export `@rfjs/data-filter`'s condition
  vocabulary from the copy flow-core actually evaluates with.

  `edge.condition` is `unknown` in the schema, so an edge whose condition names a
  `dataType`/`operator` the evaluator doesn't know saves and publishes fine and
  then throws inside `resolveCondition` — at the moment a user submits, not at the
  moment an author saves. `validateFlowConditions(doc)` walks every edge with a
  condition and returns each problem as `{ edgeId, code, message, path }`, so a
  consumer can turn it into a 400 that names the offending edge.

  The re-export is the point, not a convenience. `resolveCondition` evaluates with
  the `@rfjs/data-filter` in _flow-core's_ dependency tree; a consumer that
  depends on `@rfjs/data-filter` separately can resolve a different copy (pnpm
  installs both without complaint), and then the vocabulary it validates against
  is not the vocabulary that evaluates — the exact drift the vocabulary API exists
  to prevent, one layer deeper. Importing `validateCondition`,
  `validateMatchQuery`, `supportedOperators`, `MATCH_QUERY_DATA_TYPES`,
  `MATCH_QUERY_ELEMENT_TYPES`, `LOGICAL_OPERATORS`, `OPERATORS_BY_DATA_TYPE` or
  `ARRAY_OPERATORS_BY_ELEMENT` from `@rfjs/flow-core` makes that impossible.

  Vocabulary only: tree _shape_ is `@rfjs/filter-builder`'s `parseFilterGroup`,
  and operator/value arity is still a runtime throw.

- 78451a2: Add graph-traversal primitives and support condition-node timeouts (approval-escalation).

  **#280 — graph traversal / reachability API.** New public helpers so consumers no
  longer hand-roll BFS/DFS over `doc.edges`:

  - `nodeById(doc)` — `id → FlowNode` index (replaces the O(n) `doc.nodes.find`).
  - `outgoingEdges(doc)` — `source → FlowEdge[]` index (array order preserved).
  - `reachableNodes(doc, fromId, options?)` — forward BFS; visited-set cycle cutoff.
  - `ancestorNodes(doc, toId, options?)` — reverse BFS ("which nodes can reach here").
  - `TraversalOptions` — `includeSelf` (default false), `filter` (collection semantics:
    which nodes enter the result; filtered-out nodes are still expanded), and `follow`
    (traversal semantics: whether to walk an edge, e.g. exclude `trigger: 'timeout'`).

  Edges whose endpoint is missing from the node index (schema does not enforce
  referential integrity) are skipped, not treated as reachable. An unknown
  `fromId`/`toId` returns `[]`. Visitation order is deterministic given the
  `doc.edges` array order.

  **#265 — `timeout` events now support `condition` nodes.** The `advance` `"timeout"`
  case previously accepted only `form`/`action` nodes and rejected condition nodes with
  `FlowError('wrong-event')`, even though "an approval step times out and escalates" is
  the most typical BPM timeout scenario. It now also follows a `trigger: 'timeout'`
  out-edge from a `condition` node (no schema change — `edge.trigger` was already free
  text).

  Behavior notes:

  - When landing on a `condition` node, `trigger: 'timeout'` out-edges are now excluded
    from the human-selectable `options` (they are automatic escalation paths, not
    decisions a user picks).
  - Feeding a `timeout` event to a `condition` node that has no timeout out-edge now
    throws `FlowError('no-edge')` (previously `wrong-event`), consistent with `form`/
    `action` timeout behavior.

### Patch Changes

- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
  - @rfjs/data-filter@0.3.0

## 0.1.0

### Minor Changes

- 9fd56c7: New package: publishable `@rfjs/flow-core` for approval/workflow flows — the `FlowDoc`/`FlowNode`/`FlowEdge`/`FlowNodeType` zod contract, a pure `projectFlow` projection, a pure state-machine runtime (`startFlow`/`advance` with `submit`/`decide`/`complete`/`fail`/`timeout` events, incl. timeout and conditional-timeout routing, and a named `FlowError`), and `resolveCondition`/`resolveHandle` helpers over `@rfjs/data-filter`. `apps/web`'s flow-builder tool now consumes it instead of owning the schema/projection itself.
