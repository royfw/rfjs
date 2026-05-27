import { describe, it, expect } from 'vitest';
import { toBoolean } from './boolean';

describe('toBoolean', () => {
  it('should parse string "true" as boolean true', () => {
    expect(toBoolean('true')).toBe(true);
  });

  it('should parse string "false" as boolean false', () => {
    expect(toBoolean('false')).toBe(false);
  });

  it('should pass through boolean true', () => {
    expect(toBoolean(true)).toBe(true);
  });

  it('should pass through boolean false', () => {
    expect(toBoolean(false)).toBe(false);
  });

  it('should convert non-boolean string via Boolean()', () => {
    expect(toBoolean('yes')).toBe(true);
  });

  it('should handle empty string as false', () => {
    expect(toBoolean('')).toBe(false);
  });
});
