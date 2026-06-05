import { describe, it, expect } from 'vitest';
import { typeTransfer } from './typeTransfer';

describe('typeTransfer', () => {
  describe('string', () => {
    it('should return value as-is for string type', () => {
      expect(typeTransfer('hello', 'string')).toBe('hello');
    });
  });

  describe('number', () => {
    it('should convert string to number', () => {
      expect(typeTransfer('42', 'number')).toBe(42);
    });

    it('should pass through number', () => {
      expect(typeTransfer(42, 'number')).toBe(42);
    });
  });

  describe('integer', () => {
    it('should convert string to integer', () => {
      expect(typeTransfer('42', 'integer')).toBe(42);
    });
  });

  describe('boolean', () => {
    it('should parse "true" string as true', () => {
      expect(typeTransfer('true', 'boolean')).toBe(true);
    });

    it('should parse "false" string as false', () => {
      expect(typeTransfer('false', 'boolean')).toBe(false);
    });

    it('should pass through boolean', () => {
      expect(typeTransfer(true, 'boolean')).toBe(true);
    });
  });

  describe('date', () => {
    it('should convert string to Date', () => {
      expect(typeTransfer('2024-01-01', 'date')).toBeInstanceOf(Date);
    });

    it('should convert timestamp to Date', () => {
      expect(typeTransfer(1705276800000, 'date')).toBeInstanceOf(Date);
    });
  });

  describe('any', () => {
    it('should return value as-is', () => {
      expect(typeTransfer('anything', 'any')).toBe('anything');
    });
  });

  describe('unknown type', () => {
    it('should fall back to any for unknown type', () => {
      expect(typeTransfer('x', 'unknown' as any)).toBe('x');
    });
  });
});
