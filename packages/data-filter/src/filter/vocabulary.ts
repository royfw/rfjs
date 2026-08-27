import { isExpression } from '@rfjs/data-expr';

import {
  BOOLEAN_OPERATORS,
  DATE_OPERATORS,
  NUMERIC_OPERATORS,
  OBJECT_OPERATORS,
  STRING_OPERATORS,
  operatorsForArrayElement,
} from '../match/operators';
import { assertSupportedPath, hasWildcardSyntax } from '../path/resolve';
import type { LogicalOperator, MatchQueryMetadata } from '../types';

/**
 * The `dataType` discriminant of every condition the evaluator can dispatch —
 * derived from `MatchQueryMetadata`, never re-typed. `MatchQueryDataType` is a
 * *different*, narrower set: it is the scalar/element vocabulary (no `object`,
 * no `array`) and is what an `array` condition's `elementType` may be.
 */
export type MatchQueryConditionDataType = MatchQueryMetadata['dataType'];

/** What `dataType: 'array'` may declare as its `elementType`, derived from the union. */
export type MatchQueryElementType = Extract<
  MatchQueryMetadata,
  { dataType: 'array' }
>['elementType'];

/**
 * Presence maps, not hand-written lists. TypeScript rejects the literal if a
 * member of the union is missing (and rejects an extra key), and
 * `createMatchQuery`'s `default` arm is a `never` exhaustiveness assertion — so
 * the union, the dispatch switch, and these tables cannot drift apart. The
 * exported arrays are the `Object.keys` of the maps, so there is exactly one
 * declaration of each vocabulary in the package.
 */
const DATA_TYPE_PRESENCE: Record<MatchQueryConditionDataType, true> = {
  string: true,
  numeric: true,
  date: true,
  boolean: true,
  object: true,
  array: true,
};

const ELEMENT_TYPE_PRESENCE: Record<MatchQueryElementType, true> = {
  string: true,
  numeric: true,
  date: true,
  boolean: true,
  object: true,
};

const LOGICAL_OPERATOR_PRESENCE: Record<LogicalOperator, true> = {
  and: true,
  or: true,
  nor: true,
  not: true,
};

/** Every `dataType` a condition leaf may declare. */
export const MATCH_QUERY_DATA_TYPES = Object.keys(
  DATA_TYPE_PRESENCE,
) as readonly MatchQueryConditionDataType[];

/** Every `elementType` a `dataType: 'array'` leaf may declare. */
export const MATCH_QUERY_ELEMENT_TYPES = Object.keys(
  ELEMENT_TYPE_PRESENCE,
) as readonly MatchQueryElementType[];

/** Every `logic` a filter group may declare. */
export const LOGICAL_OPERATORS = Object.keys(
  LOGICAL_OPERATOR_PRESENCE,
) as readonly LogicalOperator[];

/** `elemmatch` is the only operator for `dataType: 'array'` + `elementType: 'object'`. */
export const ELEM_MATCH_OPERATORS = ['elemmatch'] as const;

/**
 * Operator allowlist per non-`array` `dataType` — the very arrays the matchers
 * pass to `assertOperator`, not a copy of them. `array` is absent because its
 * operators depend on `elementType`; use {@link supportedOperators}.
 */
export const OPERATORS_BY_DATA_TYPE: Record<
  Exclude<MatchQueryConditionDataType, 'array'>,
  readonly string[]
> = {
  string: STRING_OPERATORS,
  numeric: NUMERIC_OPERATORS,
  date: DATE_OPERATORS,
  boolean: BOOLEAN_OPERATORS,
  object: OBJECT_OPERATORS,
};

function ownOperators(dataType: string): readonly string[] | undefined {
  return Object.prototype.hasOwnProperty.call(OPERATORS_BY_DATA_TYPE, dataType)
    ? OPERATORS_BY_DATA_TYPE[
        dataType as Exclude<MatchQueryConditionDataType, 'array'>
      ]
    : undefined;
}

/**
 * The operators the evaluator accepts for a `dataType` (+ `elementType` when
 * the dataType is `array`), or `undefined` when the type combination itself is
 * not evaluable. Use this to populate a picker; use {@link validateCondition}
 * to check one condition.
 */
export function supportedOperators(
  dataType: string,
  elementType?: string,
): readonly string[] | undefined {
  if (dataType === 'array') {
    if (elementType === undefined) return undefined;
    if (elementType === 'object') return ELEM_MATCH_OPERATORS;
    return operatorsForArrayElement(elementType);
  }
  return ownOperators(dataType);
}

/**
 * Throw the evaluator's own "unsupported dataType" error for a `dataType` that
 * is not in {@link MATCH_QUERY_DATA_TYPES}. Called by `createMatchQuery` before
 * it dispatches, which is what makes the exported list load-bearing: a dataType
 * that reaches the switch but is missing here fails every test that uses it.
 */
export function assertMatchQueryDataType(dataType: string): void {
  if (
    !(MATCH_QUERY_DATA_TYPES as readonly string[]).includes(dataType)
  ) {
    throw new Error(`[data-filter] unsupported dataType '${dataType}'`);
  }
}

export type ConditionIssueCode =
  | 'notAnObject'
  | 'unsupportedLogic'
  | 'invalidFilters'
  | 'unsupportedDataType'
  | 'missingElementType'
  | 'unsupportedElementType'
  | 'unsupportedOperator'
  | 'unsupportedPath';

export interface ConditionIssue {
  code: ConditionIssueCode;
  /**
   * The wording the evaluator itself throws for this case, where it has one —
   * so an authoring-time 400 and a runtime 500 read the same.
   */
  message: string;
  /**
   * Location of the offending node inside the validated value. `''` for a leaf
   * validated on its own; `filters[0].filters[2]` inside a group.
   */
  path: string;
}

export type VocabularyResult =
  | { ok: true }
  | { ok: false; issues: ConditionIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Render an untrusted vocabulary token for an error message. Never falls back
 * to `[object Object]` — a non-primitive is reported as its `typeof`.
 *
 * Rendering only. Never test membership against this: `typeof {}` is
 * `'object'`, which collides with the legitimate `'object'` dataType and
 * elementType — use {@link isMember}.
 */
function token(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return typeof value;
}

/**
 * Membership in a vocabulary list. A non-string is never a member, however it
 * renders — the evaluator compares the raw value, so `{ dataType: {} }` must
 * fail here exactly as it throws there.
 */
function isMember(value: unknown, vocabulary: readonly string[]): boolean {
  return typeof value === 'string' && vocabulary.includes(value);
}

/**
 * Mirrors `matchQuery`'s own group/leaf discrimination (`_.has(filter, 'logic')`)
 * so the validator walks exactly the nodes the evaluator walks.
 */
function isGroupNode(node: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(node, 'logic');
}

/**
 * The evaluator's own path guards, reused rather than re-expressed — a `field`
 * this blesses is one the matchers accept, and the wording matches the throw.
 * Returns whether an issue was recorded.
 *
 * An `=` expression is not a path: `compileMatchQuery` / `matchQueryAsync`
 * resolve it, so it is left alone here.
 */
function collectFieldIssue(
  field: unknown,
  dataType: string,
  path: string,
  issues: ConditionIssue[],
): boolean {
  const push = (message: string): true => {
    issues.push({ code: 'unsupportedPath', message, path });
    return true;
  };
  if (typeof field !== 'string') {
    return push(`[data-filter] condition field must be a string, got ${token(field)}`);
  }
  if (isExpression(field)) return false;
  // `object` and `array` reject a wildcard field with their own, narrower
  // wording inside the dispatch switch, before the generic guard ever runs.
  if (hasWildcardSyntax(field)) {
    if (dataType === 'object') {
      return push(
        `[data-filter] wildcard field is not supported for dataType 'object'; point field at the value`,
      );
    }
    if (dataType === 'array') {
      return push(
        `[data-filter] wildcard field is not supported for dataType 'array'; point field at the value, or compose with elemmatch`,
      );
    }
  }
  try {
    assertSupportedPath(field);
  } catch (error) {
    return push(error instanceof Error ? error.message : String(error));
  }
  return false;
}

function collectConditionIssues(
  condition: unknown,
  path: string,
  issues: ConditionIssue[],
): void {
  if (!isRecord(condition)) {
    issues.push({
      code: 'notAnObject',
      message: `[data-filter] condition must be an object`,
      path,
    });
    return;
  }
  const dataType = token(condition.dataType);
  const operator = token(condition.operator);

  if (!isMember(condition.dataType, MATCH_QUERY_DATA_TYPES)) {
    issues.push({
      code: 'unsupportedDataType',
      message: `[data-filter] unsupported dataType '${dataType}'`,
      path,
    });
    return;
  }

  // After the dataType gate, mirroring the evaluator, which validates the
  // dataType before it dispatches on it. A leaf wrong in several ways reports
  // the path first.
  if (collectFieldIssue(condition.field, dataType, path, issues)) return;

  if (dataType === 'array') {
    if (condition.elementType === undefined) {
      issues.push({
        code: 'missingElementType',
        message: `[data-filter] dataType 'array' requires an elementType`,
        path,
      });
      return;
    }
    const elementType = token(condition.elementType);
    if (!isMember(condition.elementType, MATCH_QUERY_ELEMENT_TYPES)) {
      issues.push({
        code: 'unsupportedElementType',
        message: `[data-filter] unsupported elementType '${elementType}' for dataType 'array'`,
        path,
      });
      return;
    }
    const allowed = supportedOperators(dataType, elementType);
    if (allowed === undefined || !isMember(condition.operator, allowed)) {
      issues.push({
        code: 'unsupportedOperator',
        message: `[data-filter] unsupported operator '${operator}' for dataType 'array<${elementType}>'`,
        path,
      });
      return;
    }
    // `elemmatch` nests a whole group whose leaves the evaluator dispatches the
    // same way — a bad dataType down there throws just as loudly, so recurse.
    if (elementType === 'object') {
      collectQueryIssues(condition.filters, `${path ? `${path}.` : ''}filters`, issues);
    }
    return;
  }

  const allowed = supportedOperators(dataType);
  if (allowed === undefined || !isMember(condition.operator, allowed)) {
    issues.push({
      code: 'unsupportedOperator',
      message: `[data-filter] unsupported operator '${operator}' for dataType '${dataType}'`,
      path,
    });
  }
}

function collectQueryIssues(
  query: unknown,
  path: string,
  issues: ConditionIssue[],
): void {
  if (!isRecord(query)) {
    issues.push({
      code: 'notAnObject',
      message: `[data-filter] filter group must be an object`,
      path,
    });
    return;
  }
  const logic = token(query.logic);
  if (!(LOGICAL_OPERATORS as readonly string[]).includes(logic)) {
    // The evaluator does not throw here — `logicMatchQuery` falls through its
    // switch and returns `false`, i.e. an unknown logic silently matches
    // nothing. Reject it at authoring time instead.
    issues.push({
      code: 'unsupportedLogic',
      message: `[data-filter] unsupported logic '${logic}'`,
      path,
    });
  }
  if (!Array.isArray(query.filters)) {
    issues.push({
      code: 'invalidFilters',
      message: `[data-filter] filter group requires a 'filters' array`,
      path,
    });
    return;
  }
  query.filters.forEach((child, index) => {
    const childPath = `${path ? `${path}.` : ''}filters[${index}]`;
    if (isRecord(child) && isGroupNode(child)) {
      collectQueryIssues(child, childPath, issues);
    } else {
      collectConditionIssues(child, childPath, issues);
    }
  });
}

/**
 * Answer "can the engine evaluate this condition leaf?" against the same
 * dataType/operator tables `createMatchQuery` and the matchers dispatch on.
 *
 * Vocabulary only — it does not check the tree's *shape* (that is
 * `parseFilterGroup` in `@rfjs/filter-builder`) nor whether `value` suits the
 * operator (e.g. `range` wanting exactly two values). An `elemmatch` leaf's
 * nested group is walked, because those leaves reach the same dispatch.
 *
 * ```ts
 * validateCondition({ field: 'x', dataType: 'wat', operator: 'eq', value: 1 });
 * // { ok: false, issues: [{ code: 'unsupportedDataType', message: "[data-filter] unsupported dataType 'wat'", path: '' }] }
 * ```
 */
export function validateCondition(condition: unknown): VocabularyResult {
  const issues: ConditionIssue[] = [];
  collectConditionIssues(condition, '', issues);
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * {@link validateCondition} over a whole `FilterMatchQuery`: walks nested
 * groups and `elemmatch` sub-groups, and also checks each group's `logic`.
 * Returns every issue found (not just the first) with a `path` naming the
 * offending node.
 */
export function validateMatchQuery(query: unknown): VocabularyResult {
  const issues: ConditionIssue[] = [];
  collectQueryIssues(query, '', issues);
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
