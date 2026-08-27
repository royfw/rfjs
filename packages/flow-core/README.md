# @rfjs/flow-core

> 繁體中文 → [README.zh-TW.md](./README.zh-TW.md)

Framework-agnostic **FlowDoc contract** + pure projection + a pure
**state-machine runtime** for approval/workflow flows. It does the minimal,
scenario-agnostic core any sign-off flow needs — sequential advancement +
decision branching + timeout routing — as plain functions with no React, no
IO, no persistence.

```
schema.ts       FlowDoc / FlowNode / FlowEdge — the zod contract, and (de)serialization
projection.ts   projectFlow — node-type-filtering view, contracting edges through
runtime.ts      FlowState / FlowEvent / startFlow / advance / FlowError — the engine
condition.ts    resolveCondition / resolveHandle / validateFlowConditions — the
                @rfjs/data-filter bridge (evaluate, and validate against the
                same copy that evaluates)
```

Originally the FlowDoc contract lived inside `apps/web`'s `flow-builder` tool;
it now lives here so a runtime can consume it — the tool imports it back via
this package.

## Installation

```bash
npm install @rfjs/flow-core
```

## Quick start

A flow is a `FlowDoc`: nodes (`start` / `form` / `condition` / `action` /
`end`) + edges. `startFlow` locates `start` and advances to the first
"blocking" node; `advance` walks one step per external event and returns the
next `FlowState`.

```ts
import { startFlow, advance, type FlowDoc } from "@rfjs/flow-core";

// leave-request flow: start → form → condition(yes/no) → action → end
// the form also has a timeout edge → an escalation condition node
const doc: FlowDoc = {
  version: 1,
  nodes: [
    { id: "start", type: "start", position: { x: 0, y: 0 } },
    { id: "form1", type: "form", position: { x: 0, y: 0 } },
    { id: "cond1", type: "condition", position: { x: 0, y: 0 } },
    { id: "approve", type: "action", position: { x: 0, y: 0 } },
    { id: "reject", type: "action", position: { x: 0, y: 0 } },
    { id: "esc", type: "condition", position: { x: 0, y: 0 } },
    { id: "end", type: "end", position: { x: 0, y: 0 } },
  ],
  edges: [
    { id: "e0", source: "start", target: "form1" },
    { id: "e1", source: "form1", target: "cond1", trigger: "onSubmit" },
    { id: "et", source: "form1", target: "esc", trigger: "timeout" }, // conditional timeout
    { id: "e2", source: "cond1", target: "approve", sourceHandle: "yes" },
    { id: "e3", source: "cond1", target: "reject", sourceHandle: "no" },
    { id: "e4", source: "approve", target: "end" },
    { id: "e5", source: "reject", target: "end" },
    { id: "e6", source: "esc", target: "end", sourceHandle: "auto" },
  ],
};

let state = startFlow(doc);
// { at: "form1", status: "running", awaiting: "submit", context: {} }

state = advance(doc, state, { type: "submit", data: { days: 5 } });
// { at: "cond1", status: "running", awaiting: "decision", options: ["yes","no"], context: { days: 5 } }

state = advance(doc, state, { type: "decide", handle: "yes" });
// { at: "approve", status: "running", awaiting: "action", context: { days: 5 } }

state = advance(doc, state, { type: "complete", result: { ticket: "T-1" } });
// { at: "end", status: "done", awaiting: null, context: { days: 5, ticket: "T-1" } }
```

`state.context` accumulates every `submit.data` / `complete.result` (shallow
merge) — when `status === 'done'`, `context` **is** the flow's result.
Persisting `FlowState` between events (DB, session, …) is the consumer's job;
the engine is pure and stateless.

### Timeout & conditional timeout

The engine has no clock. A consumer-owned scheduler decides when a `form` or
`action` node's deadline has passed and feeds a `{ type: "timeout" }` event —
the engine just routes it along that node's `trigger: 'timeout'` edge:

```ts
const escalated = advance(
  doc,
  { at: "form1", status: "running", awaiting: "submit", context: {} },
  { type: "timeout" },
);
// → { at: "esc", status: "running", awaiting: "decision", options: ["auto"], context: {} }
```

A **conditional timeout** is nothing more than a `trigger:'timeout'` edge that
lands on a `condition` node instead of a plain escalation node — the engine
treats it exactly like any other condition, no separate feature needed. A
node with no `trigger:'timeout'` edge throws `FlowError('no-edge')` on a
`timeout` event.

### resolveCondition / resolveHandle

`advance` never evaluates conditions itself — `event.handle` must already be
decided. `resolveCondition`/`resolveHandle` (in `condition.ts`, depends on
`@rfjs/data-filter`) are optional helpers for consumers who'd rather have
`edge.condition` evaluated against `context` automatically:

```ts
import { resolveHandle } from "@rfjs/flow-core";

const handle = await resolveHandle(doc, "cond1", { days: 5 }); // → "yes" | "no" | null
if (handle) state = advance(doc, state, { type: "decide", handle });
```

`edge.condition` follows `@rfjs/data-filter`'s `FilterMatchQuery` shape. Edges
tried in order; the first whose condition matches `context` wins; an edge
with **no** `condition` is treated as always-true (a handy default/fallback
branch). `resolveHandle` returns `null` if nothing matches or the node has no
condition edges.

### validateFlowConditions — reject a bad condition at save time

An `edge.condition` is `unknown` in the schema, so a leaf naming a `dataType` or
`operator` the evaluator doesn't know saves and publishes fine and then throws
inside `resolveCondition` — at the moment a user submits, not at the moment an
author saves. Check it before persisting:

```ts
import { validateFlowConditions } from "@rfjs/flow-core";

const result = validateFlowConditions(doc);
if (!result.ok) return badRequest(result.issues);
// [{ edgeId: 'e2', code: 'unsupportedDataType',
//    message: "[data-filter] unsupported dataType 'wat'", path: 'filters[0]' }]
```

flow-core also re-exports the underlying condition vocabulary —
`validateCondition`, `validateMatchQuery`, `supportedOperators`,
`MATCH_QUERY_DATA_TYPES`, `MATCH_QUERY_ELEMENT_TYPES`, `LOGICAL_OPERATORS`,
`OPERATORS_BY_DATA_TYPE`, `ARRAY_OPERATORS_BY_ELEMENT`.

**Import them from here, not from `@rfjs/data-filter` directly.**
`resolveCondition` evaluates with the `@rfjs/data-filter` copy in *flow-core's*
dependency tree. A consumer that depends on `@rfjs/data-filter` separately can
end up resolving a different copy — pnpm will happily install both — and then
the vocabulary it validates against is not the vocabulary that evaluates. Taking
it from flow-core makes that physically impossible.

Scope: vocabulary only. The tree's *shape* is
[`@rfjs/filter-builder`](../filter-builder)'s `parseFilterGroup`; operator/value
arity (`range` wanting two values) is still a runtime throw.

## Contract

### `FlowState`

| Field | Type | Notes |
| --- | --- | --- |
| `at` | `string` | current node id |
| `status` | `'running' \| 'done' \| 'failed'` | |
| `awaiting` | `'submit' \| 'decision' \| 'action' \| null` | what the current node needs; `null` once `done`/`failed` |
| `options` | `string[]` (optional) | present when `awaiting === 'decision'` — the out-edges' `sourceHandle`s |
| `context` | `Record<string, unknown>` | accumulated data; equals the flow's result when `status === 'done'` |

### `FlowEvent`

| Variant | Valid at node type | Effect |
| --- | --- | --- |
| `{ type: 'submit', data }` | `form` | `data` shallow-merged into `context`; advances on the non-timeout out-edge |
| `{ type: 'decide', handle }` | `condition` | advances on the out-edge whose `sourceHandle === handle` |
| `{ type: 'complete', result? }` | `action` | `result` shallow-merged into `context`; advances on the non-timeout out-edge |
| `{ type: 'fail', error? }` | `action` | terminal: `status: 'failed'`, `awaiting: null`; `error` stored at `context.__error` |
| `{ type: 'timeout' }` | `form` \| `action` | advances on the node's `trigger: 'timeout'` out-edge |

### `FlowError`

An `Error` subclass named `FlowError`, with a `kind`:

| Kind | When |
| --- | --- |
| `wrong-event` | the event's type doesn't match the current node's `awaiting` (incl. any event sent to a `done`/`failed` flow) |
| `no-edge` | the node has no out-edge matching the event (e.g. missing `trigger:'timeout'` edge, or more/less than one non-timeout out-edge) |
| `unknown-handle` | a `decide` handle doesn't match any out-edge's `sourceHandle` |
| `no-path` | no `start` node, or `start` has no non-timeout out-edge |

### Other exports

- **`startFlow(doc)`** — locates `start`, advances along its non-timeout
  out-edge to the first blocking node.
- **`projectFlow(doc, { keep })`** — node-type-filtering projection: drops
  intermediate nodes not in `keep` and "contracts" their in/out edges
  through so the graph stays connected (e.g. project down to just
  `action`/`end` nodes for a summary view).
- **`parseFlow(json)`** / **`flowToJson(doc)`** / **`emptyFlow()`** —
  zod-validated (de)serialization, and a fresh single-`start` document.

## Non-goals (for now)

This is deliberately the **minimal** engine: sequencing, branching, and
timeout *routing*. The following are intentionally deferred until a concrete
downstream scenario pulls them in (see the [design
spec](../../docs/superpowers/specs/2026-07-09-rfjs-flow-core-runtime-design.md)
§7 for the reasoning):

- Parallel / multi-approver join (AND/OR/M-of-N) — needs a multi-token state
  model, not just a single `at` cursor.
- Back-transitions / retries after a `fail`.
- Timeout **scheduling** itself — measuring elapsed time and firing the
  event is the consumer's job; the engine only routes a `timeout` event once
  it arrives.
- Sub-flows.
- A dedicated result-mapping layer — `context` *is* the result; renaming or
  shaping output fields is left to the consumer.
- Persistence or scheduling of `FlowState` between events.

## Related packages

- **[@rfjs/data-filter](../data-filter)** — powers `resolveCondition` /
  `resolveHandle`'s evaluation of `edge.condition` against `context`.
- `apps/web`'s `flow-builder` tool — the visual editor that authors the
  `FlowDoc`s this runtime executes.
