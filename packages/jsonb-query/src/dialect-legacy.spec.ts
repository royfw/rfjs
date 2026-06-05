import { describe, it, expect } from 'vitest';
import { legacyDialect } from './dialect-legacy';
import { ParamBuilder } from './param-builder';

function run(
  field: string,
  dataType: Parameters<typeof legacyDialect.render>[2],
  operator: Parameters<typeof legacyDialect.render>[3],
  value?: unknown,
) {
  const p = new ParamBuilder();
  const where = legacyDialect.render('"data"', field, dataType, operator, value as never, p);
  return { where, values: p.values };
}

describe('legacyDialect', () => {
  it('eq string', () => {
    expect(run('name', 'string', 'eq', 'bob')).toEqual({
      where: '(("data" #>> $1) = $2)',
      values: [['name'], 'bob'],
    });
  });

  it('eq numeric casts', () => {
    expect(run('age', 'numeric', 'eq', 18)).toEqual({
      where: '(("data" #>> $1)::numeric = $2)',
      values: [['age'], 18],
    });
  });

  it('neq uses <> (not =)', () => {
    expect(run('age', 'numeric', 'neq', 18)).toEqual({
      where: '(("data" #>> $1)::numeric <> $2)',
      values: [['age'], 18],
    });
  });

  it('date eq casts to timestamptz and parameterizes the value', () => {
    expect(run('d', 'date', 'eq', '2020-01-01')).toEqual({
      where: '(("data" #>> $1)::timestamptz = $2)',
      values: [['d'], '2020-01-01'],
    });
  });

  it('boolean eq emits valid SQL (no "= is")', () => {
    expect(run('active', 'boolean', 'eq', true)).toEqual({
      where: '(("data" #>> $1)::boolean = $2)',
      values: [['active'], true],
    });
  });

  it('isnull / isnotnull', () => {
    expect(run('name', 'string', 'isnull')).toEqual({
      where: '(("data" #>> $1) is null)',
      values: [['name']],
    });
    expect(run('name', 'string', 'isnotnull')).toEqual({
      where: '(("data" #>> $1) is not null)',
      values: [['name']],
    });
  });

  it('gt / gte / lt / lte', () => {
    expect(run('age', 'numeric', 'gt', 1).where).toBe('(("data" #>> $1)::numeric > $2)');
    expect(run('age', 'numeric', 'gte', 1).where).toBe('(("data" #>> $1)::numeric >= $2)');
    expect(run('age', 'numeric', 'lt', 1).where).toBe('(("data" #>> $1)::numeric < $2)');
    expect(run('age', 'numeric', 'lte', 1).where).toBe('(("data" #>> $1)::numeric <= $2)');
  });

  it('range', () => {
    expect(run('age', 'numeric', 'range', [1, 9])).toEqual({
      where: '(("data" #>> $1)::numeric between $2 and $3)',
      values: [['age'], 1, 9],
    });
  });

  it('terms uses = ANY with a type-cast array param', () => {
    expect(run('tag', 'string', 'terms', ['a', 'b'])).toEqual({
      where: '(("data" #>> $1) = ANY($2::text[]))',
      values: [['tag'], ['a', 'b']],
    });
    expect(run('age', 'numeric', 'terms', [1, 2])).toEqual({
      where: '(("data" #>> $1)::numeric = ANY($2::numeric[]))',
      values: [['age'], [1, 2]],
    });
    expect(run('d', 'date', 'terms', ['2020-01-01', '2021-01-01'])).toEqual({
      where: '(("data" #>> $1)::timestamptz = ANY($2::timestamptz[]))',
      values: [['d'], ['2020-01-01', '2021-01-01']],
    });
  });

  it('contains / startswith / endswith match literally', () => {
    expect(run('s', 'string', 'contains', 'x')).toEqual({
      where: '(position($2 in ("data" #>> $1)) > 0)',
      values: [['s'], 'x'],
    });
    expect(run('s', 'string', 'startswith', 'x')).toEqual({
      where: '(left(("data" #>> $1), char_length($2)) = $2)',
      values: [['s'], 'x'],
    });
    expect(run('s', 'string', 'endswith', 'x')).toEqual({
      where: '(right(("data" #>> $1), char_length($2)) = $2)',
      values: [['s'], 'x'],
    });
  });

  it('nested field path becomes a multi-element text[] param', () => {
    expect(run('address.city', 'string', 'eq', 'TP').values[0]).toEqual(['address', 'city']);
  });

  it('keeps an injection payload in values, never in the SQL', () => {
    const { where, values } = run('name', 'string', 'eq', "x'; DROP TABLE t; --");
    expect(where).toBe('(("data" #>> $1) = $2)');
    expect(values[1]).toBe("x'; DROP TABLE t; --");
  });

  it('throws on an unknown operator', () => {
    expect(() => run('name', 'string', 'bogus' as never, 'x')).toThrow(/unsupported operator/i);
  });
});
