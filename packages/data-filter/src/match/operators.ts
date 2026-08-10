import type { MatchQueryDataType } from '../types';

export const STRING_OPERATORS = [
  'eq',
  'neq',
  'ieq',
  'ineq',
  'isnull',
  'isnotnull',
  'contains',
  'icontains',
  'startswith',
  'istartswith',
  'endswith',
  'iendswith',
  'terms',
] as const;

export const NUMERIC_OPERATORS = [
  'eq',
  'neq',
  'isnull',
  'isnotnull',
  'gt',
  'gte',
  'lt',
  'lte',
  'range',
  'terms',
] as const;

export const DATE_OPERATORS = NUMERIC_OPERATORS;

export const BOOLEAN_OPERATORS = [
  'eq',
  'neq',
  'isnull',
  'isnotnull',
] as const;

export const OBJECT_OPERATORS = [
  'eq',
  'neq',
  'contains',
  'isnull',
  'isnotnull',
] as const;

export const STRING_ARRAY_OPERATORS = [
  'eq', 'contains', 'icontains', 'startswith', 'istartswith', 'endswith', 'iendswith',
  'terms', 'containsall', 'isnull', 'isnotnull',
] as const;
export const NUMERIC_ARRAY_OPERATORS = [
  'eq', 'gt', 'gte', 'lt', 'lte', 'range', 'terms', 'containsall', 'isnull', 'isnotnull',
] as const;
export const DATE_ARRAY_OPERATORS = NUMERIC_ARRAY_OPERATORS;
export const BOOLEAN_ARRAY_OPERATORS = ['eq', 'isnull', 'isnotnull'] as const;

/**
 * Operator allowlist per **scalar** array `elementType`. Keyed by
 * `MatchQueryDataType`, so an element type added to that union has to be listed
 * here to compile. `elementType: 'object'` is not here — it routes to
 * `ElemMatch` and its only operator is `elemmatch`.
 */
export const ARRAY_OPERATORS_BY_ELEMENT: Record<
  MatchQueryDataType,
  readonly string[]
> = {
  string: STRING_ARRAY_OPERATORS,
  numeric: NUMERIC_ARRAY_OPERATORS,
  date: DATE_ARRAY_OPERATORS,
  boolean: BOOLEAN_ARRAY_OPERATORS,
};

/**
 * Own-property lookup into {@link ARRAY_OPERATORS_BY_ELEMENT}. Returns
 * `undefined` for an unknown element type instead of an inherited
 * `Object.prototype` member (`constructor`, `toString`, …), which would
 * otherwise reach `assertOperator` as a non-array `allowed` and blow up with a
 * `TypeError` rather than a domain error.
 */
export function operatorsForArrayElement(
  elementType: string,
): readonly string[] | undefined {
  return Object.prototype.hasOwnProperty.call(
    ARRAY_OPERATORS_BY_ELEMENT,
    elementType,
  )
    ? ARRAY_OPERATORS_BY_ELEMENT[elementType as MatchQueryDataType]
    : undefined;
}

/**
 * Throw if `operator` is not valid for `dataType`. Guards against typos,
 * type-mismatched operators, and inherited prototype names (`toString`,
 * `constructor`, …) being dispatched as match logic.
 */
export function assertOperator(
  dataType: string,
  operator: string,
  allowed: readonly string[],
): void {
  if (!allowed.includes(operator)) {
    throw new Error(
      `[data-filter] unsupported operator '${operator}' for dataType '${dataType}'`,
    );
  }
}
