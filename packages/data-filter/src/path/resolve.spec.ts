import { describe, it, expect } from 'vitest';
import { resolvePath, assertSupportedPath } from './resolve';

const testData = {
  user: { name: 'Alice' },
  users: [
    { name: 'Alice', tags: ['a'] },
    { name: 'Bob', tags: ['b', 'c'] },
  ],
  metadata: { 'tag,version': 'v1' },
  'a.b': 'literal-dot-key',
};

describe('resolvePath (plain paths via _.get)', () => {
  it('resolves dotted paths and single indexes', () => {
    expect(resolvePath(testData, 'user.name')).toBe('Alice');
    expect(resolvePath(testData, 'users[0].name')).toBe('Alice');
    expect(resolvePath(testData, 'users[1].tags[0]')).toBe('b');
  });
  it('resolves literal keys containing a comma or dot (direct-key check)', () => {
    expect(resolvePath(testData, 'metadata.tag,version')).toBe('v1');
    expect(resolvePath(testData, 'a.b')).toBe('literal-dot-key');
  });
  it('missing path: undefined by default, null with fallbackOnEmpty=false', () => {
    expect(resolvePath(testData, 'user.nope')).toBeUndefined();
    expect(resolvePath(testData, 'user.nope', { fallbackOnEmpty: false })).toBeNull();
  });
  it('nullish data resolves to undefined', () => {
    expect(resolvePath(null, 'a.b')).toBeUndefined();
    expect(resolvePath(undefined, 'a')).toBeUndefined();
  });
  it('preserves stored null values', () => {
    expect(resolvePath({ value: null }, 'value')).toBeNull();
  });
});

describe('removed jsonpath forms throw with guidance', () => {
  const removed = [
    'users[*].name',
    '$..name',
    'users[?(@.age > 25)].name',
    'users[0:2].name',
    'users[0,1].name',
    '$.user.name',
    'users[(@.length-1)].name',
  ];
  for (const path of removed) {
    it(`throws for '${path}'`, () => {
      expect(() => resolvePath(testData, path)).toThrow(/unsupported path syntax/);
    });
  }
  it('assertSupportedPath accepts plain paths', () => {
    expect(() => assertSupportedPath('a.b[0].c')).not.toThrow();
  });
});
