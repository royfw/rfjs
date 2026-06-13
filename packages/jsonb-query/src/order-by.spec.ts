import { describe, it, expect } from 'vitest';
import { buildJsonbOrderBy, buildNamedJsonbOrderBy } from './order-by';
import { JsonbQueryError } from './errors';

describe('buildJsonbOrderBy', () => {
  it('single column defaults to asc, casts by dataType', () => {
    expect(buildJsonbOrderBy('data', [{ field: 'age', dataType: 'numeric' }])).toEqual({
      orderBy: '("data" #>> $1)::numeric asc',
      values: [['age']],
    });
    expect(buildJsonbOrderBy('data', [{ field: 'name', dataType: 'string' }]).orderBy).toBe(
      '("data" #>> $1) asc',
    );
  });

  it('honours direction and nulls ordering', () => {
    expect(
      buildJsonbOrderBy('data', [{ field: 'age', dataType: 'numeric', direction: 'desc', nulls: 'last' }]).orderBy,
    ).toBe('("data" #>> $1)::numeric desc nulls last');
    expect(
      buildJsonbOrderBy('data', [{ field: 'd', dataType: 'date', direction: 'asc', nulls: 'first' }]).orderBy,
    ).toBe('("data" #>> $1)::timestamptz asc nulls first');
  });

  it('joins multiple columns with contiguous params and honours paramOffset', () => {
    expect(
      buildJsonbOrderBy('data', [
        { field: 'age', dataType: 'numeric', direction: 'desc' },
        { field: 'name', dataType: 'string' },
      ]),
    ).toEqual({
      orderBy: '("data" #>> $1)::numeric desc, ("data" #>> $2) asc',
      values: [['age'], ['name']],
    });
    expect(
      buildJsonbOrderBy('data', [{ field: 'age', dataType: 'numeric' }], { paramOffset: 2 }).orderBy,
    ).toBe('("data" #>> $3)::numeric asc');
  });

  it('supports dot paths (multi-element text[] param)', () => {
    expect(buildJsonbOrderBy('data', [{ field: 'a.b', dataType: 'string' }])).toEqual({
      orderBy: '("data" #>> $1) asc',
      values: [['a', 'b']],
    });
  });

  it('returns an empty fragment for no sorts', () => {
    expect(buildJsonbOrderBy('data', [])).toEqual({ orderBy: '', values: [] });
  });

  it('rejects invalid column / dataType / direction / nulls', () => {
    expect(() => buildJsonbOrderBy('bad-col', [{ field: 'a', dataType: 'string' }])).toThrow(
      /invalid jsonb column/i,
    );
    const code = (fn: () => unknown): string => {
      try {
        fn();
      } catch (e) {
        if (e instanceof JsonbQueryError) return e.code;
        throw e;
      }
      throw new Error('expected a JsonbQueryError');
    };
    expect(code(() => buildJsonbOrderBy('data', [{ field: 'a', dataType: 'bogus' as never }]))).toBe('INVALID_SORT');
    expect(code(() => buildJsonbOrderBy('data', [{ field: 'a', dataType: 'string', direction: 'up' as never }]))).toBe('INVALID_SORT');
    expect(code(() => buildJsonbOrderBy('data', [{ field: 'a', dataType: 'string', nulls: 'middle' as never }]))).toBe('INVALID_SORT');
  });
});

describe('buildNamedJsonbOrderBy', () => {
  it('emits :pN placeholders and a params object', () => {
    expect(
      buildNamedJsonbOrderBy('data', [{ field: 'age', dataType: 'numeric', direction: 'desc' }]),
    ).toEqual({
      orderBy: '("data" #>> :p1)::numeric desc',
      params: { p1: ['age'] },
    });
  });

  it('honours a custom prefix and paramOffset (shifts names)', () => {
    expect(
      buildNamedJsonbOrderBy('data', [{ field: 'age', dataType: 'numeric' }], { prefix: 'o' }),
    ).toEqual({
      orderBy: '("data" #>> :o1)::numeric asc',
      params: { o1: ['age'] },
    });
    expect(
      buildNamedJsonbOrderBy('data', [{ field: 'age', dataType: 'numeric' }], { paramOffset: 4 }).orderBy,
    ).toBe('("data" #>> :p5)::numeric asc');
  });

  it('returns an empty fragment + empty params for no sorts', () => {
    expect(buildNamedJsonbOrderBy('data', [])).toEqual({ orderBy: '', params: {} });
  });
});
