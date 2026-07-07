# @rfjs/decision-table

DMN-style decision table composed from the @rfjs stack: each rule's condition is a
[`@rfjs/filter-builder`](../filter-builder) tree (arbitrarily nested and/or/nor/not +
elemmatch), outputs are constants or [`@rfjs/data-expr`](../data-expr) `"="` expressions
evaluated against the context, with `first` / `collect` hit policies and optional
`defaultOutputs`.

## Usage

```ts
import { evaluateTable, type DecisionTable } from '@rfjs/decision-table';

const table: DecisionTable = {
  version: 1,
  outputs: [{ key: 'approver' }],
  hitPolicy: 'first',
  rules: [
    { id: 'big', when: /* BuilderGroup: amount > 100000 */ group, outputs: { approver: 'CFO' } },
  ],
  defaultOutputs: { approver: 'Direct Manager' },
};

const result = await evaluateTable(table, { amount: 200000 });
// result.outputs → { approver: 'CFO' }; result.matched → ['big']
```

- Async (data-expr / JSONata). Rules whose conditions use operators `data-filter`
  cannot evaluate in memory are **never silently treated as non-matching** — they are
  skipped and reported in `result.ruleErrors` (or thrown with `{ strict: true }`).
- Nested tables are out of scope by design: chain decisions by orchestration
  (e.g. two decision-table nodes in a flow), not inside the table.
