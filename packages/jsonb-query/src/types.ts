export type JsonbDialect = 'legacy' | 'jsonpath';

export type JsonbScalarType = 'string' | 'numeric' | 'date' | 'boolean';

export type JsonbDataType = JsonbScalarType | 'object' | 'array';

export type JsonbValue = string | number | boolean | Date;

/** Value for object-typed conditions: a plain JSON-serializable object. */
export type JsonbObjectValue = Record<string, unknown>;

/**
 * Group logic, aligned with `@rfjs/data-filter`'s `LogicalOperator`:
 * `and` = all children match; `or` = any child matches;
 * `not` = NOT(all children match); `nor` = NOT(any child matches).
 */
export type JsonbLogicalOperator = 'and' | 'or' | 'nor' | 'not';

export type JsonbScalarOperator =
  | 'eq'
  | 'neq'
  | 'isnull'
  | 'isnotnull'
  | 'contains'
  | 'startswith'
  | 'endswith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'range'
  | 'terms';

export type JsonbObjectOperator = 'eq' | 'neq' | 'contains' | 'isnull' | 'isnotnull';

/**
 * Operators on arrays of scalars. Scalar operators use "some element matches"
 * (∃) semantics; `isnull`/`isnotnull` test the array field itself;
 * `containsall` requires every listed value to be present. `neq` means "value
 * not present" (∀ element ≠ value) — the negation of `eq`'s ∃-present.
 */
export type JsonbArrayOperator = JsonbScalarOperator | 'containsall';

export interface JsonbScalarCondition {
  field: string;
  dataType: JsonbScalarType;
  operator: JsonbScalarOperator;
  value?: JsonbValue | JsonbValue[];
  elementType?: never;
  filters?: never;
}

export interface JsonbObjectCondition {
  field: string;
  dataType: 'object';
  operator: JsonbObjectOperator;
  value?: JsonbObjectValue;
  elementType?: never;
  filters?: never;
}

export interface JsonbArrayCondition {
  field: string;
  dataType: 'array';
  elementType: JsonbScalarType;
  operator: JsonbArrayOperator;
  value?: JsonbValue | JsonbValue[];
  filters?: never;
}

export interface JsonbElemMatchCondition {
  field: string;
  dataType: 'array';
  elementType: 'object';
  operator: 'elemmatch';
  /** Conditions applied per element; each `field` is relative to the element. */
  filters: JsonbFilterGroup;
  value?: never;
}

export type JsonbCondition =
  | JsonbScalarCondition
  | JsonbObjectCondition
  | JsonbArrayCondition
  | JsonbElemMatchCondition;

export interface JsonbFilterGroup {
  logic: JsonbLogicalOperator;
  filters: Array<JsonbCondition | JsonbFilterGroup>;
}

export interface JsonbQueryResult {
  where: string;
  values: unknown[];
  /** Always `[]`. Array queries render as EXISTS subqueries inside `where`; reserved. */
  from: string[];
}

export interface BuildJsonbOptions {
  dialect?: JsonbDialect;
  paramOffset?: number;
}
