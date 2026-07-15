import { describe, expect, it } from 'vitest';
import { sortRows } from './sort';
import type { TableColumnConfig } from './types';

const numericColumns: TableColumnConfig[] = [{ key: 'price', label: 'Price', dataType: 'numeric' }];
const dateColumns: TableColumnConfig[] = [{ key: 'joined', label: 'Joined', dataType: 'date' }];
const booleanColumns: TableColumnConfig[] = [{ key: 'active', label: 'Active', dataType: 'boolean' }];
const stringColumns: TableColumnConfig[] = [{ key: 'name', label: 'Name', dataType: 'string' }];
const nestedColumns: TableColumnConfig[] = [{ key: 'author.name', label: 'Author', dataType: 'string' }];

describe('sortRows', () => {
  it('sorts numeric values ascending', () => {
    const rows = [{ price: 30 }, { price: 10 }, { price: 20 }];
    const result = sortRows(rows, { key: 'price', direction: 'asc' }, numericColumns);
    expect(result.map((r) => r.price)).toEqual([10, 20, 30]);
  });

  it('sorts numeric values descending', () => {
    const rows = [{ price: 30 }, { price: 10 }, { price: 20 }];
    const result = sortRows(rows, { key: 'price', direction: 'desc' }, numericColumns);
    expect(result.map((r) => r.price)).toEqual([30, 20, 10]);
  });

  it('sorts date values by time', () => {
    const rows = [{ joined: '2024-03-01' }, { joined: '2022-01-01' }, { joined: '2023-06-15' }];
    const result = sortRows(rows, { key: 'joined', direction: 'asc' }, dateColumns);
    expect(result.map((r) => r.joined)).toEqual(['2022-01-01', '2023-06-15', '2024-03-01']);
  });

  it('sorts boolean values with false before true ascending', () => {
    const rows = [{ active: true }, { active: false }, { active: true }, { active: false }];
    const result = sortRows(rows, { key: 'active', direction: 'asc' }, booleanColumns);
    expect(result.map((r) => r.active)).toEqual([false, false, true, true]);
  });

  it('sorts boolean values with true before false descending', () => {
    const rows = [{ active: false }, { active: true }];
    const result = sortRows(rows, { key: 'active', direction: 'desc' }, booleanColumns);
    expect(result.map((r) => r.active)).toEqual([true, false]);
  });

  it('sorts string values using localeCompare', () => {
    const rows = [{ name: 'Charlie' }, { name: 'alice' }, { name: 'Bob' }];
    const result = sortRows(rows, { key: 'name', direction: 'asc' }, stringColumns);
    expect(result.map((r) => r.name)).toEqual(['alice', 'Bob', 'Charlie']);
  });

  it('sinks null/undefined to the bottom regardless of direction (asc)', () => {
    const rows = [{ price: 20 }, { price: null }, { price: 10 }, { price: undefined }];
    const result = sortRows(rows, { key: 'price', direction: 'asc' }, numericColumns);
    expect(result.map((r) => r.price)).toEqual([10, 20, null, undefined]);
  });

  it('sinks null/undefined to the bottom regardless of direction (desc)', () => {
    const rows = [{ price: 20 }, { price: null }, { price: 10 }, { price: undefined }];
    const result = sortRows(rows, { key: 'price', direction: 'desc' }, numericColumns);
    expect(result.map((r) => r.price)).toEqual([20, 10, null, undefined]);
  });

  it('sorts using a nested dot-path key', () => {
    const rows = [{ author: { name: 'Charlie' } }, { author: { name: 'alice' } }, { author: { name: 'Bob' } }];
    const result = sortRows(rows, { key: 'author.name', direction: 'asc' }, nestedColumns);
    expect(result.map((r) => (r.author as { name: string }).name)).toEqual(['alice', 'Bob', 'Charlie']);
  });

  it('is stable: rows with equal sort values keep their original relative order', () => {
    const rows = [
      { name: 'x', id: 1 },
      { name: 'a', id: 2 },
      { name: 'x', id: 3 },
      { name: 'a', id: 4 },
    ];
    const result = sortRows(rows, { key: 'name', direction: 'asc' }, stringColumns);
    expect(result.map((r) => r.id)).toEqual([2, 4, 1, 3]);
  });

  it('does not mutate the input array or its row objects', () => {
    const rows = [{ price: 30 }, { price: 10 }, { price: 20 }];
    const original = [...rows];
    const result = sortRows(rows, { key: 'price', direction: 'asc' }, numericColumns);
    expect(rows).toEqual(original);
    expect(result).not.toBe(rows);
  });
});
