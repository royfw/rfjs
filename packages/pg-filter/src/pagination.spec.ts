import { describe, it, expect } from 'vitest';
import { computeLimitOffset } from './pagination';
import { PgFilterError } from './errors';

describe('computeLimitOffset', () => {
  it('returns nothing when pageSize is omitted', () => {
    expect(computeLimitOffset({})).toEqual({});
    expect(computeLimitOffset({ page: 3 })).toEqual({});
  });

  it('computes limit/offset for a 1-based page', () => {
    expect(computeLimitOffset({ page: 1, pageSize: 20 })).toEqual({ limit: 20, offset: 0 });
    expect(computeLimitOffset({ page: 3, pageSize: 20 })).toEqual({ limit: 20, offset: 40 });
  });

  it('defaults page to 1', () => {
    expect(computeLimitOffset({ pageSize: 10 })).toEqual({ limit: 10, offset: 0 });
  });

  it('throws INVALID_PAGINATION on non-positive-integer page/pageSize', () => {
    expect(() => computeLimitOffset({ page: 0, pageSize: 10 })).toThrow(PgFilterError);
    expect(() => computeLimitOffset({ page: 1.5, pageSize: 10 })).toThrow(PgFilterError);
    expect(() => computeLimitOffset({ pageSize: 0 })).toThrow(PgFilterError);
    expect(() => computeLimitOffset({ pageSize: -5 })).toThrow(PgFilterError);
  });
});
