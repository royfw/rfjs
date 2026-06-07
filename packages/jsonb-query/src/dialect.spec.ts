import { describe, it, expect } from 'vitest';
import {
  renderNullCheck,
  renderJsonbContains,
  isFilterGroup,
  assertCondition,
  assertObjectValue,
} from './dialect';
import { ParamBuilder } from './param-builder';
import type { JsonbCondition } from './types';

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
  const c = (node: unknown) => () => assertCondition(node as JsonbCondition, 'root');
  const e = (node: unknown) => () => assertCondition(node as JsonbCondition, 'elemmatch');

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
    expect(arr('string', 'neq')).toThrow(/unsupported operator "neq" for array elements/i);
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

  it('rejects object and scalar-array conditions inside elemmatch', () => {
    expect(e({ field: 'p', dataType: 'object', operator: 'eq', value: {} })).toThrow(
      /object conditions are not supported inside elemmatch/i,
    );
    expect(
      e({ field: 'a', dataType: 'array', elementType: 'string', operator: 'eq', value: 'x' }),
    ).toThrow(/array conditions with scalar elements are not supported inside elemmatch/i);
    // scalar + nested elemmatch ARE allowed inside elemmatch
    expect(e({ field: 's', dataType: 'string', operator: 'eq', value: 'x' })).not.toThrow();
    expect(
      e({
        field: 'sub', dataType: 'array', elementType: 'object', operator: 'elemmatch',
        filters: { logic: 'and', filters: [{ field: 's', dataType: 'string', operator: 'eq', value: 'x' }] },
      }),
    ).not.toThrow();
  });
});
