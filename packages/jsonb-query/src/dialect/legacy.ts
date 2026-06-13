import type { JsonbScalarType, JsonbScalarOperator, JsonbValue } from '../types';
import {
  type JsonbQueryDialect,
  fieldSegments,
  assertScalarValue,
  assertArrayValue,
  renderNullCheck,
  renderJsonbContains,
  renderArrayEmptiness,
} from './base';
import type { ParamBuilder } from '../param-builder';
import { JsonbQueryError } from '../errors';

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
    case 'ieq':
      return `(lower(${F}) = lower(${params.add(assertScalarValue(operator, value))}))`;
    case 'ineq':
      return `(lower(${F}) <> lower(${params.add(assertScalarValue(operator, value))}))`;
    case 'icontains':
      return `(position(lower(${params.add(assertScalarValue(operator, value))}) in lower(${F})) > 0)`;
    case 'istartswith': {
      const v = params.add(assertScalarValue(operator, value));
      return `(left(lower(${F}), char_length(lower(${v}))) = lower(${v}))`;
    }
    case 'iendswith': {
      const v = params.add(assertScalarValue(operator, value));
      return `(right(lower(${F}), char_length(lower(${v}))) = lower(${v}))`;
    }
    default:
      throw new JsonbQueryError(`Unsupported operator "${operator as string}"`, 'UNSUPPORTED_OPERATOR');
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
  renderArray(column, condition, ctx) {
    const { params } = ctx;
    const { field, elementType, operator, value } = condition;
    if (operator === 'isnull' || operator === 'isnotnull') {
      return renderNullCheck(column, field, operator, params);
    }
    if (operator === 'isempty' || operator === 'isnotempty') {
      return renderArrayEmptiness(column, field, operator, params);
    }
    if (operator === 'containsall') {
      return renderJsonbContains(column, field, assertArrayValue(operator, value), params);
    }
    const fParam = params.add(fieldSegments(field));
    const guarded = `case when jsonb_typeof(${column} #> ${fParam}) = 'array' then ${column} #> ${fParam} else '[]'::jsonb end`;
    const alias = ctx.nextAlias();
    // neq = "value not present" = NOT(exists element == value).
    const isNeq = operator === 'neq';
    const predicate = renderScalarOp(`${alias}.v`, elementType, isNeq ? 'eq' : operator, value, params);
    const exists = `(exists (select 1 from jsonb_array_elements_text(${guarded}) as ${alias}(v) where ${predicate}))`;
    return isNeq ? `(not ${exists})` : exists;
  },
  renderElemMatch(column, condition, ctx) {
    const fParam = ctx.params.add(fieldSegments(condition.field));
    const guarded = `case when jsonb_typeof(${column} #> ${fParam}) = 'array' then ${column} #> ${fParam} else '[]'::jsonb end`;
    const alias = ctx.nextAlias();
    const sub = ctx.renderGroup(condition.filters, `${alias}.value`);
    if (sub.length === 0) {
      throw new JsonbQueryError('Operator "elemmatch" requires a filter group with at least one condition', 'EMPTY_FILTER_GROUP');
    }
    return `(exists (select 1 from jsonb_array_elements(${guarded}) as ${alias} where ${sub}))`;
  },
};
