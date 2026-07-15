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

const NULLARY = new Set<ColumnOperator>(['isnull', 'isnotnull']);

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
  if (NULLARY.has(operator)) {
    if (value !== undefined) {
      throw new ColumnQueryError(`Operator "${operator}" must not carry a value`, 'INVALID_VALUE');
    }
    return operator === 'isnull' ? `${quotedColumn} is null` : `${quotedColumn} is not null`;
  }
  if (value === undefined) {
    throw new ColumnQueryError(`Operator "${operator}" requires a value`, 'INVALID_VALUE');
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
    return `lower(${quotedColumn}) = lower(${params.add(value)})`;
  }
  if (operator === 'ineq') {
    return `lower(${quotedColumn}) <> lower(${params.add(value)})`;
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
