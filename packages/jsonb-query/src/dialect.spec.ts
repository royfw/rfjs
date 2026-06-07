import { describe, it, expect } from 'vitest';
import { renderNullCheck, renderJsonbContains, isFilterGroup } from './dialect';
import { ParamBuilder } from './param-builder';

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
