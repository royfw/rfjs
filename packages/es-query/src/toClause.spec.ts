import { describe, it, expect } from 'vitest';
import { toClause } from './toClause';
import { UnsupportedClauseError, EsQueryError } from './errors';

const ES = 'elasticsearch' as const;

describe('toClause', () => {
  it('eq on keyword → term', () => {
    expect(toClause({ field: 'status', condition: 'eq', value: 'open' }, ES))
      .toEqual({ term: { status: 'open' } });
  });
  it('eq on text → match', () => {
    expect(toClause({ field: 'body', condition: 'eq', fieldType: 'text', value: 'hi' }, ES))
      .toEqual({ match: { body: 'hi' } });
  });
  it('neq → must_not term', () => {
    expect(toClause({ field: 'status', condition: 'neq', value: 'open' }, ES))
      .toEqual({ bool: { must_not: [{ term: { status: 'open' } }] } });
  });
  it('in → terms', () => {
    expect(toClause({ field: 'tag', condition: 'in', value: ['a', 'b'] }, ES))
      .toEqual({ terms: { tag: ['a', 'b'] } });
  });
  it('between with date coercion → range', () => {
    const r = toClause(
      { field: 'createdAt', condition: 'between', dataType: 'date', value: ['2020-01-01', '2020-12-31'] },
      ES,
    ) as { range: { createdAt: { gte: Date; lte: Date } } };
    expect(r.range.createdAt.gte).toBeInstanceOf(Date);
    expect(r.range.createdAt.lte).toBeInstanceOf(Date);
  });
  it('gt → range', () => {
    expect(toClause({ field: 'age', condition: 'gt', dataType: 'number', value: 18 }, ES))
      .toEqual({ range: { age: { gt: 18 } } });
  });
  it('contains → wildcard', () => {
    expect(toClause({ field: 'name', condition: 'contains', value: 'foo' }, ES))
      .toEqual({ wildcard: { name: { value: '*foo*' } } });
  });
  it('contains/endsWith escape * and ? in the term (not treated as wildcards)', () => {
    expect(toClause({ field: 'name', condition: 'contains', value: 'a*b?c' }, ES))
      .toEqual({ wildcard: { name: { value: '*a\\*b\\?c*' } } });
    expect(toClause({ field: 'name', condition: 'endsWith', value: 'a*b' }, ES))
      .toEqual({ wildcard: { name: { value: '*a\\*b' } } });
    // a literal backslash in the term must itself be escaped
    expect(toClause({ field: 'name', condition: 'contains', value: 'a\\b' }, ES))
      .toEqual({ wildcard: { name: { value: '*a\\\\b*' } } });
  });
  it('startsWith → prefix', () => {
    expect(toClause({ field: 'name', condition: 'startsWith', value: 'fo' }, ES))
      .toEqual({ prefix: { name: 'fo' } });
  });
  it('isNull → must_not exists', () => {
    expect(toClause({ field: 'email', condition: 'isNull', value: null }, ES))
      .toEqual({ bool: { must_not: [{ exists: { field: 'email' } }] } });
  });
  it('multiMatch uses fields', () => {
    expect(toClause({ field: 'q', condition: 'multiMatch', fields: ['a', 'b'], value: 'x' }, ES))
      .toEqual({ multi_match: { query: 'x', fields: ['a', 'b'] } });
  });
  it('combinedFields is ES-only', () => {
    expect(toClause({ field: 'q', condition: 'combinedFields', fields: ['a', 'b'], value: 'x' }, ES))
      .toEqual({ combined_fields: { query: 'x', fields: ['a', 'b'] } });
    expect(() => toClause({ field: 'q', condition: 'combinedFields', fields: ['a'], value: 'x' }, 'opensearch'))
      .toThrow(UnsupportedClauseError);
  });
  it('rejects empty field', () => {
    expect(() => toClause({ field: '', condition: 'eq', value: 'x' }, ES)).toThrow(EsQueryError);
  });
});
