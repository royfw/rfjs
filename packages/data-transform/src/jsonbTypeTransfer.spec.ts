import { describe, it, expect } from 'vitest';
import { jsonbTypeTransfer } from './jsonbTypeTransfer';

describe('jsonbTypeTransfer', () => {
  describe('string types', () => {
    it('should return value as-is for string', () => {
      expect(jsonbTypeTransfer('hello', 'string')).toBe('hello');
    });

    it('should return value as-is for objectString', () => {
      expect(jsonbTypeTransfer('hello', 'objectString')).toBe('hello');
    });

    it('should return value as-is for arrayString', () => {
      expect(jsonbTypeTransfer('hello', 'arrayString')).toBe('hello');
    });

    it('should return value as-is for arrayObjectString', () => {
      expect(jsonbTypeTransfer('hello', 'arrayObjectString')).toBe('hello');
    });
  });

  describe('numeric types', () => {
    it('should convert to number for numeric', () => {
      expect(jsonbTypeTransfer('42', 'numeric')).toBe(42);
    });

    it('should convert to number for objectNumeric', () => {
      expect(jsonbTypeTransfer('42', 'objectNumeric')).toBe(42);
    });

    it('should convert to number for arrayNumeric', () => {
      expect(jsonbTypeTransfer('42', 'arrayNumeric')).toBe(42);
    });

    it('should convert to number for arrayObjectNumeric', () => {
      expect(jsonbTypeTransfer('42', 'arrayObjectNumeric')).toBe(42);
    });
  });

  describe('date types', () => {
    it('should convert to ISO string for date', () => {
      const result = jsonbTypeTransfer('2024-01-01', 'date');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should convert to ISO string for objectDate', () => {
      const result = jsonbTypeTransfer('2024-01-01', 'objectDate');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should convert to ISO string for arrayDate', () => {
      const result = jsonbTypeTransfer('2024-01-01', 'arrayDate');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should convert to ISO string for arrayObjectDate', () => {
      const result = jsonbTypeTransfer('2024-01-01', 'arrayObjectDate');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('boolean types', () => {
    it('should parse "true" for boolean', () => {
      expect(jsonbTypeTransfer('true', 'boolean')).toBe(true);
    });

    it('should parse "false" for objectBoolean', () => {
      expect(jsonbTypeTransfer('false', 'objectBoolean')).toBe(false);
    });

    it('should parse "true" for arrayBoolean', () => {
      expect(jsonbTypeTransfer('true', 'arrayBoolean')).toBe(true);
    });

    it('should parse "false" for arrayObjectBoolean', () => {
      expect(jsonbTypeTransfer('false', 'arrayObjectBoolean')).toBe(false);
    });
  });

  describe('unknown type', () => {
    it('should fall back to string for unknown type', () => {
      expect(jsonbTypeTransfer('x', 'unknown' as any)).toBe('x');
    });
  });
});
