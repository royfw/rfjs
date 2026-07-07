import { describe, it, expect } from 'vitest';
import { PgFilterError } from './errors';

describe('PgFilterError', () => {
  it('carries a code and a name', () => {
    const err = new PgFilterError('bad target', 'INVALID_TARGET');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('INVALID_TARGET');
    expect(err.name).toBe('PgFilterError');
    expect(err.message).toBe('bad target');
  });
});
