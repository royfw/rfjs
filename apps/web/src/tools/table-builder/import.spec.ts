import { describe, expect, it } from 'vitest';
import { parseImport } from './import';

describe('parseImport', () => {
  it('parses a JSON array of objects', () => {
    const r = parseImport('[{"a":1},{"a":2}]', 'json');
    expect(r).toEqual({ rows: [{ a: 1 }, { a: 2 }] });
  });
  it('rejects non-array / bad JSON', () => {
    expect('error' in parseImport('{"a":1}', 'json')).toBe(true);
    expect('error' in parseImport('not json', 'json')).toBe(true);
  });
  it('parses CSV with header + typed values', () => {
    const r = parseImport('a,b\n1,x\n2,y', 'csv');
    expect(r).toEqual({ rows: [{ a: 1, b: 'x' }, { a: 2, b: 'y' }] });
  });
  it('rejects empty CSV', () => {
    expect('error' in parseImport('', 'csv')).toBe(true);
  });
});
