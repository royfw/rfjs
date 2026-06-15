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

  it('renders text contains/startswith as parameterized ILIKE', () => {
    expect(render('text', 'contains', 'ab')).toEqual({ sql: "\"name\" ilike '%' || $1 || '%'", values: ['ab'] });
    expect(render('text', 'startswith', 'ab')).toEqual({ sql: "\"name\" ilike $1 || '%'", values: ['ab'] });
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
});
