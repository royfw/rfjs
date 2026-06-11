import { describe, it, expect } from 'vitest';
import { isExpression, stripExpressionPrefix } from './slot';

describe('slot helpers', () => {
  it('isExpression: true only for "="-prefixed strings', () => {
    expect(isExpression('=$sum(items.amount)')).toBe(true);
    expect(isExpression('==')).toBe(true);
    expect(isExpression('items.amount')).toBe(false);
    expect(isExpression('')).toBe(false);
  });
  it('stripExpressionPrefix removes exactly one leading "="', () => {
    expect(stripExpressionPrefix('=$count(items)')).toBe('$count(items)');
    expect(stripExpressionPrefix('==')).toBe('=');
    expect(stripExpressionPrefix('plain')).toBe('plain');
  });
});
