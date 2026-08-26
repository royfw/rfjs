---
"@rfjs/data-filter": minor
---

Put the condition **vocabulary** on the public surface, so a consumer can ask
"can the engine evaluate this condition?" before evaluating it — against the
same tables the evaluator dispatches on.

The gap this closes: a condition can be perfectly well-*shaped* and still name a
`dataType` the engine has never heard of. `{ field: 'x', dataType: 'wat',
operator: 'eq', value: 1 }` passes any shape check, and only throws
`[data-filter] unsupported dataType 'wat'` at evaluation time — which for a
consumer that validates at authoring time and evaluates later is a 500 at
runtime instead of a 400 at save time. The operator allowlists existed as real
`as const` arrays but were not exported; the dataType vocabulary had no runtime
counterpart at all.

**New exports**

- `validateCondition(condition)` / `validateMatchQuery(query)` —
  `{ ok: true } | { ok: false, issues }`, where each issue carries a stable
  `code`, the evaluator's own `message`, and a `path` naming the offending node.
  `validateMatchQuery` walks nested groups and `elemmatch` sub-groups and also
  checks each group's `logic`. A leaf's `field` is checked against the
  evaluator's own path guards (`unsupportedPath`), so a wildcard or `$`-rooted
  path is rejected at authoring time rather than throwing at evaluation; an
  `=` expression field is left to the async api. Vocabulary membership is
  tested against the raw value, never its rendered token — `typeof {}` is
  `'object'`, which would otherwise pass as the legitimate `object` dataType.
- `supportedOperators(dataType, elementType?)` — what the engine accepts there,
  or `undefined` when the type combination itself is not evaluable.
- `MATCH_QUERY_DATA_TYPES`, `MATCH_QUERY_ELEMENT_TYPES`, `LOGICAL_OPERATORS`,
  `OPERATORS_BY_DATA_TYPE`, `ELEM_MATCH_OPERATORS`,
  `assertMatchQueryDataType`, and the previously-internal operator module
  (`STRING_OPERATORS`, `NUMERIC_OPERATORS`, `DATE_OPERATORS`,
  `BOOLEAN_OPERATORS`, `OBJECT_OPERATORS`, `*_ARRAY_OPERATORS`,
  `ARRAY_OPERATORS_BY_ELEMENT`, `operatorsForArrayElement`, `assertOperator`).
- Types `MatchQueryConditionDataType` (= `MatchQueryMetadata['dataType']`),
  `MatchQueryElementType`, `ConditionIssue`, `ConditionIssueCode`,
  `VocabularyResult`.

**No second copy.** The operator tables *are* the arrays the matchers pass to
`assertOperator`, and the dataType/elementType/logic lists are `Object.keys` of
presence maps typed against `MatchQueryMetadata` / `LogicalOperator` — so a
dataType added to the union (and therefore to the `never`-exhaustive
`createMatchQuery` switch) fails to compile until it is listed.
`createMatchQuery` now gates on `MATCH_QUERY_DATA_TYPES` before dispatching, so
the exported list is load-bearing rather than descriptive: a dataType in the
switch but missing from the list stops evaluating.

**Behaviour**

- `dataType: 'array'` with an unknown `elementType` now throws
  `[data-filter] unsupported elementType '…' for dataType 'array'` instead of a
  `TypeError` from indexing the operator table blind (only reachable from
  untyped JSON input).
- Everything else is unchanged; the `unsupported dataType` message is identical.

Scope is vocabulary only — it does not validate tree *shape* (that is
`parseFilterGroup` in `@rfjs/filter-builder`) nor operator/value arity (`range`
still throws at runtime when not given two values).
