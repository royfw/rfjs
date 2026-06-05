import { describe, it, expect } from 'vitest';
import { quoteIdent } from './identifier';

describe('quoteIdent', () => {
  it('wraps a plain identifier in double quotes', () => {
    expect(quoteIdent('users')).toBe('"users"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    // a naive `"${name}"` would let this break out of the quoted identifier
    expect(quoteIdent('ev"il')).toBe('"ev""il"');
  });

  it('neutralises an injection attempt that closes the identifier', () => {
    const malicious = 'x"; DROP TABLE users; --';
    expect(quoteIdent(malicious)).toBe('"x""; DROP TABLE users; --"');
  });

  it('rejects identifiers containing a null byte', () => {
    const withNull = `a${String.fromCharCode(0)}b`;
    expect(() => quoteIdent(withNull)).toThrow(/null byte/i);
  });
});
