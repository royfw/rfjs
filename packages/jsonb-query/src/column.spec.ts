import { describe, it, expect } from 'vitest';
import { quoteJsonbColumn } from './column';

describe('quoteJsonbColumn', () => {
  it('quotes a simple column', () => {
    expect(quoteJsonbColumn('data')).toBe('"data"');
  });

  it('quotes a qualified table.column reference', () => {
    expect(quoteJsonbColumn('t.payload')).toBe('"t"."payload"');
  });

  it('rejects an injection attempt', () => {
    expect(() => quoteJsonbColumn('data; DROP TABLE t')).toThrow(/invalid jsonb column/i);
  });

  it('rejects a segment with a double quote', () => {
    expect(() => quoteJsonbColumn('da"ta')).toThrow(/invalid jsonb column/i);
  });
});
