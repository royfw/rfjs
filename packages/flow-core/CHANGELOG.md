# @rfjs/flow-core

## 0.1.0

### Minor Changes

- 9fd56c7: New package: publishable `@rfjs/flow-core` for approval/workflow flows — the `FlowDoc`/`FlowNode`/`FlowEdge`/`FlowNodeType` zod contract, a pure `projectFlow` projection, a pure state-machine runtime (`startFlow`/`advance` with `submit`/`decide`/`complete`/`fail`/`timeout` events, incl. timeout and conditional-timeout routing, and a named `FlowError`), and `resolveCondition`/`resolveHandle` helpers over `@rfjs/data-filter`. `apps/web`'s flow-builder tool now consumes it instead of owning the schema/projection itself.
