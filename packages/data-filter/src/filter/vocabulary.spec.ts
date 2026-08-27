import { describe, it, expect } from 'vitest';
import {
  LOGICAL_OPERATORS,
  MATCH_QUERY_DATA_TYPES,
  MATCH_QUERY_ELEMENT_TYPES,
  supportedOperators,
  validateCondition,
  validateMatchQuery,
} from './vocabulary';
import { createMatchQuery } from './matchQuery';
import type { MatchQueryMetadata, ObjectData } from '../types';

/** A row rich enough that every dataType resolves to a plausible value. */
const ROW: ObjectData = {
  s: 'abc',
  n: 3,
  b: true,
  d: '2026-01-01',
  o: { k: 1 },
  arr: ['a'],
  items: [{ sku: 'A' }],
};

const FIELD_BY_TYPE: Record<string, string> = {
  string: 's',
  numeric: 'n',
  boolean: 'b',
  date: 'd',
  object: 'o',
  array: 'arr',
};

/**
 * A minimally plausible condition for a (dataType, elementType, operator)
 * triple. Values are chosen so only *vocabulary* errors can be thrown — arity
 * errors (`range` wants two values) are avoided.
 */
function conditionFor(
  dataType: string,
  operator: string,
  elementType?: string,
): MatchQueryMetadata {
  const base: Record<string, unknown> = {
    field: elementType === 'object' ? 'items' : FIELD_BY_TYPE[dataType],
    dataType,
    operator,
  };
  if (elementType !== undefined) base.elementType = elementType;
  if (operator === 'elemmatch') {
    base.filters = {
      logic: 'and',
      filters: [{ field: 'sku', dataType: 'string', operator: 'eq', value: 'A' }],
    };
    return base as unknown as MatchQueryMetadata;
  }
  const scalar = elementType ?? dataType;
  const one =
    scalar === 'numeric' ? 1 : scalar === 'boolean' ? true : scalar === 'date' ? '2026-01-01' : 'a';
  base.value =
    operator === 'range'
      ? [one, one]
      : operator === 'terms' || operator === 'containsall'
        ? [one]
        : dataType === 'object'
          ? { k: 1 }
          : one;
  return base as unknown as MatchQueryMetadata;
}

/** Run the engine and report only whether it rejected the *vocabulary*. */
function vocabularyErrorFrom(condition: MatchQueryMetadata): string | null {
  try {
    createMatchQuery(ROW, condition);
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return /unsupported (dataType|operator|elementType)/.test(message) ? message : null;
  }
}

/** Every (dataType, elementType) pair the exported vocabulary claims is evaluable. */
const TYPE_PAIRS: { dataType: string; elementType?: string }[] =
  MATCH_QUERY_DATA_TYPES.flatMap((dataType) =>
    dataType === 'array'
      ? MATCH_QUERY_ELEMENT_TYPES.map((elementType) => ({ dataType, elementType }))
      : [{ dataType }],
  );

describe('vocabulary ↔ evaluator divergence guard', () => {
  it('claims a non-empty operator set for every type pair it lists', () => {
    for (const { dataType, elementType } of TYPE_PAIRS) {
      const ops = supportedOperators(dataType, elementType);
      expect(ops, `${dataType}<${String(elementType)}>`).toBeDefined();
      expect(ops!.length, `${dataType}<${String(elementType)}>`).toBeGreaterThan(0);
    }
  });

  it('the evaluator accepts every dataType/operator the vocabulary advertises', () => {
    for (const { dataType, elementType } of TYPE_PAIRS) {
      for (const operator of supportedOperators(dataType, elementType)!) {
        const label = `${dataType}<${String(elementType)}>.${operator}`;
        expect(
          vocabularyErrorFrom(conditionFor(dataType, operator, elementType)),
          label,
        ).toBeNull();
      }
    }
  });

  it('the evaluator rejects every operator the vocabulary withholds', () => {
    // Sampled from the union of all operators the package knows, so an operator
    // dropped from one table but still dispatched by a matcher shows up here.
    const allOperators = new Set(
      TYPE_PAIRS.flatMap(({ dataType, elementType }) => [
        ...supportedOperators(dataType, elementType)!,
      ]),
    );
    const accepted: string[] = [];
    for (const { dataType, elementType } of TYPE_PAIRS) {
      // `array<object>` is exempt: `createMatchQuery` routes on `elementType`
      // and hands the leaf to `ElemMatch`, which never reads `operator` — so
      // the engine cannot reject one. `validateCondition` is stricter than the
      // engine here on purpose (see its own spec below).
      if (elementType === 'object') continue;
      const allowed = new Set(supportedOperators(dataType, elementType));
      for (const operator of allOperators) {
        if (allowed.has(operator)) continue;
        const error = vocabularyErrorFrom(conditionFor(dataType, operator, elementType));
        if (error === null) accepted.push(`${dataType}<${String(elementType)}>.${operator}`);
      }
    }
    expect(accepted).toEqual([]);
  });

  it('validateCondition agrees with the evaluator on every advertised pair', () => {
    for (const { dataType, elementType } of TYPE_PAIRS) {
      for (const operator of supportedOperators(dataType, elementType)!) {
        const condition = conditionFor(dataType, operator, elementType);
        const label = `${dataType}<${String(elementType)}>.${operator}`;
        expect(validateCondition(condition).ok, label).toBe(true);
        expect(vocabularyErrorFrom(condition), label).toBeNull();
      }
    }
  });

  it('validateCondition agrees with the evaluator on every withheld operator', () => {
    const disagreed: string[] = [];
    for (const { dataType, elementType } of TYPE_PAIRS) {
      if (elementType === 'object') continue; // see the exemption above
      const allowed = new Set(supportedOperators(dataType, elementType));
      for (const operator of ['wat', 'constructor', 'toString', 'containsall', 'range']) {
        if (allowed.has(operator)) continue;
        const condition = conditionFor(dataType, operator, elementType);
        const engineRejected = vocabularyErrorFrom(condition) !== null;
        if (validateCondition(condition).ok !== !engineRejected) {
          disagreed.push(`${dataType}<${String(elementType)}>.${operator}`);
        }
        if (!engineRejected) disagreed.push(`${dataType}<${String(elementType)}>.${operator} (engine accepted)`);
      }
    }
    expect(disagreed).toEqual([]);
  });

  it('lists the logic operators logicMatchQuery implements', () => {
    expect([...LOGICAL_OPERATORS].sort()).toEqual(['and', 'nor', 'not', 'or']);
  });
});

describe('validateCondition', () => {
  // The leaf that motivated this API: shape-valid, vocabulary-invalid. It used
  // to pass authoring-time validation and throw at evaluation time instead.
  const wat = { field: 'x', dataType: 'wat', operator: 'eq', value: 1 };

  it("rejects the dataType 'wat' leaf with the evaluator's own message", () => {
    const result = validateCondition(wat);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unsupportedDataType',
        message: "[data-filter] unsupported dataType 'wat'",
        path: '',
      },
    ]);
  });

  it('the leaf it rejects is exactly the leaf the evaluator throws on', () => {
    expect(() =>
      createMatchQuery(ROW, wat as unknown as MatchQueryMetadata),
    ).toThrow("[data-filter] unsupported dataType 'wat'");
  });

  it('accepts a well-formed leaf', () => {
    expect(
      validateCondition({ field: 's', dataType: 'string', operator: 'icontains', value: 'b' }),
    ).toEqual({ ok: true });
  });

  it('rejects an operator that belongs to another dataType', () => {
    const result = validateCondition({ field: 'b', dataType: 'boolean', operator: 'gt', value: 1 });
    expect(result.ok === false && result.issues[0]!.code).toBe('unsupportedOperator');
  });

  it('rejects an array leaf with no elementType', () => {
    const result = validateCondition({ field: 'arr', dataType: 'array', operator: 'eq', value: 'a' });
    expect(result.ok === false && result.issues[0]!.code).toBe('missingElementType');
  });

  it('rejects an unknown elementType the way the evaluator now does', () => {
    const bad = { field: 'arr', dataType: 'array', elementType: 'wat', operator: 'eq', value: 'a' };
    expect(validateCondition(bad).ok).toBe(false);
    expect(() => createMatchQuery(ROW, bad as unknown as MatchQueryMetadata)).toThrow(
      "[data-filter] unsupported elementType 'wat' for dataType 'array'",
    );
  });

  it('descends into an elemmatch sub-group', () => {
    const result = validateCondition({
      field: 'items',
      dataType: 'array',
      elementType: 'object',
      operator: 'elemmatch',
      filters: {
        logic: 'and',
        filters: [{ field: 'sku', dataType: 'wat', operator: 'eq', value: 'A' }],
      },
    });
    expect(result.ok === false && result.issues).toEqual([
      {
        code: 'unsupportedDataType',
        message: "[data-filter] unsupported dataType 'wat'",
        path: 'filters.filters[0]',
      },
    ]);
  });

  it("rejects an array<object> leaf whose operator is not 'elemmatch'", () => {
    // The evaluator routes on elementType and never looks at the operator here,
    // so a typo'd operator silently evaluates as elemmatch. Caught at authoring.
    const result = validateCondition({
      field: 'items',
      dataType: 'array',
      elementType: 'object',
      operator: 'eq',
      filters: { logic: 'and', filters: [] },
    });
    expect(result.ok === false && result.issues[0]!.code).toBe('unsupportedOperator');
  });

  it('rejects a non-object', () => {
    expect(validateCondition(null).ok).toBe(false);
    expect(validateCondition('nope').ok).toBe(false);
  });
});

describe('validateMatchQuery', () => {
  it('accepts a well-formed tree', () => {
    expect(
      validateMatchQuery({
        logic: 'and',
        filters: [
          { field: 's', dataType: 'string', operator: 'eq', value: 'abc' },
          {
            logic: 'or',
            filters: [{ field: 'n', dataType: 'numeric', operator: 'gt', value: 1 }],
          },
        ],
      }),
    ).toEqual({ ok: true });
  });

  it('reports every offending leaf with its path', () => {
    const result = validateMatchQuery({
      logic: 'and',
      filters: [
        { field: 'x', dataType: 'wat', operator: 'eq', value: 1 },
        {
          logic: 'or',
          filters: [{ field: 'b', dataType: 'boolean', operator: 'gt', value: 1 }],
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues.map((i) => [i.code, i.path])).toEqual([
      ['unsupportedDataType', 'filters[0]'],
      ['unsupportedOperator', 'filters[1].filters[0]'],
    ]);
  });

  it('rejects an unknown logic, which the evaluator silently treats as no-match', () => {
    const query = { logic: 'xor', filters: [] };
    const result = validateMatchQuery(query);
    expect(result.ok === false && result.issues[0]!.code).toBe('unsupportedLogic');
  });

  it('rejects a missing filters array', () => {
    const result = validateMatchQuery({ logic: 'and' });
    expect(result.ok === false && result.issues[0]!.code).toBe('invalidFilters');
  });
});

// Both fixed after review: the validator blessed a leaf the evaluator throws
// on — the exact divergence this API exists to eliminate, in the API itself.
describe('validateCondition — non-string tokens and unresolvable fields', () => {
  // `typeof {}` is 'object', which is a *legitimate* dataType and elementType.
  // Rendering the token to test membership let an object through.
  it('rejects a non-string dataType instead of reading it as `object`', () => {
    const leaf = { field: 'x', dataType: {}, operator: 'eq', value: 1 };
    const result = validateCondition(leaf);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues[0]!.code).toBe('unsupportedDataType');
    expect(() => createMatchQuery(ROW, leaf as unknown as MatchQueryMetadata)).toThrow(
      /unsupported dataType/,
    );
  });

  it('rejects a non-string elementType instead of reading it as `object`', () => {
    const leaf = {
      field: 'x',
      dataType: 'array',
      elementType: [],
      operator: 'elemmatch',
      filters: { logic: 'and', filters: [] },
    };
    const result = validateCondition(leaf);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues[0]!.code).toBe('unsupportedElementType');
    expect(() => createMatchQuery(ROW, leaf as unknown as MatchQueryMetadata)).toThrow(
      /unsupported elementType/,
    );
  });

  it('rejects a non-string operator', () => {
    const result = validateCondition({ field: 'x', dataType: 'string', operator: {}, value: 'a' });
    expect(result.ok === false && result.issues[0]!.code).toBe('unsupportedOperator');
  });

  it("rejects a wildcard field with the evaluator's own message", () => {
    const leaf = { field: 'users[*].name', dataType: 'string', operator: 'eq', value: 'x' };
    const result = validateCondition(leaf);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues[0]!.code).toBe('unsupportedPath');
    expect(result.ok === false && result.issues[0]!.message).toMatch(
      /unsupported path syntax 'users\[\*\]\.name'/,
    );
  });

  it('rejects a `$`-rooted field', () => {
    const result = validateCondition({ field: '$.a', dataType: 'string', operator: 'eq', value: 'x' });
    expect(result.ok === false && result.issues[0]!.code).toBe('unsupportedPath');
  });

  it('reports the narrower wildcard wording that object and array throw', () => {
    const obj = validateCondition({ field: 'a.*', dataType: 'object', operator: 'eq', value: 1 });
    expect(obj.ok === false && obj.issues[0]!.message).toMatch(
      /wildcard field is not supported for dataType 'object'/,
    );
    const arr = validateCondition({
      field: 'a.*',
      dataType: 'array',
      elementType: 'string',
      operator: 'eq',
      value: 'x',
    });
    expect(arr.ok === false && arr.issues[0]!.message).toMatch(
      /wildcard field is not supported for dataType 'array'/,
    );
  });

  it('leaves an `=` expression field alone — the async api resolves it', () => {
    expect(
      validateCondition({ field: '=$.a + 1', dataType: 'numeric', operator: 'eq', value: 1 }),
    ).toEqual({ ok: true });
  });

  it('rejects a non-string field', () => {
    const result = validateCondition({ field: 42, dataType: 'string', operator: 'eq', value: 'x' });
    expect(result.ok === false && result.issues[0]!.code).toBe('unsupportedPath');
  });
});
