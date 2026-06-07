import type { JsonbScalarType, JsonbScalarOperator, JsonbValue } from './types';
import {
  type JsonbQueryDialect,
  fieldSegments,
  assertScalarValue,
  assertArrayValue,
  renderNullCheck,
} from './dialect';
import type { ParamBuilder } from './param-builder';

const CASTS: Record<JsonbScalarType, string> = {
  string: '',
  numeric: '::numeric',
  date: '::timestamptz',
  boolean: '::boolean',
};

const ARRAY_CASTS: Record<JsonbScalarType, string> = {
  string: '::text[]',
  numeric: '::numeric[]',
  date: '::timestamptz[]',
  boolean: '::boolean[]',
};

/** Render a scalar operator against `F`, a text-valued SQL expression. */
function renderScalarOp(
  F: string,
  dataType: JsonbScalarType,
  operator: JsonbScalarOperator,
  value: JsonbValue | JsonbValue[] | undefined,
  params: ParamBuilder,
): string {
  const Fc = `${F}${CASTS[dataType]}`;
  switch (operator) {
    case 'eq':
      return `(${Fc} = ${params.add(assertScalarValue(operator, value))})`;
    case 'neq':
      return `(${Fc} <> ${params.add(assertScalarValue(operator, value))})`;
    case 'gt':
      return `(${Fc} > ${params.add(assertScalarValue(operator, value))})`;
    case 'gte':
      return `(${Fc} >= ${params.add(assertScalarValue(operator, value))})`;
    case 'lt':
      return `(${Fc} < ${params.add(assertScalarValue(operator, value))})`;
    case 'lte':
      return `(${Fc} <= ${params.add(assertScalarValue(operator, value))})`;
    case 'range': {
      const [lo, hi] = assertArrayValue(operator, value, 2);
      return `(${Fc} between ${params.add(lo)} and ${params.add(hi)})`;
    }
    case 'terms':
      return `(${Fc} = ANY(${params.add(assertArrayValue(operator, value))}${ARRAY_CASTS[dataType]}))`;
    case 'contains':
      return `(position(${params.add(assertScalarValue(operator, value))} in ${F}) > 0)`;
    case 'startswith': {
      const v = params.add(assertScalarValue(operator, value));
      return `(left(${F}, char_length(${v})) = ${v})`;
    }
    case 'endswith': {
      const v = params.add(assertScalarValue(operator, value));
      return `(right(${F}, char_length(${v})) = ${v})`;
    }
    default:
      throw new Error(`Unsupported operator "${operator as string}"`);
  }
}

export const legacyDialect: JsonbQueryDialect = {
  render(column, field, dataType, operator, value, params) {
    if (operator === 'isnull' || operator === 'isnotnull') {
      return renderNullCheck(column, field, operator, params);
    }
    const F = `(${column} #>> ${params.add(fieldSegments(field))})`;
    return renderScalarOp(F, dataType, operator, value, params);
  },
  renderArray() {
    throw new Error('Not implemented');
  },
  renderElemMatch() {
    throw new Error('Not implemented');
  },
};
