import { ParamBuilder } from '../param-builder';
import { ColumnQueryError } from '../errors';
import type { ColumnType } from './config';

export type ColumnOperator =
  | 'eq'
  | 'neq'
  | 'isnull'
  | 'isnotnull'
  | 'contains'
  | 'startswith'
  | 'endswith'
  | 'icontains'
  | 'istartswith'
  | 'iendswith'
  | 'ieq'
  | 'ineq'
  | 'terms'
  | 'range'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

/** Value-parameter count of a column operator (mirrors @rfjs/filter-builder's `OperatorArity`). */
type ColumnOperatorArity = 'none' | 'one' | 'two' | 'list';

// The arity table is duplicated here on purpose: this package is zero-dependency, so it
// cannot import @rfjs/filter-builder's `ARITY`. `Record<ColumnOperator, …>` keeps it
// exhaustive — adding an operator to the union fails typecheck until its arity is declared.
const ARITY: Record<ColumnOperator, ColumnOperatorArity> = {
  eq: 'one',
  neq: 'one',
  isnull: 'none',
  isnotnull: 'none',
  contains: 'one',
  startswith: 'one',
  endswith: 'one',
  icontains: 'one',
  istartswith: 'one',
  iendswith: 'one',
  ieq: 'one',
  ineq: 'one',
  terms: 'list',
  range: 'two',
  gt: 'one',
  gte: 'one',
  lt: 'one',
  lte: 'one',
};

// A single-value ("one") operator binds/serializes its value as one SQL scalar. Anything else
// (array, plain object, function, symbol) would be String()-coerced into a bogus term — e.g.
// contains + ['a','b'] → LIKE '%a,b%' — which runs, matches nothing, and signals nothing (#288).
function isScalarValue(value: unknown): boolean {
  if (value === null || value instanceof Date) return true;
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint';
}

function describeValue(value: unknown): string {
  if (Array.isArray(value)) return `an array (${value.length} item${value.length === 1 ? '' : 's'})`;
  const t = typeof value;
  if (t === 'object') return 'an object';
  return `a ${t}`;
}

const ALLOWED: Record<ColumnType, ReadonlySet<ColumnOperator>> = {
  text: new Set([
    'eq',
    'neq',
    'isnull',
    'isnotnull',
    'contains',
    'startswith',
    'endswith',
    'icontains',
    'istartswith',
    'iendswith',
    'ieq',
    'ineq',
    'terms',
    'gt',
    'gte',
    'lt',
    'lte',
  ]),
  numeric: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'gt', 'gte', 'lt', 'lte', 'terms', 'range']),
  timestamp: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'gt', 'gte', 'lt', 'lte', 'terms', 'range']),
  boolean: new Set(['eq', 'neq', 'isnull', 'isnotnull']),
  uuid: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'terms']),
};

const COMPARATORS: Partial<Record<ColumnOperator, string>> = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

// Escape LIKE metacharacters so the bound term matches verbatim (paired with ESCAPE '\').
function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function renderColumnCondition(
  quotedColumn: string,
  type: ColumnType,
  operator: ColumnOperator,
  value: unknown,
  params: ParamBuilder,
): string {
  if (!ALLOWED[type].has(operator)) {
    throw new ColumnQueryError(
      `Operator "${operator}" is not supported for ${type} column`,
      'UNSUPPORTED_OPERATOR',
    );
  }
  if (ARITY[operator] === 'none') {
    if (value !== undefined) {
      throw new ColumnQueryError(`Operator "${operator}" must not carry a value`, 'INVALID_VALUE');
    }
    return operator === 'isnull' ? `${quotedColumn} is null` : `${quotedColumn} is not null`;
  }
  if (value === undefined) {
    throw new ColumnQueryError(`Operator "${operator}" requires a value`, 'INVALID_VALUE');
  }
  if (ARITY[operator] === 'one' && !isScalarValue(value)) {
    throw new ColumnQueryError(
      `Operator "${operator}" requires a single scalar value, received ${describeValue(value)}; ` +
        `only "terms" and "range" take a non-scalar value`,
      'NON_SCALAR_VALUE',
    );
  }
  if (operator === 'contains') {
    return `${quotedColumn} like '%' || ${params.add(escapeLike(String(value)))} || '%' escape '\\'`;
  }
  if (operator === 'startswith') {
    return `${quotedColumn} like ${params.add(escapeLike(String(value)))} || '%' escape '\\'`;
  }
  if (operator === 'endswith') {
    return `${quotedColumn} like '%' || ${params.add(escapeLike(String(value)))} escape '\\'`;
  }
  if (operator === 'icontains') {
    return `${quotedColumn} ilike '%' || ${params.add(escapeLike(String(value)))} || '%' escape '\\'`;
  }
  if (operator === 'istartswith') {
    return `${quotedColumn} ilike ${params.add(escapeLike(String(value)))} || '%' escape '\\'`;
  }
  if (operator === 'iendswith') {
    return `${quotedColumn} ilike '%' || ${params.add(escapeLike(String(value)))} escape '\\'`;
  }
  if (operator === 'ieq') {
    return `lower(${quotedColumn}) = lower(${params.add(String(value))})`;
  }
  if (operator === 'ineq') {
    return `lower(${quotedColumn}) <> lower(${params.add(String(value))})`;
  }
  if (operator === 'terms') {
    if (!Array.isArray(value) || value.length === 0) {
      throw new ColumnQueryError(`Operator "terms" requires a non-empty array`, 'INVALID_VALUE');
    }
    return `${quotedColumn} = any(${params.add(value)})`;
  }
  if (operator === 'range') {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new ColumnQueryError(`Operator "range" requires a [lo, hi] array`, 'INVALID_VALUE');
    }
    return `${quotedColumn} between ${params.add(value[0])} and ${params.add(value[1])}`;
  }
  const comparator = COMPARATORS[operator];
  if (comparator === undefined) {
    // Unreachable for the current operator set (nullary/contains/startswith are handled above),
    // but guards against silently emitting `undefined` if the operator union grows.
    throw new ColumnQueryError(`Operator "${operator}" is not a comparison operator`, 'UNSUPPORTED_OPERATOR');
  }
  return `${quotedColumn} ${comparator} ${params.add(value)}`;
}
