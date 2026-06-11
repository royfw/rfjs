import { describe, it, expect } from 'vitest';
import { typeTransfer, createMatchQuery } from './matchQuery';
import type { MatchQueryMetadata } from '../types';

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

describe('createMatchQuery dataType validation', () => {
  it('throws on an unsupported dataType', () => {
    const bad = {
      field: 'a',
      dataType: 'mystery',
      operator: 'eq',
      value: 1,
    } as unknown as MatchQueryMetadata;
    expect(() => createMatchQuery({ a: 1 }, bad)).toThrow(/unsupported dataType/);
  });
});
