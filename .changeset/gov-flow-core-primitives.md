---
"@rfjs/flow-core": minor
---

Add graph-traversal primitives and support condition-node timeouts (approval-escalation).

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
