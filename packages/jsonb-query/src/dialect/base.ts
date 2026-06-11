import type {
  JsonbScalarType,
  JsonbScalarOperator,
  JsonbValue,
  JsonbCondition,
  JsonbFilterGroup,
  JsonbObjectOperator,
  JsonbObjectValue,
  JsonbArrayCondition,
  JsonbElemMatchCondition,
} from '../types';
import type { ParamBuilder } from '../param-builder';

export interface RenderContext {
  params: ParamBuilder;
  /** Allocate a unique table alias (e1, e2, …) for EXISTS subqueries. */
  nextAlias(): string;
  /** Render a nested filter group against an element expression (elemmatch scope). */
  renderGroup(group: JsonbFilterGroup, column: string): string;
}

export interface JsonbQueryDialect {
  /**
   * Render one scalar condition into a SQL boolean expression, pushing any
   * parameter values onto `params`.
   * @param column already-quoted column SQL, e.g. `"data"`
   * @param field  raw dot path, e.g. "address.city"
   */
  render(
    column: string,
    field: string,
    dataType: JsonbScalarType,
    operator: JsonbScalarOperator,
    value: JsonbValue | JsonbValue[] | undefined,
    params: ParamBuilder,
  ): string;
  /** Render a scalar-element array condition (∃ semantics / containsall / null checks). */
  renderArray(column: string, condition: JsonbArrayCondition, ctx: RenderContext): string;
  /** Render an array-of-objects condition (all sub-conditions on the same element). */
  renderElemMatch(column: string, condition: JsonbElemMatchCondition, ctx: RenderContext): string;
}

export function fieldSegments(field: string): string[] {
  return field.split('.');
}

export function isFilterGroup(
  node: JsonbCondition | JsonbFilterGroup,
): node is JsonbFilterGroup {
  return 'logic' in node && 'filters' in node;
}

/** `field IS [NOT] NULL` via `#>>`: SQL null for both missing keys and JSON null. */
export function renderNullCheck(
  column: string,
  field: string,
  operator: 'isnull' | 'isnotnull',
  params: ParamBuilder,
): string {
  const F = `(${column} #>> ${params.add(fieldSegments(field))})`;
  return operator === 'isnull' ? `(${F} is null)` : `(${F} is not null)`;
}

/**
 * JSONB containment (`@>`). `JSON.stringify` is required: node-postgres encodes
 * raw JS arrays as Postgres array literals ('{a,b}'), which are not valid jsonb.
 */
export function renderJsonbContains(
  column: string,
  field: string,
  value: unknown,
  params: ParamBuilder,
): string {
  const fParam = params.add(fieldSegments(field));
  return `((${column} #> ${fParam}) @> ${params.add(JSON.stringify(value))}::jsonb)`;
}

export function assertScalarValue(
  operator: string,
  value: JsonbValue | JsonbValue[] | undefined,
): JsonbValue {
  if (value === undefined || value === null || Array.isArray(value)) {
    throw new Error(`Operator "${operator}" requires a single scalar value`);
  }
  return value;
}

export function assertArrayValue(
  operator: string,
  value: JsonbValue | JsonbValue[] | undefined,
  exactLength?: number,
): JsonbValue[] {
  if (!Array.isArray(value)) {
    const need = exactLength !== undefined ? `${exactLength} values` : 'a non-empty array';
    throw new Error(`Operator "${operator}" requires ${need}`);
  }
  if (exactLength !== undefined && value.length !== exactLength) {
    throw new Error(`Operator "${operator}" requires ${exactLength} values`);
  }
  if (exactLength === undefined && value.length === 0) {
    throw new Error(`Operator "${operator}" requires a non-empty array`);
  }
  return value;
}

const OPERATORS_BY_TYPE: Record<JsonbScalarType, ReadonlySet<JsonbScalarOperator>> = {
  string: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'contains', 'startswith', 'endswith', 'terms']),
  numeric: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'gt', 'gte', 'lt', 'lte', 'range', 'terms']),
  date: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'gt', 'gte', 'lt', 'lte', 'range', 'terms']),
  boolean: new Set(['eq', 'neq', 'isnull', 'isnotnull']),
};

export function assertOperatorForType(
  dataType: JsonbScalarType,
  operator: JsonbScalarOperator,
): void {
  if (!OPERATORS_BY_TYPE[dataType]?.has(operator)) {
    throw new Error(`Unsupported operator "${operator}" for type "${dataType}"`);
  }
}

export function assertObjectValue(operator: string, value: unknown): JsonbObjectValue {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    value instanceof Date
  ) {
    throw new Error(`Operator "${operator}" requires a plain object value`);
  }
  return value as JsonbObjectValue;
}

const OBJECT_OPERATORS: ReadonlySet<JsonbObjectOperator> = new Set([
  'eq', 'neq', 'contains', 'isnull', 'isnotnull',
]);

const ARRAY_OPERATORS_BY_ELEMENT: Record<JsonbScalarType, ReadonlySet<string>> = {
  string: new Set(['eq', 'contains', 'startswith', 'endswith', 'terms', 'containsall', 'isnull', 'isnotnull']),
  numeric: new Set(['eq', 'gt', 'gte', 'lt', 'lte', 'range', 'terms', 'containsall', 'isnull', 'isnotnull']),
  date: new Set(['eq', 'gt', 'gte', 'lt', 'lte', 'range', 'terms', 'isnull', 'isnotnull']),
  boolean: new Set(['eq', 'isnull', 'isnotnull']),
};

export type ConditionScope = 'root' | 'elemmatch';

export function assertCondition(node: JsonbCondition, scope: ConditionScope): void {
  if (node.dataType === 'object') {
    if (scope === 'elemmatch') {
      throw new Error('Object conditions are not supported inside elemmatch');
    }
    if (!OBJECT_OPERATORS.has(node.operator)) {
      throw new Error(`Unsupported operator "${node.operator as string}" for type "object"`);
    }
    return;
  }
  if (node.dataType === 'array') {
    if (node.elementType === 'object') {
      if ((node.operator as string) !== 'elemmatch') {
        throw new Error(
          `Unsupported operator "${node.operator as string}" for array of objects (use "elemmatch")`,
        );
      }
      if (!node.filters || !Array.isArray(node.filters.filters) || node.filters.filters.length === 0) {
        throw new Error('Operator "elemmatch" requires a filter group with at least one condition');
      }
      return;
    }
    if (scope === 'elemmatch') {
      throw new Error('Array conditions with scalar elements are not supported inside elemmatch');
    }
    const ops = ARRAY_OPERATORS_BY_ELEMENT[node.elementType];
    if (!ops) {
      throw new Error(
        `Unsupported elementType ${JSON.stringify(node.elementType)} for array condition`,
      );
    }
    if (!ops.has(node.operator)) {
      throw new Error(
        `Unsupported operator "${node.operator as string}" for array elements of type "${node.elementType}"`,
      );
    }
    return;
  }
  assertOperatorForType(node.dataType, node.operator);
}
