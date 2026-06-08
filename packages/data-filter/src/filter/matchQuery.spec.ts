import { describe, it, expect } from 'vitest';
import { typeTransfer } from './matchQuery';

describe('typeTransfer boolean coercion', () => {
  it('parses explicit false tokens to false', () => {
    expect(typeTransfer('false', 'boolean')).toBe(false);
    expect(typeTransfer('False', 'boolean')).toBe(false);
    expect(typeTransfer('FALSE', 'boolean')).toBe(false);
    expect(typeTransfer('0', 'boolean')).toBe(false);
    expect(typeTransfer('no', 'boolean')).toBe(false);
    expect(typeTransfer('off', 'boolean')).toBe(false);
  });

  it('keeps truthy tokens true', () => {
    expect(typeTransfer('true', 'boolean')).toBe(true);
    expect(typeTransfer('1', 'boolean')).toBe(true);
    expect(typeTransfer('yes', 'boolean')).toBe(true);
  });

  it('passes through actual booleans', () => {
    expect(typeTransfer(true, 'boolean')).toBe(true);
    expect(typeTransfer(false, 'boolean')).toBe(false);
  });
});
