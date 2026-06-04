---
"@rfjs/data-transform": patch
"@rfjs/mongo-query": patch
---

refactor(types): drop `any` from the public value types

- `@rfjs/data-transform`: `ValueType` and `JsonbValueType` no longer include
  `any` (which collapsed the whole union), so consumers get the real
  `string | number | boolean | Date | RegExp | null | undefined` surface. This
  was unblocked now that `@rfjs/jsonb-query` no longer imports these types.
- `@rfjs/mongo-query`: `toQuery` accepts `ValueType | ValueType[]` and threads
  `ValueType[]` through its handlers (no more `Array<any>`); `LogicalQuery`
  nodes are typed `MgoQueryNode` instead of `any`; `MgoFieldCondition.value`
  accepts an array for `terms`/`nin`. This clears the package's outstanding
  `no-unsafe-*` lint errors.
