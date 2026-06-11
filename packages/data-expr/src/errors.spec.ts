import { describe, it, expect } from 'vitest';
import { DataExprError } from './errors';

describe('DataExprError', () => {
  it('carries kind, expression, and message', () => {
    const err = new DataExprError('compile', '$sum((', 'invalid expression');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DataExprError');
    expect(err.kind).toBe('compile');
    expect(err.expression).toBe('$sum((');
    expect(err.message).toContain('invalid expression');
  });
  it('preserves the underlying cause', () => {
    const cause = new Error('boom');
    const err = new DataExprError('evaluate', 'a.b', 'evaluation failed', { cause });
    expect(err.cause).toBe(cause);
  });
});
