import { describe, it, expect } from 'vitest';
import { ParamBuilder } from '../param-builder';
import { ColumnQueryError } from '../errors';
import { renderColumnCondition } from './operators';

const render = (
  type: Parameters<typeof renderColumnCondition>[1],
  op: Parameters<typeof renderColumnCondition>[2],
  value?: unknown,
) => {
  const p = new ParamBuilder();
  const sql = renderColumnCondition('"name"', type, op, value, p);
  return { sql, values: p.values };
};

describe('renderColumnCondition', () => {
  it('renders comparison operators with a positional param', () => {
    expect(render('text', 'eq', 'x')).toEqual({ sql: '"name" = $1', values: ['x'] });
    expect(render('numeric', 'gte', 5)).toEqual({ sql: '"name" >= $1', values: [5] });
    expect(render('text', 'neq', 'y')).toEqual({ sql: '"name" <> $1', values: ['y'] });
  });

  it('renders text contains/startswith as case-sensitive escaped LIKE', () => {
    expect(render('text', 'contains', 'ab')).toEqual({ sql: "\"name\" like '%' || $1 || '%' escape '\\'", values: ['ab'] });
    expect(render('text', 'startswith', 'ab')).toEqual({ sql: "\"name\" like $1 || '%' escape '\\'", values: ['ab'] });
  });
  it('escapes LIKE metacharacters in the term', () => {
    expect(render('text', 'contains', '50%_a')).toEqual({ sql: "\"name\" like '%' || $1 || '%' escape '\\'", values: ['50\\%\\_a'] });
  });

  it('renders nullary operators without a param', () => {
    expect(render('uuid', 'isnull')).toEqual({ sql: '"name" is null', values: [] });
    expect(render('uuid', 'isnotnull')).toEqual({ sql: '"name" is not null', values: [] });
  });

  it('rejects an operator not allowed for the column type', () => {
    expect(() => render('numeric', 'contains', 'x')).toThrow(ColumnQueryError);
    expect(() => render('boolean', 'gt', true)).toThrow(ColumnQueryError);
  });

  it('rejects a value on a nullary operator and a missing value on others', () => {
    expect(() => render('text', 'isnull', 'x')).toThrow(ColumnQueryError);
    expect(() => render('text', 'eq', undefined)).toThrow(ColumnQueryError);
  });

  it('renders endswith as case-sensitive escaped LIKE', () => {
    expect(render('text', 'endswith', 'ab')).toEqual({ sql: "\"name\" like '%' || $1 escape '\\'", values: ['ab'] });
  });
  it('renders the case-insensitive iX family', () => {
    expect(render('text', 'ieq', 'AB')).toEqual({ sql: 'lower("name") = lower($1)', values: ['AB'] });
    expect(render('text', 'ineq', 'AB')).toEqual({ sql: 'lower("name") <> lower($1)', values: ['AB'] });
    expect(render('text', 'icontains', 'ab')).toEqual({ sql: "\"name\" ilike '%' || $1 || '%' escape '\\'", values: ['ab'] });
    expect(render('text', 'istartswith', 'ab')).toEqual({ sql: "\"name\" ilike $1 || '%' escape '\\'", values: ['ab'] });
    expect(render('text', 'iendswith', 'ab')).toEqual({ sql: "\"name\" ilike '%' || $1 escape '\\'", values: ['ab'] });
  });
  it('renders terms as = ANY(array)', () => {
    expect(render('uuid', 'terms', ['a', 'b'])).toEqual({ sql: '"name" = any($1)', values: [['a', 'b']] });
    expect(render('numeric', 'terms', [1, 2])).toEqual({ sql: '"name" = any($1)', values: [[1, 2]] });
  });
  it('renders range as BETWEEN two params', () => {
    expect(render('numeric', 'range', [1, 9])).toEqual({ sql: '"name" between $1 and $2', values: [1, 9] });
  });
  it('accepts every scalar shape a single-value operator may legitimately carry', () => {
    const at = new Date('2026-01-01T00:00:00.000Z');
    expect(render('timestamp', 'gte', at)).toEqual({ sql: '"name" >= $1', values: [at] });
    expect(render('boolean', 'eq', false)).toEqual({ sql: '"name" = $1', values: [false] });
    expect(render('numeric', 'eq', 0)).toEqual({ sql: '"name" = $1', values: [0] });
    expect(render('text', 'eq', null)).toEqual({ sql: '"name" = $1', values: [null] });
    expect(render('numeric', 'eq', 10n)).toEqual({ sql: '"name" = $1', values: [10n] });
  });

  // #288: a non-scalar on a single-value operator used to be String()-coerced — e.g.
  // contains + ['a','b'] → LIKE '%a,b%' — valid SQL that silently matches nothing.
  it('rejects a non-scalar value on every single-value operator', () => {
    const SCALAR_OPS: Array<[Parameters<typeof render>[0], Parameters<typeof render>[1]]> = [
      ['text', 'eq'],
      ['text', 'neq'],
      ['text', 'contains'],
      ['text', 'startswith'],
      ['text', 'endswith'],
      ['text', 'icontains'],
      ['text', 'istartswith'],
      ['text', 'iendswith'],
      ['text', 'ieq'],
      ['text', 'ineq'],
      ['numeric', 'gt'],
      ['numeric', 'gte'],
      ['numeric', 'lt'],
      ['numeric', 'lte'],
    ];
    for (const [type, op] of SCALAR_OPS) {
      for (const value of [['a', 'b'], { a: 1 }, [], () => 'x']) {
        expect(() => render(type, op, value), `${op} + ${JSON.stringify(value)}`).toThrow(
          ColumnQueryError,
        );
      }
    }
  });

  it('reports the non-scalar rejection with a NON_SCALAR_VALUE code and an actionable message', () => {
    try {
      render('text', 'contains', ['a', 'b']);
      expect.unreachable('expected a ColumnQueryError');
    } catch (err) {
      expect(err).toBeInstanceOf(ColumnQueryError);
      expect((err as ColumnQueryError).code).toBe('NON_SCALAR_VALUE');
      expect((err as ColumnQueryError).message).toContain('contains');
      expect((err as ColumnQueryError).message).toContain('an array (2 items)');
      expect((err as ColumnQueryError).message).toContain('terms');
    }
    try {
      render('text', 'ieq', { a: 1 });
      expect.unreachable('expected a ColumnQueryError');
    } catch (err) {
      expect((err as ColumnQueryError).code).toBe('NON_SCALAR_VALUE');
      expect((err as ColumnQueryError).message).toContain('an object');
    }
  });

  it('leaves the list-taking operators free to receive arrays', () => {
    expect(render('text', 'terms', ['a', 'b'])).toEqual({ sql: '"name" = any($1)', values: [['a', 'b']] });
    expect(render('numeric', 'range', [1, 9])).toEqual({ sql: '"name" between $1 and $2', values: [1, 9] });
    // and the nullary ones keep rejecting *any* value, scalar or not
    expect(() => render('text', 'isnull', ['a'])).toThrow(ColumnQueryError);
  });

  it('validates terms/range value shape and per-type allow-lists', () => {
    expect(() => render('numeric', 'terms', 5)).toThrow(ColumnQueryError);      // not an array
    expect(() => render('numeric', 'terms', [])).toThrow(ColumnQueryError);     // empty
    expect(() => render('numeric', 'range', [1])).toThrow(ColumnQueryError);    // not 2 elements
    expect(() => render('boolean', 'terms', [true])).toThrow(ColumnQueryError); // not allowed on boolean
    expect(() => render('text', 'range', ['a', 'b'])).toThrow(ColumnQueryError);// text has no range (D2)
  });
});
