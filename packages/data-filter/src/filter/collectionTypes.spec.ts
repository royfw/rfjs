import { describe, it, expect } from 'vitest';
import { matchQuery } from './matchQuery';
import type { FilterMatchQuery } from '../types';

const wrap = (cond: unknown): FilterMatchQuery =>
  ({ logic: 'and', filters: [cond] } as FilterMatchQuery);

describe('collection dataTypes via matchQuery', () => {
  it('object contains', () => {
    expect(
      matchQuery({ profile: { vip: true } }, wrap({ field: 'profile', dataType: 'object', operator: 'contains', value: { vip: true } })),
    ).toBe(true);
  });
  it('array contains (∃)', () => {
    expect(
      matchQuery({ tags: ['a', 'b'] }, wrap({ field: 'tags', dataType: 'array', elementType: 'string', operator: 'contains', value: 'b' })),
    ).toBe(true);
  });
  it('"does not contain" via not + array eq', () => {
    const f: FilterMatchQuery = {
      logic: 'not',
      filters: [{ field: 'tags', dataType: 'array', elementType: 'string', operator: 'eq', value: 'a' } as never],
    };
    expect(matchQuery({ tags: ['a', 'b'] }, f)).toBe(false);
    expect(matchQuery({ tags: ['x'] }, f)).toBe(true);
  });
  it('elemmatch — same element', () => {
    const f = wrap({
      field: 'items', dataType: 'array', elementType: 'object', operator: 'elemmatch',
      filters: { logic: 'and', filters: [
        { field: 'sku', dataType: 'string', operator: 'eq', value: 'A' },
        { field: 'qty', dataType: 'numeric', operator: 'gt', value: 1 },
      ] },
    });
    expect(matchQuery({ items: [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 5 }] }, f)).toBe(false);
    expect(matchQuery({ items: [{ sku: 'A', qty: 9 }] }, f)).toBe(true);
  });
  it('elemmatch with a nested array sub-condition (decision #8)', () => {
    const f = wrap({
      field: 'users', dataType: 'array', elementType: 'object', operator: 'elemmatch',
      filters: { logic: 'and', filters: [
        { field: 'tags', dataType: 'array', elementType: 'string', operator: 'contains', value: 'x' },
      ] },
    });
    expect(matchQuery({ users: [{ tags: ['x', 'y'] }, { tags: ['z'] }] }, f)).toBe(true);
    expect(matchQuery({ users: [{ tags: ['z'] }] }, f)).toBe(false);
  });
  it('throws on a wildcard field for a collection dataType', () => {
    expect(() =>
      matchQuery({ users: [] }, wrap({ field: 'users[*].tags', dataType: 'array', elementType: 'string', operator: 'contains', value: 'x' })),
    ).toThrow(/wildcard field is not supported/);
  });
});
