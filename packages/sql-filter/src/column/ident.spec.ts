import { describe, it, expect } from 'vitest';
import { quoteIdent } from './ident';

describe('quoteIdent', () => {
  it('wraps an identifier in double quotes', () => {
    expect(quoteIdent('created_at')).toBe('"created_at"');
  });

  it('doubles embedded double-quotes so identifiers cannot break out', () => {
    expect(quoteIdent('a"b')).toBe('"a""b"');
    expect(quoteIdent('x"; drop table t; --')).toBe('"x""; drop table t; --"');
  });
});
