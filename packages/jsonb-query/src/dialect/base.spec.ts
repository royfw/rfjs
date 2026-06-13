import { describe, it, expect } from 'vitest';
import {
  renderNullCheck,
  renderJsonbContains,
  isFilterGroup,
  assertCondition,
  assertObjectValue,
  groupNeedsSqlFallback,
} from './base';
import { ParamBuilder } from '../param-builder';
import type { JsonbCondition, JsonbFilterGroup } from '../types';

describe('renderNullCheck', () => {
  it('renders is null / is not null with a parameterized path', () => {
    const p1 = new ParamBuilder();
    expect(renderNullCheck('"data"', 'a.b', 'isnull', p1)).toBe('(("data" #>> $1) is null)');
    expect(p1.values).toEqual([['a', 'b']]);

    const p2 = new ParamBuilder();
    expect(renderNullCheck('"data"', 'x', 'isnotnull', p2)).toBe('(("data" #>> $1) is not null)');
    expect(p2.values).toEqual([['x']]);
  });
});

describe('renderJsonbContains', () => {
  it('JSON-stringifies the value (node-postgres array-literal gotcha)', () => {
    const p = new ParamBuilder();
    expect(renderJsonbContains('"data"', 'tags', ['a', 'b'], p)).toBe(
      '(("data" #> $1) @> $2::jsonb)',
    );
    expect(p.values).toEqual([['tags'], '["a","b"]']);
  });
});

describe('isFilterGroup', () => {
  it('discriminates groups from conditions', () => {
    expect(isFilterGroup({ logic: 'and', filters: [] })).toBe(true);
    expect(
      isFilterGroup({ field: 'a', dataType: 'string', operator: 'eq', value: 'x' }),
    ).toBe(false);
  });
});

describe('assertObjectValue', () => {
  it('accepts a plain object', () => {
    expect(assertObjectValue('eq', { a: 1 })).toEqual({ a: 1 });
  });
  it.each([null, undefined, [1], new Date(), 'x', 1])('rejects %p', (bad) => {
    expect(() => assertObjectValue('eq', bad)).toThrow(/requires a plain object value/i);
  });
});

describe('assertCondition', () => {
  const c = (node: unknown) => () => assertCondition(node as JsonbCondition);

  it('delegates scalar validation unchanged', () => {
    expect(c({ field: 'x', dataType: 'boolean', operator: 'gt' })).toThrow(
      /unsupported operator "gt" for type "boolean"/i,
    );
    expect(c({ field: 'x', dataType: 'string', operator: 'eq', value: 'a' })).not.toThrow();
  });

  it('validates object operators', () => {
    expect(c({ field: 'p', dataType: 'object', operator: 'eq', value: {} })).not.toThrow();
    expect(c({ field: 'p', dataType: 'object', operator: 'gt', value: {} })).toThrow(
      /unsupported operator "gt" for type "object"/i,
    );
  });

  it('validates array element operators per elementType', () => {
    const arr = (elementType: string, operator: string) =>
      c({ field: 'a', dataType: 'array', elementType, operator, value: 1 });
    expect(arr('numeric', 'gt')).not.toThrow();
    expect(arr('string', 'gt')).toThrow(/for array elements of type "string"/i);
    expect(arr('numeric', 'startswith')).toThrow(/for array elements of type "numeric"/i);
    expect(arr('string', 'neq')).not.toThrow();
    expect(arr('numeric', 'neq')).not.toThrow();
    expect(arr('boolean', 'terms')).toThrow(/for array elements of type "boolean"/i);
    expect(arr('date', 'containsall')).toThrow(/for array elements of type "date"/i);
    expect(arr('bogus', 'eq')).toThrow(/unsupported elementtype "bogus"/i);
  });

  it('requires elemmatch (with a non-empty group) for arrays of objects', () => {
    const ok = {
      field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
      filters: { logic: 'and', filters: [{ field: 's', dataType: 'string', operator: 'eq', value: 'x' }] },
    };
    expect(c(ok)).not.toThrow();
    expect(c({ ...ok, operator: 'eq' })).toThrow(/use "elemmatch"/i);
    expect(c({ ...ok, filters: { logic: 'and', filters: [] } })).toThrow(
      /requires a filter group with at least one condition/i,
    );
    expect(c({ ...ok, filters: undefined })).toThrow(/requires a filter group/i);
  });

  it('validates object and scalar-array conditions uniformly (no elemmatch scope)', () => {
    // Previously rejected inside elemmatch; now scope-independent.
    expect(c({ field: 'p', dataType: 'object', operator: 'eq', value: {} })).not.toThrow();
    expect(c({ field: 'a', dataType: 'array', elementType: 'string', operator: 'eq', value: 'x' })).not.toThrow();
    // Operator-set checks still apply.
    expect(c({ field: 'p', dataType: 'object', operator: 'gt', value: {} })).toThrow(
      /unsupported operator "gt" for type "object"/i,
    );
  });
});

describe('groupNeedsSqlFallback', () => {
  const g = (filters: JsonbFilterGroup['filters']): JsonbFilterGroup => ({ logic: 'and', filters });

  it('false for scalar-only and path-expressible scalar-array groups', () => {
    expect(groupNeedsSqlFallback(g([{ field: 's', dataType: 'string', operator: 'eq', value: 'x' }]))).toBe(false);
    expect(groupNeedsSqlFallback(g([{ field: 't', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' }]))).toBe(false);
    expect(groupNeedsSqlFallback(g([{ field: 't', dataType: 'array', elementType: 'string', operator: 'isnull' }]))).toBe(false);
  });

  it('true for object conditions and scalar-array containsall', () => {
    expect(groupNeedsSqlFallback(g([{ field: 'p', dataType: 'object', operator: 'contains', value: {} }]))).toBe(true);
    expect(groupNeedsSqlFallback(g([{ field: 't', dataType: 'array', elementType: 'string', operator: 'containsall', value: ['a'] }]))).toBe(true);
  });

  it('recurses through nested groups and nested elemmatch', () => {
    expect(groupNeedsSqlFallback(g([{ logic: 'or', filters: [{ field: 'p', dataType: 'object', operator: 'eq', value: {} }] } as never]))).toBe(true);
    const nestedElem = g([
      {
        field: 'sub', dataType: 'array', elementType: 'object', operator: 'elemmatch',
        filters: { logic: 'and', filters: [{ field: 'p', dataType: 'object', operator: 'eq', value: {} }] },
      } as never,
    ]);
    expect(groupNeedsSqlFallback(nestedElem)).toBe(true);
    const nestedElemScalar = g([
      {
        field: 'sub', dataType: 'array', elementType: 'object', operator: 'elemmatch',
        filters: { logic: 'and', filters: [{ field: 's', dataType: 'string', operator: 'eq', value: 'x' }] },
      } as never,
    ]);
    expect(groupNeedsSqlFallback(nestedElemScalar)).toBe(false);
  });
});
