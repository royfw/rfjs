import type {
  JsonbScalarType,
  JsonbScalarOperator,
  JsonbValue,
} from './types';
import type { ParamBuilder } from './param-builder';

export interface ScalarDialect {
  /**
   * Render one condition into a SQL boolean expression, pushing any parameter
   * values onto `params`.
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
}

export function fieldSegments(field: string): string[] {
  return field.split('.');
}

export function assertScalarValue(
  operator: JsonbScalarOperator,
  value: JsonbValue | JsonbValue[] | undefined,
): JsonbValue {
  if (value === undefined || value === null || Array.isArray(value)) {
    throw new Error(`Operator "${operator}" requires a single scalar value`);
  }
  return value;
}

export function assertArrayValue(
  operator: JsonbScalarOperator,
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
