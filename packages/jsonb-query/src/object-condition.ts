import type { JsonbObjectCondition } from './types';
import type { ParamBuilder } from './param-builder';
import {
  fieldSegments,
  assertObjectValue,
  renderNullCheck,
  renderJsonbContains,
} from './dialect';
import { JsonbQueryError } from './errors';

/**
 * Object conditions render the same SQL in both dialects: SQL/JSON path
 * predicates cannot compare or contain non-scalar values, so the jsonpath
 * dialect falls back to `#>` / `@>` (both GIN-indexable). jsonb `=` is
 * structural equality (key order and whitespace insensitive).
 */
export function renderObjectCondition(
  column: string,
  condition: JsonbObjectCondition,
  params: ParamBuilder,
): string {
  const { field, operator, value } = condition;
  switch (operator) {
    case 'isnull':
    case 'isnotnull':
      return renderNullCheck(column, field, operator, params);
    case 'contains':
      return renderJsonbContains(column, field, assertObjectValue(operator, value), params);
    case 'eq':
    case 'neq': {
      const obj = assertObjectValue(operator, value);
      const F = `(${column} #> ${params.add(fieldSegments(field))})`;
      return `(${F} ${operator === 'eq' ? '=' : '<>'} ${params.add(JSON.stringify(obj))}::jsonb)`;
    }
    default:
      throw new JsonbQueryError(`Unsupported operator "${operator as string}" for type "object"`, 'UNSUPPORTED_OPERATOR');
  }
}
