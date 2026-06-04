import { describe, it, expect } from 'vitest';
import { toQuery } from './toQuery';

describe('toQuery', () => {
  it('builds an $eq query', () => {
    expect(toQuery('name', 'string', 'eq', 'test')).toEqual({
      name: { $eq: 'test' },
    });
  });

  it('builds a $in query for terms', () => {
    expect(toQuery('tag', 'string', 'terms', ['a', 'b'])).toEqual({
      tag: { $in: ['a', 'b'] },
    });
  });

  describe('regex', () => {
    it('produces a real RegExp, not a plain string', () => {
      const q = toQuery('name', 'string', 'regex', 'ab.*c') as {
        name: RegExp;
      };
      expect(q.name).toBeInstanceOf(RegExp);
      expect('abXYZc').toMatch(q.name);
    });

    it('passes a RegExp value through unchanged', () => {
      const re = /^foo/i;
      const q = toQuery('name', 'any', 'regex', re) as { name: RegExp };
      expect(q.name).toBeInstanceOf(RegExp);
      expect(q.name.source).toBe('^foo');
    });
  });

  describe('safety and validation', () => {
    it('throws a clear error for an unknown condition', () => {
      expect(() =>
        toQuery('name', 'string', 'bogus' as never, 'x'),
      ).toThrow(/unknown condition/i);
    });

    it('rejects a field name that injects a top-level operator', () => {
      expect(() => toQuery('$where', 'string', 'eq', 'x')).toThrow(
        /invalid field/i,
      );
    });
  });
});
