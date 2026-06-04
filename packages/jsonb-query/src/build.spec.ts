import { describe, it, expect } from 'vitest';
import { buildJsonbQuery } from './build';
import type { JsonbFilterGroup } from './types';

describe('buildJsonbQuery', () => {
  it('builds a single-condition where with contiguous params (legacy default)', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'age', dataType: 'numeric', operator: 'gt', value: 18 }],
    };
    expect(buildJsonbQuery('data', filter)).toEqual({
      where: '(("data" #>> $1)::numeric > $2)',
      values: [['age'], 18],
      from: [],
    });
  });

  it('joins conditions with the group logic and numbers params globally', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
        { field: 'age', dataType: 'numeric', operator: 'gte', value: 18 },
      ],
    };
    expect(buildJsonbQuery('data', filter)).toEqual({
      where: '(("data" #>> $1) = $2) and (("data" #>> $3)::numeric >= $4)',
      values: [['name'], 'bob', ['age'], 18],
      from: [],
    });
  });

  it('wraps nested groups in parentheses', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [
        { field: 'name', dataType: 'string', operator: 'eq', value: 'bob' },
        {
          logic: 'or',
          filters: [
            { field: 'age', dataType: 'numeric', operator: 'gte', value: 18 },
            { field: 'vip', dataType: 'boolean', operator: 'eq', value: true },
          ],
        },
      ],
    };
    const r = buildJsonbQuery('data', filter);
    expect(r.where).toBe(
      '(("data" #>> $1) = $2) and ((("data" #>> $3)::numeric >= $4) or (("data" #>> $5)::boolean = $6))',
    );
    expect(r.values).toEqual([['name'], 'bob', ['age'], 18, ['vip'], true]);
  });

  it('honours paramOffset', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'age', dataType: 'numeric', operator: 'gt', value: 18 }],
    };
    expect(buildJsonbQuery('data', filter, { paramOffset: 5 }).where).toBe(
      '(("data" #>> $6)::numeric > $7)',
    );
  });

  it('switches to the jsonpath dialect', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'name', dataType: 'string', operator: 'eq', value: 'bob' }],
    };
    expect(buildJsonbQuery('data', filter, { dialect: 'jsonpath' })).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."name" ? (@ == $v)', { v: 'bob' }],
      from: [],
    });
  });

  it('returns empty where for an empty group', () => {
    expect(buildJsonbQuery('data', { logic: 'and', filters: [] })).toEqual({
      where: '',
      values: [],
      from: [],
    });
  });

  it('does not mutate across calls (fresh state each time)', () => {
    const filter: JsonbFilterGroup = {
      logic: 'and',
      filters: [{ field: 'age', dataType: 'numeric', operator: 'gt', value: 1 }],
    };
    const a = buildJsonbQuery('data', filter);
    const b = buildJsonbQuery('data', filter);
    expect(a).toEqual(b);
  });

  it('rejects an invalid column', () => {
    expect(() =>
      buildJsonbQuery('data; DROP', { logic: 'and', filters: [] }),
    ).toThrow(/invalid jsonb column/i);
  });

  it('throws for an unknown dialect', () => {
    expect(() =>
      buildJsonbQuery('data', { logic: 'and', filters: [] }, {
        dialect: 'nope' as never,
      }),
    ).toThrow(/unknown jsonb dialect/i);
  });

  it('rejects an operator that is invalid for the data type', () => {
    const bad = (dataType: never, operator: never) =>
      () => buildJsonbQuery('data', {
        logic: 'and',
        filters: [{ field: 'x', dataType, operator, value: 1 as never }],
      });
    expect(bad('boolean' as never, 'gt' as never)).toThrow(/unsupported operator "gt" for type "boolean"/i);
    expect(bad('string' as never, 'range' as never)).toThrow(/unsupported operator "range" for type "string"/i);
    expect(bad('numeric' as never, 'startswith' as never)).toThrow(/unsupported operator "startswith" for type "numeric"/i);
  });

  it('composes three levels of nesting with contiguous params', () => {
    const r = buildJsonbQuery('data', {
      logic: 'and',
      filters: [
        { field: 'a', dataType: 'string', operator: 'eq', value: 'x' },
        {
          logic: 'or',
          filters: [
            { field: 'b', dataType: 'numeric', operator: 'gt', value: 1 },
            {
              logic: 'and',
              filters: [
                { field: 'c', dataType: 'string', operator: 'eq', value: 'y' },
                { field: 'd', dataType: 'boolean', operator: 'eq', value: true },
              ],
            },
          ],
        },
      ],
    });
    // params run $1..$8 in order; each nested group is wrapped exactly once
    expect(r.where).toBe(
      '(("data" #>> $1) = $2) and ((("data" #>> $3)::numeric > $4) or ((("data" #>> $5) = $6) and (("data" #>> $7)::boolean = $8)))',
    );
    expect(r.values).toEqual([['a'], 'x', ['b'], 1, ['c'], 'y', ['d'], true]);
  });
});
