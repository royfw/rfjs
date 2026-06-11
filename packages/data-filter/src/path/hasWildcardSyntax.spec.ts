import { describe, it, expect } from 'vitest';
import { hasWildcardSyntax } from './resolve';

describe('hasWildcardSyntax', () => {
  it('detects wildcard / multi-value syntax', () => {
    expect(hasWildcardSyntax('users[*].name')).toBe(true);
    expect(hasWildcardSyntax('$..name')).toBe(true);
    expect(hasWildcardSyntax('items[?(@.x)]')).toBe(true);
    expect(hasWildcardSyntax('items[0:2]')).toBe(true);
    expect(hasWildcardSyntax('items[0,1]')).toBe(true);
  });
  it('treats plain dotted / single-index paths as non-wildcard', () => {
    expect(hasWildcardSyntax('a.b')).toBe(false);
    expect(hasWildcardSyntax('users[0].tags')).toBe(false);
    expect(hasWildcardSyntax('tags')).toBe(false);
  });
});
