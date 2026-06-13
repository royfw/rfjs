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
import { JsonbQueryError } from '../errors';

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

/** Array emptiness via jsonb_array_length, dialect-independent. Missing / non-array → both false. */
export function renderArrayEmptiness(
  column: string,
  field: string,
  operator: 'isempty' | 'isnotempty',
  params: ParamBuilder,
): string {
  const arr = `${column} #> ${params.add(fieldSegments(field))}`;
  const cmp = operator === 'isempty' ? '= 0' : '> 0';
  // CASE (not AND): Postgres does not guarantee AND short-circuits, so
  // jsonb_array_length must never reach a non-array value (it errors on scalars).
  return `(case when jsonb_typeof(${arr}) = 'array' then jsonb_array_length(${arr}) ${cmp} else false end)`;
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
    throw new JsonbQueryError(`Operator "${operator}" requires a single scalar value`, 'INVALID_SCALAR_VALUE');
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
    throw new JsonbQueryError(`Operator "${operator}" requires ${need}`, 'INVALID_ARRAY_VALUE');
  }
  if (exactLength !== undefined && value.length !== exactLength) {
    throw new JsonbQueryError(`Operator "${operator}" requires ${exactLength} values`, 'INVALID_ARRAY_VALUE');
  }
  if (exactLength === undefined && value.length === 0) {
    throw new JsonbQueryError(`Operator "${operator}" requires a non-empty array`, 'INVALID_ARRAY_VALUE');
  }
  return value;
}

const OPERATORS_BY_TYPE: Record<JsonbScalarType, ReadonlySet<JsonbScalarOperator>> = {
  string: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'contains', 'startswith', 'endswith', 'terms', 'icontains', 'istartswith', 'iendswith', 'ieq', 'ineq']),
  numeric: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'gt', 'gte', 'lt', 'lte', 'range', 'terms']),
  date: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'gt', 'gte', 'lt', 'lte', 'range', 'terms']),
  boolean: new Set(['eq', 'neq', 'isnull', 'isnotnull']),
};

export function assertOperatorForType(
  dataType: JsonbScalarType,
  operator: JsonbScalarOperator,
): void {
  if (!OPERATORS_BY_TYPE[dataType]?.has(operator)) {
    throw new JsonbQueryError(`Unsupported operator "${operator}" for type "${dataType}"`, 'UNSUPPORTED_OPERATOR');
  }
}

export function assertObjectValue(operator: string, value: unknown): JsonbObjectValue {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    value instanceof Date
  ) {
    throw new JsonbQueryError(`Operator "${operator}" requires a plain object value`, 'INVALID_OBJECT_VALUE');
  }
  return value as JsonbObjectValue;
}

export function assertKeyValue(operator: string, value: unknown): string {
  if (typeof value !== 'string') {
    throw new JsonbQueryError(`Operator "${operator}" requires a single string key`, 'INVALID_SCALAR_VALUE');
  }
  return value;
}

export function assertKeyArray(operator: string, value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((k) => typeof k === 'string')) {
    throw new JsonbQueryError(
      `Operator "${operator}" requires a non-empty array of string keys`,
      'INVALID_ARRAY_VALUE',
    );
  }
  return value;
}

const OBJECT_OPERATORS: ReadonlySet<JsonbObjectOperator> = new Set([
  'eq', 'neq', 'contains', 'isnull', 'isnotnull', 'haskey', 'hasanykey', 'hasallkeys',
]);

const ARRAY_OPERATORS_BY_ELEMENT: Record<JsonbScalarType, ReadonlySet<string>> = {
  string: new Set(['eq', 'neq', 'contains', 'startswith', 'endswith', 'terms', 'containsall', 'isnull', 'isnotnull', 'isempty', 'isnotempty']),
  numeric: new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'range', 'terms', 'containsall', 'isnull', 'isnotnull', 'isempty', 'isnotempty']),
  date: new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'range', 'terms', 'isnull', 'isnotnull', 'isempty', 'isnotempty']),
  boolean: new Set(['eq', 'neq', 'isnull', 'isnotnull', 'isempty', 'isnotempty']),
};

export function assertCondition(node: JsonbCondition): void {
  if (node.dataType === 'object') {
    if (!OBJECT_OPERATORS.has(node.operator)) {
      throw new JsonbQueryError(
        `Unsupported operator "${node.operator as string}" for type "object"`,
        'UNSUPPORTED_OPERATOR',
      );
    }
    return;
  }
  if (node.dataType === 'array') {
    if (node.elementType === 'object') {
      if ((node.operator as string) !== 'elemmatch') {
        throw new JsonbQueryError(
          `Unsupported operator "${node.operator as string}" for array of objects (use "elemmatch")`,
          'UNSUPPORTED_OPERATOR',
        );
      }
      if (!node.filters || !Array.isArray(node.filters.filters) || node.filters.filters.length === 0) {
        throw new JsonbQueryError(
          'Operator "elemmatch" requires a filter group with at least one condition',
          'EMPTY_FILTER_GROUP',
        );
      }
      return;
    }
    const ops = ARRAY_OPERATORS_BY_ELEMENT[node.elementType];
    if (!ops) {
      throw new JsonbQueryError(
        `Unsupported elementType ${JSON.stringify(node.elementType)} for array condition`,
        'INVALID_ELEMENT_TYPE',
      );
    }
    if (!ops.has(node.operator)) {
      throw new JsonbQueryError(
        `Unsupported operator "${node.operator as string}" for array elements of type "${node.elementType}"`,
        'UNSUPPORTED_OPERATOR',
      );
    }
    return;
  }
  assertOperatorForType(node.dataType, node.operator);
}

/**
 * True when any node in this elemmatch predicate subtree cannot be expressed as
 * a SQL/JSON path predicate (it needs `@>` / `#>>` instead): an object
 * condition, or a scalar-array `containsall`. Recurses through nested groups and
 * nested elemmatch — an outer path predicate can only embed a nested elemmatch
 * when the nested predicate is itself path-expressible.
 */
export function groupNeedsSqlFallback(group: JsonbFilterGroup): boolean {
  return group.filters.some((node) =>
    isFilterGroup(node) ? groupNeedsSqlFallback(node) : conditionNeedsSqlFallback(node),
  );
}

function conditionNeedsSqlFallback(node: JsonbCondition): boolean {
  if (node.dataType === 'object') {
    return true;
  }
  if (node.dataType === 'array') {
    if (node.elementType === 'object') {
      return groupNeedsSqlFallback(node.filters);
    }
    return node.operator === 'containsall' || node.operator === 'isempty' || node.operator === 'isnotempty';
  }
  return false;
}
