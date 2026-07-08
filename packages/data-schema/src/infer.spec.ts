import { describe, expect, it } from 'vitest';
import { inferFieldsFromRows } from './infer';

describe('inferFieldsFromRows', () => {
  it('infers scalar types and flattens nested objects to dot paths', () => {
    const fields = inferFieldsFromRows([
      { name: 'a', age: 30, active: true, joined: '2024-01-15T00:00:00Z', author: { name: 'x' }, tags: ['a'] },
    ]);
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f.dataType]));
    expect(byKey).toEqual({ name: 'string', age: 'numeric', active: 'boolean', joined: 'date', 'author.name': 'string' });
    // tags (array) and author (object itself) do not produce fields
    expect(fields.some((f) => f.key === 'tags')).toBe(false);
    expect(fields.some((f) => f.key === 'author')).toBe(false);
  });

  it('defaults label to the key string', () => {
    const fields = inferFieldsFromRows([{ name: 'a' }]);
    expect(fields).toEqual([{ key: 'name', label: 'name', dataType: 'string' }]);
  });

  it('falls back to string on cross-row type conflicts and skips null', () => {
    const fields = inferFieldsFromRows([{ v: 1 }, { v: 'x' }, { w: null }, { w: 2 }]);
    expect(Object.fromEntries(fields.map((f) => [f.key, f.dataType]))).toEqual({ v: 'string', w: 'numeric' });
  });

  it('skips undefined values the same way as null', () => {
    const fields = inferFieldsFromRows([{ a: undefined, b: 1 }]);
    expect(fields).toEqual([{ key: 'b', label: 'b', dataType: 'numeric' }]);
  });

  it('detects non-ISO-looking strings as plain string, not date', () => {
    const fields = inferFieldsFromRows([{ note: 'hello world' }]);
    expect(fields).toEqual([{ key: 'note', label: 'note', dataType: 'string' }]);
  });

  it('flattens arbitrarily nested plain objects', () => {
    const fields = inferFieldsFromRows([{ a: { b: { c: 1 } } }]);
    expect(fields).toEqual([{ key: 'a.b.c', label: 'a.b.c', dataType: 'numeric' }]);
  });

  it('returns [] for empty array and throws on non-array / non-object rows', () => {
    expect(inferFieldsFromRows([])).toEqual([]);
    expect(() => inferFieldsFromRows('x')).toThrow();
    expect(() => inferFieldsFromRows([1])).toThrow();
  });
});
