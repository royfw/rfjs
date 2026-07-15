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
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

const NULLARY = new Set<ColumnOperator>(['isnull', 'isnotnull']);

const ALLOWED: Record<ColumnType, ReadonlySet<ColumnOperator>> = {
  text: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'contains', 'startswith', 'gt', 'gte', 'lt', 'lte']),
  numeric: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'gt', 'gte', 'lt', 'lte']),
  timestamp: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'gt', 'gte', 'lt', 'lte']),
  boolean: new Set(['eq', 'neq', 'isnull', 'isnotnull']),
  uuid: new Set(['eq', 'neq', 'isnull', 'isnotnull']),
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
  const comparator = COMPARATORS[operator];
  if (comparator === undefined) {
    // Unreachable for the current operator set (nullary/contains/startswith are handled above),
    // but guards against silently emitting `undefined` if the operator union grows.
    throw new ColumnQueryError(`Operator "${operator}" is not a comparison operator`, 'UNSUPPORTED_OPERATOR');
  }
  return `${quotedColumn} ${comparator} ${params.add(value)}`;
}
