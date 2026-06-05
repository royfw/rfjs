import { describe, it, expect } from 'vitest';
import { toDateString } from './date';

describe('toDateString', () => {
  it('should convert date string to ISO format', () => {
    const result = toDateString('2024-01-15');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should convert timestamp number to ISO format', () => {
    const result = toDateString(1705276800000);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should return string type', () => {
    expect(typeof toDateString('2024-01-01')).toBe('string');
  });

  it('throws a clear error for an unparseable date value', () => {
    expect(() => toDateString('not a date')).toThrow(/invalid date value/i);
  });
});
