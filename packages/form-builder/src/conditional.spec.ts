import { describe, it, expect } from 'vitest';
import { evaluateConditional } from './conditional';
import type { ConditionalRule } from './conditional';

describe('evaluateConditional', () => {
  it('returns true when rule is undefined', () => {
    expect(evaluateConditional(undefined, {})).toBe(true);
  });

  it('returns true for an empty and-group (always shown)', () => {
    const rule: ConditionalRule = { logic: 'and', filters: [] };
    expect(evaluateConditional(rule, {})).toBe(true);
  });

  // Empty-group semantics are asymmetric by logic — documents the contract before
  // Task 6's editor picks a default logic. (and/nor → true, or/not → false.)
  it('returns false for an empty or-group', () => {
    expect(evaluateConditional({ logic: 'or', filters: [] }, {})).toBe(false);
  });

  it('returns true for an empty nor-group', () => {
    expect(evaluateConditional({ logic: 'nor', filters: [] }, {})).toBe(true);
  });

  it('returns false for an empty not-group', () => {
    expect(evaluateConditional({ logic: 'not', filters: [] }, {})).toBe(false);
  });

  describe('string condition (eq)', () => {
    const rule: ConditionalRule = {
      logic: 'and',
      filters: [{ field: 'role', dataType: 'string', operator: 'eq', value: 'admin' }],
    };

    it('returns true when field matches', () => {
      expect(evaluateConditional(rule, { role: 'admin' })).toBe(true);
    });

    it('returns false when field does not match', () => {
      expect(evaluateConditional(rule, { role: 'user' })).toBe(false);
    });

    it('returns false when field is missing', () => {
      expect(evaluateConditional(rule, {})).toBe(false);
    });
  });

  describe('numeric condition (gte)', () => {
    const rule: ConditionalRule = {
      logic: 'and',
      filters: [{ field: 'age', dataType: 'numeric', operator: 'gte', value: 18 }],
    };

    it('returns true when age >= 18', () => {
      expect(evaluateConditional(rule, { age: 18 })).toBe(true);
      expect(evaluateConditional(rule, { age: 30 })).toBe(true);
    });

    it('returns false when age < 18', () => {
      expect(evaluateConditional(rule, { age: 17 })).toBe(false);
    });
  });
});
