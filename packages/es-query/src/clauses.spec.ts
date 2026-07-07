import { describe, it, expect } from 'vitest';
import * as c from './clauses';

describe('leaf clause builders', () => {
  it('term', () => {
    expect(c.term('status', 'open')).toEqual({ term: { status: 'open' } });
  });
  it('terms', () => {
    expect(c.terms('tag', ['a', 'b'])).toEqual({ terms: { tag: ['a', 'b'] } });
  });
  it('range with bounds', () => {
    expect(c.range('age', { gte: 18, lte: 65 })).toEqual({
      range: { age: { gte: 18, lte: 65 } },
    });
  });
  it('match / match_phrase', () => {
    expect(c.match('body', 'hi')).toEqual({ match: { body: 'hi' } });
    expect(c.matchPhrase('body', 'hi there')).toEqual({ match_phrase: { body: 'hi there' } });
  });
  it('multi_match / combined_fields', () => {
    expect(c.multiMatch(['a', 'b'], 'x')).toEqual({ multi_match: { query: 'x', fields: ['a', 'b'] } });
    expect(c.combinedFields(['a', 'b'], 'x')).toEqual({ combined_fields: { query: 'x', fields: ['a', 'b'] } });
  });
  it('wildcard / prefix / regexp / fuzzy', () => {
    expect(c.wildcard('name', '*foo*')).toEqual({ wildcard: { name: { value: '*foo*' } } });
    expect(c.prefix('name', 'fo')).toEqual({ prefix: { name: 'fo' } });
    expect(c.regexp('name', 'fo.*')).toEqual({ regexp: { name: 'fo.*' } });
    expect(c.fuzzy('name', 'foo')).toEqual({ fuzzy: { name: { value: 'foo' } } });
  });
  it('exists / negate', () => {
    expect(c.exists('email')).toEqual({ exists: { field: 'email' } });
    expect(c.negate(c.exists('email'))).toEqual({
      bool: { must_not: [{ exists: { field: 'email' } }] },
    });
  });
});
