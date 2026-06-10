import { describe, it, expect } from 'vitest';
import { getByPath } from './getByPath';

describe('getByPath', () => {
  it('reads a nested dot path', () => {
    expect(getByPath({ a: { b: 1 } }, 'a.b')).toBe(1);
  });
  it('reads through array bracket indexes', () => {
    expect(getByPath({ a: [{ b: 2 }] }, 'a[0].b')).toBe(2);
  });
  it('returns undefined for a missing key', () => {
    expect(getByPath({ a: { b: 1 } }, 'a.x')).toBeUndefined();
  });
  it('short-circuits on a nullish intermediate', () => {
    expect(getByPath({ a: null }, 'a.b')).toBeUndefined();
  });
  it('returns undefined for nullish input', () => {
    expect(getByPath(null, 'a')).toBeUndefined();
    expect(getByPath(undefined, 'a')).toBeUndefined();
  });
  it('returns undefined for an empty path', () => {
    expect(getByPath({ a: 1 }, '')).toBeUndefined();
  });
  it('parses paths as nested, not as a literal dotted key', () => {
    expect(getByPath({ 'a.b': 5 }, 'a.b')).toBeUndefined();
  });
  it('returns a leaf scalar value as-is', () => {
    expect(getByPath({ a: 'hi' }, 'a')).toBe('hi');
    expect(getByPath({ a: 0 }, 'a')).toBe(0);
    expect(getByPath({ a: false }, 'a')).toBe(false);
  });
});
