import { describe, expect, it } from 'vitest';
import { extractCursor, extractRows, extractTotal } from './response';
import type { ResponseMeta } from './types';

describe('extractRows', () => {
  it('extracts a nested array via rowsPath', () => {
    const payload = { data: { items: [{ id: 1 }, { id: 2 }] } };
    const response: ResponseMeta = { rowsPath: 'data.items' };
    expect(extractRows(payload, response)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('treats an empty rowsPath as "the payload itself is the array"', () => {
    const payload = [{ id: 1 }];
    const response: ResponseMeta = { rowsPath: '' };
    expect(extractRows(payload, response)).toEqual([{ id: 1 }]);
  });

  it('throws with a message including the path when the resolved value is not an array', () => {
    const payload = { data: { items: 'not-an-array' } };
    const response: ResponseMeta = { rowsPath: 'data.items' };
    expect(() => extractRows(payload, response)).toThrow(/data\.items/);
  });

  it('throws when the path resolves to nothing (missing)', () => {
    const payload = { data: {} };
    const response: ResponseMeta = { rowsPath: 'data.items' };
    expect(() => extractRows(payload, response)).toThrow(/data\.items/);
  });
});

describe('extractTotal', () => {
  it('returns the number at totalPath', () => {
    const payload = { data: { total: 42 } };
    const response: ResponseMeta = { rowsPath: 'data.items', totalPath: 'data.total' };
    expect(extractTotal(payload, response)).toBe(42);
  });

  it('returns undefined when the resolved value is not a number', () => {
    const payload = { data: { total: '42' } };
    const response: ResponseMeta = { rowsPath: 'data.items', totalPath: 'data.total' };
    expect(extractTotal(payload, response)).toBeUndefined();
  });

  it('returns undefined when totalPath is not set', () => {
    const payload = { data: { total: 42 } };
    const response: ResponseMeta = { rowsPath: 'data.items' };
    expect(extractTotal(payload, response)).toBeUndefined();
  });

  it('returns undefined when totalPath resolves to nothing', () => {
    const payload = { data: {} };
    const response: ResponseMeta = { rowsPath: 'data.items', totalPath: 'data.total' };
    expect(extractTotal(payload, response)).toBeUndefined();
  });
});

describe('extractCursor', () => {
  it('returns the string at cursorPath', () => {
    const payload = { data: { nextCursor: 'abc123' } };
    const response: ResponseMeta = { rowsPath: 'data.items', cursorPath: 'data.nextCursor' };
    expect(extractCursor(payload, response)).toBe('abc123');
  });

  it('returns undefined when cursorPath is not set', () => {
    const payload = { data: { nextCursor: 'abc123' } };
    const response: ResponseMeta = { rowsPath: 'data.items' };
    expect(extractCursor(payload, response)).toBeUndefined();
  });

  it('returns undefined when the resolved value is not a string or is missing', () => {
    const response: ResponseMeta = { rowsPath: 'data.items', cursorPath: 'data.nextCursor' };
    expect(extractCursor({ data: { nextCursor: 5 } }, response)).toBeUndefined();
    expect(extractCursor({ data: {} }, response)).toBeUndefined();
  });
});
