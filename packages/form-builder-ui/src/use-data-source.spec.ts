import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useDataSource } from './use-data-source';
import type { DataSource, DataSourceFetcher } from '@rfjs/form-builder';

const ds: DataSource = {
  request: { url: 'http://example.com/api' },
  extract: { dialect: 'path', expr: 'items' },
  optionLabel: 'name',
  optionValue: 'id',
};

describe('useDataSource', () => {
  it('resolving fetcher → status ready, correct options, value is the list', async () => {
    const fetcher: DataSourceFetcher = vi
      .fn()
      .mockResolvedValue({ items: [{ id: 1, name: 'A' }] });
    const { result } = renderHook(() => useDataSource(ds, fetcher));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.options).toHaveLength(1);
    expect(result.current.options[0]).toEqual({ label: 'A', value: 1 });
    expect(Array.isArray(result.current.value)).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it('rejecting fetcher → status error, error set, options empty', async () => {
    const fetcher: DataSourceFetcher = vi.fn().mockRejectedValue(new Error('fetch failed'));
    const { result } = renderHook(() => useDataSource(ds, fetcher));

    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.error).toBe('Error: fetch failed');
    expect(result.current.options).toEqual([]);
    expect(result.current.value).toBeUndefined();
  });

  it('no fetcher → status idle, no fetch', () => {
    const fetcher = vi.fn();
    const { result } = renderHook(() => useDataSource(ds, undefined));

    expect(result.current.status).toBe('idle');
    expect(result.current.value).toBeUndefined();
    expect(result.current.options).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('no ds → status idle, fetcher never called', () => {
    const fetcher: DataSourceFetcher = vi.fn();
    const { result } = renderHook(() => useDataSource(undefined, fetcher));

    expect(result.current.status).toBe('idle');
    expect(result.current.value).toBeUndefined();
    expect(result.current.options).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
