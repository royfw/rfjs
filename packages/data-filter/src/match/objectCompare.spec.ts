import { describe, it, expect } from 'vitest';
import { deepEqual, contains } from './objectCompare';

describe('deepEqual', () => {
  it('compares primitives strictly (null/false/0/NaN distinct)', () => {
    expect(deepEqual(null, false)).toBe(false);
    expect(deepEqual(0, false)).toBe(false);
    expect(deepEqual(NaN, NaN)).toBe(false);
    expect(deepEqual('a', 'a')).toBe(true);
  });
  it('compares Dates by time', () => {
    expect(deepEqual(new Date('2024-01-01'), new Date('2024-01-01'))).toBe(true);
    expect(deepEqual(new Date('2024-01-01'), new Date('2024-01-02'))).toBe(false);
  });
  it('compares nested objects and arrays structurally', () => {
    expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [1, 2] } })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });
});

describe('contains', () => {
  it('matches when every key/value in value is present (recursive)', () => {
    expect(contains({ vip: true, level: 3 }, { vip: true })).toBe(true);
    expect(contains({ a: { x: 1, y: 2 } }, { a: { x: 1 } })).toBe(true);
  });
  it('uses strict deep-equal on leaves (null is not false)', () => {
    expect(contains({ vip: null, level: 3 }, { vip: false })).toBe(false);
    expect(contains({ vip: null }, { vip: null })).toBe(true);
  });
  it('is false when a key is missing or target is not an object', () => {
    expect(contains({ level: 3 }, { vip: false })).toBe(false);
    expect(contains('nope', { vip: true })).toBe(false);
  });
});
