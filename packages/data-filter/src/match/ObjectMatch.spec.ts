import { describe, it, expect } from 'vitest';
import { ObjectMatch } from './ObjectMatch';

const data = { profile: { vip: true, level: 3 } };

describe('ObjectMatch', () => {
  it('eq is strict structural equality', () => {
    expect(new ObjectMatch('profile', 'eq', { vip: true, level: 3 }, data).isMatch).toBe(true);
    expect(new ObjectMatch('profile', 'eq', { vip: true }, data).isMatch).toBe(false);
  });
  it('neq is the negation of eq', () => {
    expect(new ObjectMatch('profile', 'neq', { vip: true, level: 3 }, data).isMatch).toBe(false);
    expect(new ObjectMatch('profile', 'neq', { vip: false }, data).isMatch).toBe(true);
  });
  it('contains is recursive containment with strict leaves', () => {
    expect(new ObjectMatch('profile', 'contains', { vip: true }, data).isMatch).toBe(true);
    expect(new ObjectMatch('profile', 'contains', { vip: false }, data).isMatch).toBe(false);
  });
  it('isnull / isnotnull test the field', () => {
    expect(new ObjectMatch('settings', 'isnull', undefined, data).isMatch).toBe(true);
    expect(new ObjectMatch('profile', 'isnotnull', undefined, data).isMatch).toBe(true);
  });
  it('throws on an unsupported operator', () => {
    expect(() => new ObjectMatch('profile', 'gt', { x: 1 }, data)).toThrow(/unsupported operator/);
  });
});
