import { describe, it, expect } from 'vitest';
import { JsonbQueryError } from './errors';

describe('JsonbQueryError', () => {
  it('is an Error with a name and a code', () => {
    const err = new JsonbQueryError('bad input', 'INVALID_COLUMN');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(JsonbQueryError);
    expect(err.name).toBe('JsonbQueryError');
    expect(err.message).toBe('bad input');
    expect(err.code).toBe('INVALID_COLUMN');
  });
});

import { buildJsonbQuery } from './build';
import { quoteJsonbColumn } from './column';
import { buildNamedJsonbQuery, toNamedParams } from './named-params';
import type { JsonbFilterGroup } from './types';

const wrap = (f: unknown): JsonbFilterGroup => ({ logic: 'and', filters: [f as never] });

function caught(fn: () => unknown): JsonbQueryError {
  try {
    fn();
  } catch (e) {
    if (e instanceof JsonbQueryError) return e;
    throw e;
  }
  throw new Error('expected a JsonbQueryError to be thrown');
}

describe('JsonbQueryError codes by throw site', () => {
  it('INVALID_COLUMN', () => {
    expect(caught(() => quoteJsonbColumn('a-b')).code).toBe('INVALID_COLUMN');
  });

  it('INVALID_DIALECT', () => {
    expect(
      caught(() => buildJsonbQuery('data', wrap({ field: 'x', dataType: 'string', operator: 'isnull' }), { dialect: 'nope' as never })).code,
    ).toBe('INVALID_DIALECT');
  });

  it('UNSUPPORTED_OPERATOR', () => {
    expect(caught(() => buildJsonbQuery('data', wrap({ field: 'x', dataType: 'boolean', operator: 'gt', value: 1 }))).code).toBe('UNSUPPORTED_OPERATOR');
  });

  it('INVALID_ELEMENT_TYPE', () => {
    expect(caught(() => buildJsonbQuery('data', wrap({ field: 'a', dataType: 'array', elementType: 'bogus', operator: 'eq', value: 1 }))).code).toBe('INVALID_ELEMENT_TYPE');
  });

  it('INVALID_SCALAR_VALUE', () => {
    expect(caught(() => buildJsonbQuery('data', wrap({ field: 'x', dataType: 'string', operator: 'eq' }))).code).toBe('INVALID_SCALAR_VALUE');
  });

  it('INVALID_ARRAY_VALUE', () => {
    expect(caught(() => buildJsonbQuery('data', wrap({ field: 'x', dataType: 'numeric', operator: 'range', value: [1] }))).code).toBe('INVALID_ARRAY_VALUE');
  });

  it('INVALID_OBJECT_VALUE', () => {
    expect(caught(() => buildJsonbQuery('data', wrap({ field: 'p', dataType: 'object', operator: 'eq', value: 'x' }))).code).toBe('INVALID_OBJECT_VALUE');
  });

  it('EMPTY_FILTER_GROUP', () => {
    expect(caught(() => buildJsonbQuery('data', wrap({ field: 'i', dataType: 'array', elementType: 'object', operator: 'elemmatch', filters: { logic: 'and', filters: [] } }))).code).toBe('EMPTY_FILTER_GROUP');
  });

  it('INVALID_PREFIX', () => {
    expect(caught(() => buildNamedJsonbQuery('data', wrap({ field: 'x', dataType: 'string', operator: 'isnull' }), { prefix: '1bad' })).code).toBe('INVALID_PREFIX');
  });

  it('PARAM_MISMATCH', () => {
    expect(caught(() => toNamedParams({ where: '$1 and $3', values: ['a', 'b'], from: [] })).code).toBe('PARAM_MISMATCH');
  });
});
