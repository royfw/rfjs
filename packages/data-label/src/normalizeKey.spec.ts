import { describe, it, expect } from 'vitest';
import { normalizeKey } from './normalizeKey';

describe('normalizeKey', () => {
  it('strips brackets', () => {
    expect(normalizeKey('contract[0]')).toBe('contract0');
  });
  it('strips dots and brackets together', () => {
    expect(normalizeKey('a.b[1]')).toBe('ab1');
  });
  it('leaves a positional/underscore token unchanged', () => {
    expect(normalizeKey('_0')).toBe('_0');
  });
  it('leaves a plain alias key unchanged', () => {
    expect(normalizeKey('alias1')).toBe('alias1');
  });
});
