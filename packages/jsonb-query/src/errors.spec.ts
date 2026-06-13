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
