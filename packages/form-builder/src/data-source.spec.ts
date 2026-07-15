import { describe, it, expect, vi } from 'vitest';
import { extractValue, loadDataSource, toOptions } from './data-source';
import type { DataSource } from './types';

describe('extractValue', () => {
  it('path dialect resolves nested value', async () => {
    await expect(extractValue('path', 'a.b', { a: { b: 5 } })).resolves.toBe(5);
  });

  it('jsonata dialect evaluates expression', async () => {
    await expect(extractValue('jsonata', 'x', { x: 7 })).resolves.toBe(7);
  });

  it('jsonpath dialect throws not-supported error', async () => {
    await expect(extractValue('jsonpath', '$..a', {})).rejects.toThrow('jsonpath dialect not supported');
  });
});

describe('loadDataSource', () => {
  it('fetches and extracts', async () => {
    const ds: DataSource = {
      request: { url: '/x' },
      extract: { dialect: 'path', expr: 'items' },
    };
    const fetcher = vi.fn().mockResolvedValue({ items: [1, 2] });
    await expect(loadDataSource(ds, fetcher)).resolves.toEqual([1, 2]);
    expect(fetcher).toHaveBeenCalledWith(ds.request);
  });
});

describe('toOptions', () => {
  const baseDs = { request: { url: '/x' }, extract: { dialect: 'path' as const, expr: 'items' } };

  it('maps objects with optionLabel/optionValue', () => {
    const ds: DataSource = { ...baseDs, optionLabel: 'name', optionValue: 'id' };
    expect(toOptions([{ id: 1, name: 'A' }, { id: 2, name: 'B' }], ds)).toEqual([
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
    ]);
  });

  it('maps primitive items without optionLabel/optionValue', () => {
    expect(toOptions(['x', 'y'], baseDs)).toEqual([
      { label: 'x', value: 'x' },
      { label: 'y', value: 'y' },
    ]);
  });

  it('passes through {label,value} objects when no optionLabel/optionValue', () => {
    expect(toOptions([{ label: 'L', value: 'v' }], baseDs)).toEqual([{ label: 'L', value: 'v' }]);
  });

  it('returns [] for non-array input', () => {
    expect(toOptions('nope', baseDs)).toEqual([]);
    expect(toOptions(null, baseDs)).toEqual([]);
    expect(toOptions(42, baseDs)).toEqual([]);
  });
});
