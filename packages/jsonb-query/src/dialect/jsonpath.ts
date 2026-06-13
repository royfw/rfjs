import type {
  JsonbScalarType,
  JsonbScalarOperator,
  JsonbValue,
  JsonbCondition,
  JsonbFilterGroup,
} from '../types';
import {
  type JsonbQueryDialect,
  fieldSegments,
  assertScalarValue,
  assertArrayValue,
  assertCondition,
  isFilterGroup,
  renderNullCheck,
  renderJsonbContains,
  renderArrayEmptiness,
  groupNeedsSqlFallback,
} from './base';
import { legacyDialect } from './legacy';
import type { ParamBuilder } from '../param-builder';
import { escapeJsonpathString, escapeRegexLiteral } from './escape';
import { JsonbQueryError } from '../errors';

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
  /** Set when a date condition is rendered; switches to jsonb_path_exists_tz. */
  tz: boolean;
  one(value: JsonbValue): string;
  pair(lo: JsonbValue, hi: JsonbValue): [string, string];
  many(values: JsonbValue[]): string[];
}

/** Phase-1 naming for single-condition paths: $v, $lo/$hi, $v0… */
function namedSink(): VarSink {
  const vars: Record<string, JsonbValue> = {};
  return {
    vars,
    tz: false,
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

/**
 * PG's jsonpath `.datetime()` does not recognize the trailing `Z` that JS
 * `Date#toISOString()` emits — normalize query-side values to an explicit
 * `+00:00` offset. (Stored data is the caller's responsibility; see README.)
 */
function normalizeDateValue(value: JsonbValue): JsonbValue {
  const text = value instanceof Date ? value.toISOString() : value;
  return typeof text === 'string' ? text.replace(/Z$/, '+00:00') : text;
}

function scalarPredicate(
  acc: string,
  dataType: JsonbScalarType,
  operator: JsonbScalarOperator,
  value: JsonbValue | JsonbValue[] | undefined,
  sink: VarSink,
): Predicate {
  const isDate = dataType === 'date';
  if (isDate) {
    // .datetime() comparisons are timezone-dependent; the plain
    // jsonb_path_exists() raises (and lax mode silently swallows) errors for
    // cross-type comparisons, so date conditions use the _tz variant.
    sink.tz = true;
  }
  const norm = (v: JsonbValue): JsonbValue => (isDate ? normalizeDateValue(v) : v);
  const lhs = isDate ? `${acc}.datetime()` : acc;
  const rhs = (name: string) => (isDate ? `$${name}.datetime()` : `$${name}`);

  const comparator = COMPARATORS[operator];
  if (comparator) {
    const name = sink.one(norm(assertScalarValue(operator, value)));
    return { pred: `${lhs} ${comparator} ${rhs(name)}`, compound: false };
  }

  switch (operator) {
    case 'range': {
      const [lo, hi] = assertArrayValue(operator, value, 2);
      const [a, b] = sink.pair(norm(lo), norm(hi));
      return { pred: `${lhs} >= ${rhs(a)} && ${lhs} <= ${rhs(b)}`, compound: true };
    }
    case 'terms': {
      const items = assertArrayValue(operator, value);
      const names = sink.many(items.map(norm));
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
    case 'icontains': {
      const lit = escapeJsonpathString(escapeRegexLiteral(String(assertScalarValue(operator, value))));
      return { pred: `${acc} like_regex "${lit}" flag "i"`, compound: false };
    }
    case 'istartswith': {
      const lit = escapeJsonpathString('^' + escapeRegexLiteral(String(assertScalarValue(operator, value))));
      return { pred: `${acc} like_regex "${lit}" flag "i"`, compound: false };
    }
    case 'iendswith': {
      const lit = escapeJsonpathString(escapeRegexLiteral(String(assertScalarValue(operator, value))) + '$');
      return { pred: `${acc} like_regex "${lit}" flag "i"`, compound: false };
    }
    case 'ieq': {
      const lit = escapeJsonpathString('^' + escapeRegexLiteral(String(assertScalarValue(operator, value))) + '$');
      return { pred: `${acc} like_regex "${lit}" flag "i"`, compound: false };
    }
    case 'ineq': {
      const lit = escapeJsonpathString('^' + escapeRegexLiteral(String(assertScalarValue(operator, value))) + '$');
      return { pred: `!(${acc} like_regex "${lit}" flag "i")`, compound: true };
    }
    default:
      throw new JsonbQueryError(`Unsupported operator "${operator as string}"`, 'UNSUPPORTED_OPERATOR');
  }
}

/** Emit jsonb_path_exists(_tz); omits the vars argument when no variables were used. */
function pathExists(
  column: string,
  path: string,
  vars: Record<string, JsonbValue>,
  params: ParamBuilder,
  tz: boolean,
): string {
  const fn = tz ? 'jsonb_path_exists_tz' : 'jsonb_path_exists';
  const pParam = params.add(path);
  if (Object.keys(vars).length === 0) {
    return `${fn}(${column}, ${pParam}::jsonpath)`;
  }
  return `${fn}(${column}, ${pParam}::jsonpath, ${params.add(vars)}::jsonb)`;
}

/** Sequential naming (v0, v1, …) for predicates that merge many conditions. */
function sequentialSink(): VarSink {
  const vars: Record<string, JsonbValue> = {};
  let n = 0;
  const next = (value: JsonbValue) => {
    const name = `v${n}`;
    n += 1;
    vars[name] = value;
    return name;
  };
  return {
    vars,
    tz: false,
    one: next,
    pair: (lo, hi) => [next(lo), next(hi)],
    many: (values) => values.map(next),
  };
}

const JSONPATH_EMPTY_IDENTITY: Record<JsonbFilterGroup['logic'], string> = {
  and: '1 == 1',
  or: '1 == 0',
  not: '1 == 0', // !(AND of nothing) = !(true)
  nor: '1 == 1', // !(OR of nothing) = !(false)
};

function groupPredicate(group: JsonbFilterGroup, sink: VarSink): string {
  const parts = group.filters
    .map((node) => {
      if (isFilterGroup(node)) {
        const inner = groupPredicate(node, sink);
        return inner.length > 0 ? `(${inner})` : '';
      }
      return conditionPredicate(node, sink);
    })
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return JSONPATH_EMPTY_IDENTITY[group.logic];
  }
  const joined = parts.join(group.logic === 'or' || group.logic === 'nor' ? ' || ' : ' && ');
  return group.logic === 'not' || group.logic === 'nor' ? `!(${joined})` : joined;
}

function conditionPredicate(node: JsonbCondition, sink: VarSink): string {
  assertCondition(node);
  if (node.dataType === 'array' && node.elementType === 'object') {
    const inner = groupPredicate(node.filters, sink);
    if (inner.length === 0) {
      throw new JsonbQueryError('Operator "elemmatch" requires a filter group with at least one condition', 'EMPTY_FILTER_GROUP');
    }
    return `exists (${memberAccessor('@', node.field)}[*] ? (${inner}))`;
  }
  if (node.dataType === 'array') {
    // scalar-element array nested inside elemmatch.
    const arr = node;
    const acc = memberAccessor('@', arr.field);
    if (arr.operator === 'isnull' || arr.operator === 'isnotnull') {
      const { pred } = scalarPredicate(acc, 'string', arr.operator, undefined, sink);
      return `(${pred})`;
    }
    // containsall never reaches here: groupNeedsSqlFallback routes such groups
    // to the SQL EXISTS fallback before any path predicate is built.
    const isNeq = arr.operator === 'neq';
    const operator = (isNeq ? 'eq' : arr.operator) as JsonbScalarOperator;
    const { pred } = scalarPredicate('@', arr.elementType, operator, arr.value, sink);
    const existsPred = `exists (${acc}[*] ? (${pred}))`;
    return isNeq ? `(!${existsPred})` : existsPred;
  }
  if (node.dataType === 'object') {
    // Unreachable: object conditions force the SQL EXISTS fallback. Guard
    // against silently mis-rendering an object as a scalar comparison.
    throw new JsonbQueryError(
      'Object conditions cannot be expressed as a jsonpath predicate',
      'UNSUPPORTED_OPERATOR',
    );
  }
  // assertCondition only lets scalar conditions through past this point.
  const scalar = node;
  const { pred, compound } = scalarPredicate(
    memberAccessor('@', scalar.field),
    scalar.dataType,
    scalar.operator,
    scalar.value,
    sink,
  );
  return compound ? `(${pred})` : pred;
}

export const jsonpathDialect: JsonbQueryDialect = {
  render(column, field, dataType, operator, value, params) {
    // isnull/isnotnull are dialect-independent.
    if (operator === 'isnull' || operator === 'isnotnull') {
      return renderNullCheck(column, field, operator, params);
    }
    const sink = namedSink();
    const { pred } = scalarPredicate('@', dataType, operator, value, sink);
    return pathExists(column, `${memberAccessor('$', field)} ? (${pred})`, sink.vars, params, sink.tz);
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
    const isNeq = operator === 'neq';
    const sink = namedSink();
    const { pred } = scalarPredicate('@', elementType, isNeq ? 'eq' : operator, value, sink);
    const exists = pathExists(column, `${memberAccessor('$', field)}[*] ? (${pred})`, sink.vars, params, sink.tz);
    return isNeq ? `(not ${exists})` : exists;
  },
  renderElemMatch(column, condition, ctx) {
    if (groupNeedsSqlFallback(condition.filters)) {
      // Object / containsall leaves can't live in a path predicate. Use the
      // legacy EXISTS shell; its body renders each leaf through THIS (jsonpath)
      // dialect via ctx.renderGroup.
      return legacyDialect.renderElemMatch(column, condition, ctx);
    }
    const sink = sequentialSink();
    const pred = groupPredicate(condition.filters, sink);
    if (pred.length === 0) {
      throw new JsonbQueryError('Operator "elemmatch" requires a filter group with at least one condition', 'EMPTY_FILTER_GROUP');
    }
    return pathExists(
      column,
      `${memberAccessor('$', condition.field)}[*] ? (${pred})`,
      sink.vars,
      ctx.params,
      sink.tz,
    );
  },
};
