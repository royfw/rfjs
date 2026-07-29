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

export const ARRAY_OPERATORS_BY_ELEMENT: Record<string, readonly string[]> = {
  string: STRING_ARRAY_OPERATORS,
  numeric: NUMERIC_ARRAY_OPERATORS,
  date: DATE_ARRAY_OPERATORS,
  boolean: BOOLEAN_ARRAY_OPERATORS,
};

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
