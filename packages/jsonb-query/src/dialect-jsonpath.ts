import type { JsonbScalarOperator, JsonbValue } from './types';
import {
  type JsonbQueryDialect,
  fieldSegments,
  assertScalarValue,
  assertArrayValue,
  renderNullCheck,
} from './dialect';
import { escapeJsonpathString, escapeRegexLiteral } from './escape';

function basePath(field: string): string {
  return (
    '$' +
    fieldSegments(field)
      .map((seg) => `."${escapeJsonpathString(seg)}"`)
      .join('')
  );
}

const COMPARATORS: Partial<Record<JsonbScalarOperator, string>> = {
  eq: '==',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

export const jsonpathDialect: JsonbQueryDialect = {
  render(column, field, dataType, operator, value, params) {
    // isnull/isnotnull are dialect-independent.
    if (operator === 'isnull' || operator === 'isnotnull') {
      return renderNullCheck(column, field, operator, params);
    }

    const base = basePath(field);
    const lhs = dataType === 'date' ? '@.datetime()' : '@';
    const rhs = (name: string) => (dataType === 'date' ? `${name}.datetime()` : name);

    const withVars = (predicate: string, vars: Record<string, JsonbValue>): string => {
      const pParam = params.add(`${base} ? (${predicate})`);
      const vParam = params.add(vars);
      return `jsonb_path_exists(${column}, ${pParam}::jsonpath, ${vParam}::jsonb)`;
    };

    const withoutVars = (predicate: string): string => {
      const pParam = params.add(`${base} ? (${predicate})`);
      return `jsonb_path_exists(${column}, ${pParam}::jsonpath)`;
    };

    const comparator = COMPARATORS[operator];
    if (comparator) {
      const v = assertScalarValue(operator, value);
      return withVars(`${lhs} ${comparator} ${rhs('$v')}`, { v });
    }

    switch (operator) {
      case 'range': {
        const [lo, hi] = assertArrayValue(operator, value, 2);
        return withVars(
          `${lhs} >= ${rhs('$lo')} && ${lhs} <= ${rhs('$hi')}`,
          { lo, hi },
        );
      }
      case 'terms': {
        const items = assertArrayValue(operator, value);
        const vars: Record<string, JsonbValue> = {};
        const predicate = items
          .map((item, i) => {
            vars[`v${i}`] = item;
            return `${lhs} == ${rhs(`$v${i}`)}`;
          })
          .join(' || ');
        return withVars(predicate, vars);
      }
      // startswith/contains/endswith are string predicates: they operate on the
      // text form (`@`), never `.datetime()`. `lhs` is intentionally unused here.
      case 'startswith':
        return withVars('@ starts with $v', { v: assertScalarValue(operator, value) });
      case 'contains': {
        const raw = String(assertScalarValue(operator, value));
        const lit = escapeJsonpathString(escapeRegexLiteral(raw));
        return withoutVars(`@ like_regex "${lit}"`);
      }
      case 'endswith': {
        const raw = String(assertScalarValue(operator, value));
        const lit = escapeJsonpathString(escapeRegexLiteral(raw) + '$');
        return withoutVars(`@ like_regex "${lit}"`);
      }
      default:
        throw new Error(`Unsupported operator "${operator as string}"`);
    }
  },
  renderArray() {
    throw new Error('Not implemented');
  },
  renderElemMatch() {
    throw new Error('Not implemented');
  },
};
