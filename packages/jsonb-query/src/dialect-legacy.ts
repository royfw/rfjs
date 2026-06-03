import type { JsonbScalarType } from './types';
import {
  type ScalarDialect,
  fieldSegments,
  assertScalarValue,
  assertArrayValue,
} from './dialect';

const CASTS: Record<JsonbScalarType, string> = {
  string: '',
  numeric: '::numeric',
  date: '::timestamptz',
  boolean: '::boolean',
};

export const legacyDialect: ScalarDialect = {
  render(column, field, dataType, operator, value, params) {
    const fParam = params.add(fieldSegments(field));
    const F = `(${column} #>> ${fParam})`;
    const Fc = `${F}${CASTS[dataType]}`;

    switch (operator) {
      case 'isnull':
        return `(${F} is null)`;
      case 'isnotnull':
        return `(${F} is not null)`;
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
        return `(${Fc} = ANY(${params.add(assertArrayValue(operator, value))}))`;
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
  },
};
