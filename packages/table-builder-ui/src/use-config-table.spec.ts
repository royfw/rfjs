import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TableConfig } from '@rfjs/table-builder';
import { useConfigTable } from './use-config-table';
import type { TableSource } from './types';

const ROW_COUNT = 25;

// ages are unique and descending (25..1) so ascending/descending sort is easy to assert
function makeRows(): Record<string, unknown>[] {
  return Array.from({ length: ROW_COUNT }, (_, i) => ({
    id: i + 1,
    name: `Row ${i + 1}`,
    age: ROW_COUNT - i,
  }));
}

const baseConfig: TableConfig = {
  columns: [
    { key: 'id', label: 'ID', dataType: 'numeric' },
    { key: 'name', label: 'Name', dataType: 'string' },
    { key: 'age', label: 'Age', dataType: 'numeric', sortable: true, visible: false },
  ],
  pagination: { pageSize: 10 },
};

function makeSource(): TableSource {
  return { kind: 'rows', rows: makeRows() };
}

describe('useConfigTable (client mode)', () => {
  it('returns the first page slice, total, and pageCount on mount', () => {
    const { result } = renderHook(() => useConfigTable(baseConfig, makeSource()));

    expect(result.current.strategy).toBe('client');
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.rows).toHaveLength(10);
    expect(result.current.rows[0]).toMatchObject({ id: 1 });
    // hidden columns are still present on the raw row -- visibility is a render-layer concern
    expect(result.current.rows[0]).toHaveProperty('age');
    expect(result.current.total).toBe(25);
    expect(result.current.pageCount).toBe(3);
    expect(result.current.canPrev).toBe(false);
    expect(result.current.canNext).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('advances to the next page', () => {
    const { result } = renderHook(() => useConfigTable(baseConfig, makeSource()));

    act(() => result.current.nextPage());

    expect(result.current.page).toBe(2);
    expect(result.current.rows).toHaveLength(10);
    expect(result.current.rows[0]).toMatchObject({ id: 11 });
    expect(result.current.canPrev).toBe(true);
    expect(result.current.canNext).toBe(true);
  });

  it('does not advance past the last page', () => {
    const { result } = renderHook(() => useConfigTable(baseConfig, makeSource()));

    act(() => result.current.nextPage());
    act(() => result.current.nextPage());
    act(() => result.current.nextPage());

    expect(result.current.page).toBe(3);
    expect(result.current.rows).toHaveLength(5);
    expect(result.current.canNext).toBe(false);
  });

  it('does not retreat before the first page', () => {
    const { result } = renderHook(() => useConfigTable(baseConfig, makeSource()));

    act(() => result.current.prevPage());

    expect(result.current.page).toBe(1);
    expect(result.current.canPrev).toBe(false);
  });

  it('toggleSort sorts rows and resets to the first page, then flips direction on repeat', () => {
    const { result } = renderHook(() => useConfigTable(baseConfig, makeSource()));

    act(() => result.current.nextPage());
    expect(result.current.page).toBe(2);

    act(() => result.current.toggleSort('age'));

    expect(result.current.sort).toEqual({ key: 'age', direction: 'asc' });
    expect(result.current.page).toBe(1);
    expect(result.current.rows[0]).toMatchObject({ age: 1 });
    expect(result.current.rows[9]).toMatchObject({ age: 10 });

    act(() => result.current.toggleSort('age'));

    expect(result.current.sort).toEqual({ key: 'age', direction: 'desc' });
    expect(result.current.page).toBe(1);
    expect(result.current.rows[0]).toMatchObject({ age: 25 });
  });

  it('toggleSort on a new key resets direction to ascending', () => {
    const { result } = renderHook(() => useConfigTable(baseConfig, makeSource()));

    act(() => result.current.toggleSort('age')); // asc
    act(() => result.current.toggleSort('age')); // desc
    act(() => result.current.toggleSort('id')); // switch key -> back to asc

    expect(result.current.sort).toEqual({ key: 'id', direction: 'asc' });
    expect(result.current.rows[0]).toMatchObject({ id: 1 });
  });

  it('setPageSize resets to the first page and recomputes pageCount', () => {
    const { result } = renderHook(() => useConfigTable(baseConfig, makeSource()));

    act(() => result.current.nextPage());
    expect(result.current.page).toBe(2);

    act(() => result.current.setPageSize(5));

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(5);
    expect(result.current.pageCount).toBe(5);
    expect(result.current.rows).toHaveLength(5);
  });

  it('uses config.defaultSort as the initial sort state', () => {
    const config: TableConfig = { ...baseConfig, defaultSort: { key: 'age', direction: 'asc' } };
    const { result } = renderHook(() => useConfigTable(config, makeSource()));

    expect(result.current.sort).toEqual({ key: 'age', direction: 'asc' });
    expect(result.current.rows[0]).toMatchObject({ age: 1 });
  });

  it('throws a not-implemented placeholder for a remote source', () => {
    const remoteSource: TableSource = {
      kind: 'remote',
      request: { endpoint: '/x', pagination: { strategy: 'page', pageParam: 'page', pageSizeParam: 'pageSize' } },
      response: { rowsPath: 'rows' },
      fetch: async () => ({ rows: [] }),
    };

    expect(() => renderHook(() => useConfigTable(baseConfig, remoteSource))).toThrow(/remote source/);
  });
});
