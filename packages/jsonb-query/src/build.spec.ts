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
});
