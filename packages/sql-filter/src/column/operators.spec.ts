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
  it('validates terms/range value shape and per-type allow-lists', () => {
    expect(() => render('numeric', 'terms', 5)).toThrow(ColumnQueryError);      // not an array
    expect(() => render('numeric', 'terms', [])).toThrow(ColumnQueryError);     // empty
    expect(() => render('numeric', 'range', [1])).toThrow(ColumnQueryError);    // not 2 elements
    expect(() => render('boolean', 'terms', [true])).toThrow(ColumnQueryError); // not allowed on boolean
    expect(() => render('text', 'range', ['a', 'b'])).toThrow(ColumnQueryError);// text has no range (D2)
  });
});
