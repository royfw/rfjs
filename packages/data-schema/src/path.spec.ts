import { describe, expect, it } from 'vitest';
import { getByPath } from './path';

describe('getByPath', () => {
  it('resolves nested dot paths', () => {
    expect(getByPath({ a: { b: [1, 2] } }, 'a.b')).toEqual([1, 2]);
  });
  it('returns the object itself for empty path', () => {
    const o = { a: 1 };
    expect(getByPath(o, '')).toBe(o);
  });
  it('returns undefined for missing segments and non-objects', () => {
    expect(getByPath({ a: 1 }, 'a.b.c')).toBeUndefined();
    expect(getByPath(null, 'a')).toBeUndefined();
  });
});
