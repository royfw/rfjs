import { describe, it, expect } from 'vitest';
import { ColumnQueryError } from './errors';

describe('ColumnQueryError', () => {
  it('is an Error carrying a typed code and name', () => {
    const err = new ColumnQueryError('nope', 'UNKNOWN_COLUMN');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('UNKNOWN_COLUMN');
    expect(err.name).toBe('ColumnQueryError');
    expect(err.message).toBe('nope');
  });
});
