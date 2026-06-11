import { describe, it, expect } from 'vitest';
import { escapeJsonpathString, escapeRegexLiteral } from './escape';

describe('escapeJsonpathString', () => {
  it('escapes backslash then double quote', () => {
    expect(escapeJsonpathString('a"b')).toBe('a\\"b');
    expect(escapeJsonpathString('a\\b')).toBe('a\\\\b');
    expect(escapeJsonpathString('a\\"')).toBe('a\\\\\\"');
  });

  it('escapes control characters', () => {
    expect(escapeJsonpathString('a\nb')).toBe('a\\u000ab');
  });
});

describe('escapeRegexLiteral', () => {
  it('escapes POSIX regex metacharacters', () => {
    expect(escapeRegexLiteral('a.b')).toBe('a\\.b');
    expect(escapeRegexLiteral('a+b(c)')).toBe('a\\+b\\(c\\)');
  });
});
