import { describe, it, expect } from 'vitest';
import { jsonpathDialect } from './dialect-jsonpath';
import { ParamBuilder } from './param-builder';

function run(
  field: string,
  dataType: Parameters<typeof jsonpathDialect.render>[2],
  operator: Parameters<typeof jsonpathDialect.render>[3],
  value?: unknown,
) {
  const p = new ParamBuilder();
  const where = jsonpathDialect.render('"data"', field, dataType, operator, value as never, p);
  return { where, values: p.values };
}

describe('jsonpathDialect', () => {
  it('eq string uses jsonb_path_exists with a vars object', () => {
    expect(run('name', 'string', 'eq', 'bob')).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."name" ? (@ == $v)', { v: 'bob' }],
    });
  });

  it('nested field escapes each member', () => {
    expect(run('address.city', 'string', 'eq', 'TP').values[0]).toBe(
      '$."address"."city" ? (@ == $v)',
    );
  });

  it('neq', () => {
    expect(run('name', 'string', 'neq', 'bob').values[0]).toBe('$."name" ? (@ != $v)');
  });

  it('date eq uses .datetime() on both sides', () => {
    expect(run('d', 'date', 'eq', '2020-01-01').values[0]).toBe(
      '$."d" ? (@.datetime() == $v.datetime())',
    );
  });

  it('comparisons', () => {
    expect(run('age', 'numeric', 'gt', 1).values[0]).toBe('$."age" ? (@ > $v)');
    expect(run('age', 'numeric', 'lte', 1).values[0]).toBe('$."age" ? (@ <= $v)');
    expect(run('age', 'numeric', 'gte', 1).values[0]).toBe('$."age" ? (@ >= $v)');
    expect(run('age', 'numeric', 'lt', 1).values[0]).toBe('$."age" ? (@ < $v)');
  });

  it('range', () => {
    expect(run('age', 'numeric', 'range', [1, 9])).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."age" ? (@ >= $lo && @ <= $hi)', { lo: 1, hi: 9 }],
    });
  });

  it('terms OR-expands with indexed vars', () => {
    expect(run('tag', 'string', 'terms', ['a', 'b'])).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."tag" ? (@ == $v0 || @ == $v1)', { v0: 'a', v1: 'b' }],
    });
  });

  it('startswith uses the native predicate with a var', () => {
    expect(run('s', 'string', 'startswith', 'x')).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath, $2::jsonb)',
      values: ['$."s" ? (@ starts with $v)', { v: 'x' }],
    });
  });

  it('contains embeds a regex-escaped literal (no vars)', () => {
    expect(run('s', 'string', 'contains', 'a.b')).toEqual({
      where: 'jsonb_path_exists("data", $1::jsonpath)',
      values: ['$."s" ? (@ like_regex "a\\\\.b")'],
    });
  });

  it('endswith anchors the regex literal', () => {
    expect(run('s', 'string', 'endswith', 'x').values[0]).toBe(
      '$."s" ? (@ like_regex "x$")',
    );
  });

  it('isnull / isnotnull fall back to the dialect-independent null check', () => {
    expect(run('name', 'string', 'isnull')).toEqual({
      where: '(("data" #>> $1) is null)',
      values: [['name']],
    });
    expect(run('name', 'string', 'isnotnull')).toEqual({
      where: '(("data" #>> $1) is not null)',
      values: [['name']],
    });
  });

  it('throws on an unknown operator', () => {
    expect(() => run('name', 'string', 'bogus' as never, 'x')).toThrow(/unsupported operator/i);
  });
});
