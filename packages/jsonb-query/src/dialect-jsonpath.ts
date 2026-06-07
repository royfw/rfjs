import type { JsonbScalarType, JsonbScalarOperator, JsonbValue } from './types';
import {
  type JsonbQueryDialect,
  fieldSegments,
  assertScalarValue,
  assertArrayValue,
  renderNullCheck,
} from './dialect';
import type { ParamBuilder } from './param-builder';
import { escapeJsonpathString, escapeRegexLiteral } from './escape';

/** `$."a"."b"` / `@."a"."b"` accessor for a dot path, members escaped. */
function memberAccessor(root: '$' | '@', field: string): string {
  return (
    root +
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

/** Allocates jsonpath variable names and collects their values. */
interface VarSink {
  vars: Record<string, JsonbValue>;
  one(value: JsonbValue): string;
  pair(lo: JsonbValue, hi: JsonbValue): [string, string];
  many(values: JsonbValue[]): string[];
}

/** Phase-1 naming for single-condition paths: $v, $lo/$hi, $v0… */
function namedSink(): VarSink {
  const vars: Record<string, JsonbValue> = {};
  return {
    vars,
    one(value) {
      vars.v = value;
      return 'v';
    },
    pair(lo, hi) {
      vars.lo = lo;
      vars.hi = hi;
      return ['lo', 'hi'];
    },
    many(values) {
      return values.map((v, i) => {
        vars[`v${i}`] = v;
        return `v${i}`;
      });
    },
  };
}

interface Predicate {
  pred: string;
  /** true when the predicate contains a top-level && / || and needs parens when embedded */
  compound: boolean;
}

function scalarPredicate(
  acc: string,
  dataType: JsonbScalarType,
  operator: JsonbScalarOperator,
  value: JsonbValue | JsonbValue[] | undefined,
  sink: VarSink,
): Predicate {
  const lhs = dataType === 'date' ? `${acc}.datetime()` : acc;
  const rhs = (name: string) => (dataType === 'date' ? `$${name}.datetime()` : `$${name}`);

  const comparator = COMPARATORS[operator];
  if (comparator) {
    const name = sink.one(assertScalarValue(operator, value));
    return { pred: `${lhs} ${comparator} ${rhs(name)}`, compound: false };
  }

  switch (operator) {
    case 'range': {
      const [lo, hi] = assertArrayValue(operator, value, 2);
      const [a, b] = sink.pair(lo, hi);
      return { pred: `${lhs} >= ${rhs(a)} && ${lhs} <= ${rhs(b)}`, compound: true };
    }
    case 'terms': {
      const items = assertArrayValue(operator, value);
      const names = sink.many(items);
      return {
        pred: names.map((name) => `${lhs} == ${rhs(name)}`).join(' || '),
        compound: items.length > 1,
      };
    }
    // startswith/contains/endswith are string predicates: they operate on the
    // text form (`acc`), never `.datetime()`.
    case 'startswith': {
      const name = sink.one(assertScalarValue(operator, value));
      return { pred: `${acc} starts with $${name}`, compound: false };
    }
    case 'contains': {
      const raw = String(assertScalarValue(operator, value));
      const lit = escapeJsonpathString(escapeRegexLiteral(raw));
      return { pred: `${acc} like_regex "${lit}"`, compound: false };
    }
    case 'endswith': {
      const raw = String(assertScalarValue(operator, value));
      const lit = escapeJsonpathString(escapeRegexLiteral(raw) + '$');
      return { pred: `${acc} like_regex "${lit}"`, compound: false };
    }
    // isnull/isnotnull only reach here inside elemmatch (root conditions use
    // the SQL fallback). Covers both a missing member and a JSON null, matching
    // legacy `#>>` semantics.
    case 'isnull':
      return { pred: `!exists (${acc}) || ${acc} == null`, compound: true };
    case 'isnotnull':
      return { pred: `exists (${acc}) && ${acc} != null`, compound: true };
    default:
      throw new Error(`Unsupported operator "${operator as string}"`);
  }
}

/** Emit jsonb_path_exists; omits the vars argument when no variables were used. */
function pathExists(
  column: string,
  path: string,
  vars: Record<string, JsonbValue>,
  params: ParamBuilder,
): string {
  const pParam = params.add(path);
  if (Object.keys(vars).length === 0) {
    return `jsonb_path_exists(${column}, ${pParam}::jsonpath)`;
  }
  return `jsonb_path_exists(${column}, ${pParam}::jsonpath, ${params.add(vars)}::jsonb)`;
}

export const jsonpathDialect: JsonbQueryDialect = {
  render(column, field, dataType, operator, value, params) {
    // isnull/isnotnull are dialect-independent.
    if (operator === 'isnull' || operator === 'isnotnull') {
      return renderNullCheck(column, field, operator, params);
    }
    const sink = namedSink();
    const { pred } = scalarPredicate('@', dataType, operator, value, sink);
    return pathExists(column, `${memberAccessor('$', field)} ? (${pred})`, sink.vars, params);
  },
  renderArray() {
    throw new Error('Not implemented');
  },
  renderElemMatch() {
    throw new Error('Not implemented');
  },
};
