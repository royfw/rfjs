import { describe, it, expect } from 'vitest';
import { DateMatch } from './DateMatch';

describe('DateMatch', () => {
  const data = {
    createdAt: new Date('2024-06-15'),
    updatedAt: new Date('2024-01-01'),
  };

  describe('eq', () => {
    it('should match equal date', () => {
      const q = new DateMatch('createdAt', 'eq', new Date('2024-06-15'), data);
      expect(q.isMatch).toBe(true);
    });

    it('should not match different date', () => {
      const q = new DateMatch('createdAt', 'eq', new Date('2024-01-01'), data);
      expect(q.isMatch).toBe(false);
    });
  });

  describe('neq', () => {
    it('should match when dates are different', () => {
      const q = new DateMatch('createdAt', 'neq', new Date('2024-01-01'), data);
      expect(q.isMatch).toBe(true);
    });
  });

  describe('gt', () => {
    it('should match when target > value', () => {
      const q = new DateMatch('createdAt', 'gt', new Date('2024-01-01'), data);
      expect(q.isMatch).toBe(true);
    });

    it('should not match when target < value', () => {
      const q = new DateMatch('createdAt', 'gt', new Date('2025-01-01'), data);
      expect(q.isMatch).toBe(false);
    });
  });

  describe('gte', () => {
    it('should match when target >= value', () => {
      const q = new DateMatch('createdAt', 'gte', new Date('2024-06-15'), data);
      expect(q.isMatch).toBe(true);
    });
  });

  describe('lt', () => {
    it('should match when target < value', () => {
      const q = new DateMatch('createdAt', 'lt', new Date('2025-01-01'), data);
      expect(q.isMatch).toBe(true);
    });
  });

  describe('lte', () => {
    it('should match when target <= value', () => {
      const q = new DateMatch('createdAt', 'lte', new Date('2024-06-15'), data);
      expect(q.isMatch).toBe(true);
    });
  });

  describe('range', () => {
    it('should match when target is within range', () => {
      const q = new DateMatch('createdAt', 'range', [new Date('2024-01-01'), new Date('2024-12-31')], data);
      expect(q.isMatch).toBe(true);
    });

    it('should not match when target is outside range', () => {
      const q = new DateMatch('createdAt', 'range', [new Date('2025-01-01'), new Date('2025-12-31')], data);
      expect(q.isMatch).toBe(false);
    });
  });

  describe('isnull', () => {
    it('should match null field', () => {
      const q = new DateMatch('missingField', 'isnull', null, data);
      expect(q.isMatch).toBe(true);
    });

    it('should not match existing field', () => {
      const q = new DateMatch('createdAt', 'isnull', null, data);
      expect(q.isMatch).toBe(false);
    });
  });

  describe('isnotnull', () => {
    it('should match existing field', () => {
      const q = new DateMatch('createdAt', 'isnotnull', null, data);
      expect(q.isMatch).toBe(true);
    });
  });

  describe('terms', () => {
    it('should match when target is in terms list', () => {
      const q = new DateMatch('createdAt', 'terms', [new Date('2024-06-15'), new Date('2024-07-01')], data);
      expect(q.isMatch).toBe(true);
    });

    it('should not match when target is not in terms list', () => {
      const q = new DateMatch('createdAt', 'terms', [new Date('2025-01-01'), new Date('2025-07-01')], data);
      expect(q.isMatch).toBe(false);
    });
  });

  describe('string date input', () => {
    it('should match with date string', () => {
      const q = new DateMatch('createdAt', 'eq', '2024-06-15', data);
      expect(q.isMatch).toBe(true);
    });
  });
});
