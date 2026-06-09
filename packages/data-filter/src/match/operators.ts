export const STRING_OPERATORS = [
  'eq',
  'neq',
  'isnull',
  'isnotnull',
  'contains',
  'startswith',
  'endswith',
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
