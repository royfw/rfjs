import { describe, it, expect } from 'vitest';
import { getDemoValue } from './getDemoValue';

describe('utils/demo/getDemoValue', () => {
  it('should return the correct value', () => {
    expect(getDemoValue()).toBe('demo');
  });
});
