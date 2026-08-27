import { describe, it, expect } from 'vitest';
import { ArrayMatch } from './ArrayMatch';

const data = { tags: ['vip', 'beta', 'staff'], scores: [60, 85, 90] };

describe('ArrayMatch (scalar elements)', () => {
  it('eq is ∃ (some element equals)', () => {
    expect(new ArrayMatch('tags', 'string', 'eq', 'vip', data).isMatch).toBe(true);
    expect(new ArrayMatch('tags', 'string', 'eq', 'nope', data).isMatch).toBe(false);
  });
  it('contains / gt / range / terms are ∃', () => {
    expect(new ArrayMatch('tags', 'string', 'contains', 'eta', data).isMatch).toBe(true);
    expect(new ArrayMatch('scores', 'numeric', 'gt', 80, data).isMatch).toBe(true);
    expect(new ArrayMatch('scores', 'numeric', 'range', [50, 70], data).isMatch).toBe(true);
    expect(new ArrayMatch('tags', 'string', 'terms', ['admin', 'staff'], data).isMatch).toBe(true);
  });
  it('terms is any-membership by exact value (the portable membership op, #267)', () => {
    // exact equality, NOT substring: `manager` must not match `skip_manager`
    const roles = { roles: ['skip_manager', 'staff'] };
    expect(new ArrayMatch('roles', 'string', 'terms', 'manager', roles).isMatch).toBe(false);
    expect(new ArrayMatch('roles', 'string', 'contains', 'manager', roles).isMatch).toBe(true); // substring, for contrast
    // any of the wanted values present → match
    expect(new ArrayMatch('tags', 'string', 'terms', ['x', 'staff'], data).isMatch).toBe(true);
    expect(new ArrayMatch('tags', 'string', 'terms', ['x', 'y'], data).isMatch).toBe(false);
  });
  it('evaluates the ∃ substring i-ops per-element without throwing (issue #279 parity)', () => {
    const roles = { roles: ['Engineering', 'Sales'] };
    expect(() => new ArrayMatch('roles', 'string', 'icontains', 'GINE', roles).isMatch).not.toThrow();
    expect(new ArrayMatch('roles', 'string', 'icontains', 'GINE', roles).isMatch).toBe(true);
    expect(new ArrayMatch('roles', 'string', 'contains', 'GINE', roles).isMatch).toBe(false); // case-sensitive
    expect(new ArrayMatch('roles', 'string', 'istartswith', 'eng', roles).isMatch).toBe(true);
    expect(new ArrayMatch('roles', 'string', 'iendswith', 'ING', roles).isMatch).toBe(true);
  });
  it('containsall requires every value present', () => {
    expect(new ArrayMatch('tags', 'string', 'containsall', ['vip', 'staff'], data).isMatch).toBe(true);
    expect(new ArrayMatch('tags', 'string', 'containsall', ['vip', 'x'], data).isMatch).toBe(false);
  });
  it('containsall works on dates (timestamp compare)', () => {
    const d = { ds: [new Date('2024-01-01'), new Date('2024-06-15')] };
    expect(new ArrayMatch('ds', 'date', 'containsall', [new Date('2024-01-01')], d).isMatch).toBe(true);
    expect(new ArrayMatch('ds', 'date', 'containsall', [new Date('2025-01-01')], d).isMatch).toBe(false);
  });
  it('isnull / isnotnull test the field', () => {
    expect(new ArrayMatch('missing', 'string', 'isnull', undefined, data).isMatch).toBe(true);
    expect(new ArrayMatch('tags', 'string', 'isnotnull', undefined, data).isMatch).toBe(true);
  });
  it('a non-array stored value is treated as empty → no match', () => {
    expect(new ArrayMatch('tags', 'string', 'eq', 'vip', { tags: 'vip' }).isMatch).toBe(false);
  });
  it('throws on an unsupported operator for the elementType', () => {
    expect(() => new ArrayMatch('tags', 'boolean', 'range', [1, 2], data)).toThrow(/unsupported operator/);
  });
});
