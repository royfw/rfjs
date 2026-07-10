import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TableConfig } from '@rfjs/table-builder';
import type { BuiltRequest, RequestMeta, ResponseMeta } from '@rfjs/data-schema';
import { emptyGroup } from '@rfjs/filter-builder';
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
});

// --- remote mode -----------------------------------------------------------------------------

const allRows = makeRows();

const offsetRequest: RequestMeta = {
  endpoint: '/rows',
  pagination: { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
  sort: { style: 'split', fieldParam: 'sortBy', dirParam: 'order' },
};
const offsetResponse: ResponseMeta = { rowsPath: 'items', totalPath: 'total' };

const pageRequest: RequestMeta = {
  endpoint: '/rows',
  pagination: { strategy: 'page', pageParam: 'page', pageSizeParam: 'pageSize', firstPage: 0 },
};
const pageResponse: ResponseMeta = { rowsPath: 'items', totalPath: 'total' };

const cursorRequest: RequestMeta = {
  endpoint: '/rows',
  pagination: { strategy: 'cursor', cursorParam: 'cursor', limitParam: 'limit' },
};
const cursorResponse: ResponseMeta = { rowsPath: 'items', cursorPath: 'nextCursor' };

function remoteSource(
  fetchFn: (built: BuiltRequest) => Promise<unknown>,
  request: RequestMeta = offsetRequest,
  response: ResponseMeta = offsetResponse,
): TableSource {
  return { kind: 'remote', request, response, fetch: fetchFn };
}

describe('useConfigTable (remote mode -- offset strategy)', () => {
  it('fetches page 1 with limit/offset params and derives pageCount from total', async () => {
    const fetch = vi.fn(async (built: BuiltRequest) => {
      const offset = Number(built.params.offset);
      const limit = Number(built.params.limit);
      return { items: allRows.slice(offset, offset + limit), total: allRows.length };
    });
    const src = remoteSource(fetch);
    const { result } = renderHook(() => useConfigTable(baseConfig, src));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetch).toHaveBeenCalledWith({ endpoint: '/rows', method: 'GET', params: { limit: '10', offset: '0' } });
    expect(result.current.rows).toHaveLength(10);
    expect(result.current.rows[0]).toMatchObject({ id: 1 });
    expect(result.current.total).toBe(25);
    expect(result.current.pageCount).toBe(3);
    expect(result.current.canPrev).toBe(false);
    expect(result.current.canNext).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it('advances to the next page using offset:10', async () => {
    const fetch = vi.fn(async (built: BuiltRequest) => {
      const offset = Number(built.params.offset);
      const limit = Number(built.params.limit);
      return { items: allRows.slice(offset, offset + limit), total: allRows.length };
    });
    const src = remoteSource(fetch);
    const { result } = renderHook(() => useConfigTable(baseConfig, src));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetch).toHaveBeenLastCalledWith({ endpoint: '/rows', method: 'GET', params: { limit: '10', offset: '10' } });
    expect(result.current.page).toBe(2);
    expect(result.current.rows[0]).toMatchObject({ id: 11 });
    expect(result.current.canPrev).toBe(true);
    expect(result.current.canNext).toBe(true);
  });

  it('sort change resets to page 1 and refetches with sort params', async () => {
    const fetch = vi.fn(async (built: BuiltRequest) => {
      const offset = Number(built.params.offset);
      const limit = Number(built.params.limit);
      return { items: allRows.slice(offset, offset + limit), total: allRows.length };
    });
    const src = remoteSource(fetch);
    const { result } = renderHook(() => useConfigTable(baseConfig, src));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleSort('age'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.page).toBe(1);
    expect(fetch).toHaveBeenLastCalledWith({
      endpoint: '/rows',
      method: 'GET',
      params: { limit: '10', offset: '0', sortBy: 'age', order: 'asc' },
    });
  });

  it('reject sets error and keeps the previous rows; retry() re-fetches and clears the error', async () => {
    const fetch = vi.fn();
    fetch.mockResolvedValueOnce({ items: allRows.slice(0, 10), total: 25 });
    fetch.mockRejectedValueOnce(new Error('network down'));
    fetch.mockResolvedValueOnce({ items: allRows.slice(10, 20), total: 25 });

    const src = remoteSource(fetch);
    const { result } = renderHook(() => useConfigTable(baseConfig, src));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const firstPageRows = result.current.rows;

    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('network down');
    expect(result.current.rows).toEqual(firstPageRows);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeUndefined();
    expect(result.current.rows[0]).toMatchObject({ id: 11 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('rapid double toggleSort: only the last request result applies', async () => {
    let resolveA: (v: unknown) => void = () => {};
    let resolveB: (v: unknown) => void = () => {};
    const fetch = vi.fn();
    fetch.mockResolvedValueOnce({ items: allRows.slice(0, 10), total: 25 });
    fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveA = resolve;
        }),
    );
    fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveB = resolve;
        }),
    );

    const src = remoteSource(fetch);
    const { result } = renderHook(() => useConfigTable(baseConfig, src));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleSort('age')); // sort -> asc, triggers fetch #2 (pending)
    expect(result.current.loading).toBe(true);

    act(() => result.current.toggleSort('age')); // sort -> desc, triggers fetch #3 (pending), cancels #2
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveA({ items: [{ id: -1, name: 'STALE', age: -1 }], total: 1 });
      await Promise.resolve();
    });
    // stale response from the superseded (cancelled) request must not apply
    expect(result.current.rows).not.toEqual([{ id: -1, name: 'STALE', age: -1 }]);

    await act(async () => {
      resolveB({ items: [{ id: -2, name: 'FINAL', age: -2 }], total: 2 });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rows).toEqual([{ id: -2, name: 'FINAL', age: -2 }]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenLastCalledWith({
      endpoint: '/rows',
      method: 'GET',
      params: { limit: '10', offset: '0', sortBy: 'age', order: 'desc' },
    });
  });
});

describe('useConfigTable (remote mode -- page strategy)', () => {
  it('maps UI page 1 to API page 0 when firstPage is 0, and UI page 2 to API page 1', async () => {
    const fetch = vi.fn(async (built: BuiltRequest) => {
      const apiPage = Number(built.params.page);
      const size = Number(built.params.pageSize);
      return { items: allRows.slice(apiPage * size, apiPage * size + size), total: allRows.length };
    });
    const src = remoteSource(fetch, pageRequest, pageResponse);
    const { result } = renderHook(() => useConfigTable(baseConfig, src));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenLastCalledWith({ endpoint: '/rows', method: 'GET', params: { page: '0', pageSize: '10' } });
    expect(result.current.rows[0]).toMatchObject({ id: 1 });

    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenLastCalledWith({ endpoint: '/rows', method: 'GET', params: { page: '1', pageSize: '10' } });
    expect(result.current.rows[0]).toMatchObject({ id: 11 });
  });
});

describe('useConfigTable (remote mode -- cursor strategy)', () => {
  function cursorFetch() {
    return vi.fn(async (built: BuiltRequest) => {
      const limit = Number(built.params.limit);
      const cursor = built.params.cursor;
      const start = cursor === undefined ? 0 : Number(cursor);
      const slice = allRows.slice(start, start + limit);
      const nextStart = start + limit;
      const hasMore = nextStart < allRows.length;
      return { items: slice, nextCursor: hasMore ? String(nextStart) : undefined };
    });
  }

  it('first page sends no cursor param; response cursor drives canNext true', async () => {
    const fetch = cursorFetch();
    const src = remoteSource(fetch, cursorRequest, cursorResponse);
    const { result } = renderHook(() => useConfigTable(baseConfig, src));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetch).toHaveBeenCalledWith({ endpoint: '/rows', method: 'GET', params: { limit: '10' } });
    expect(result.current.rows[0]).toMatchObject({ id: 1 });
    expect(result.current.canNext).toBe(true);
    expect(result.current.canPrev).toBe(false);
    expect(result.current.total).toBeUndefined();
    expect(result.current.pageCount).toBeUndefined();
  });

  it('next sends the stored cursor param; prev returns to the previous page without re-requesting a cursor', async () => {
    const fetch = cursorFetch();
    const src = remoteSource(fetch, cursorRequest, cursorResponse);
    const { result } = renderHook(() => useConfigTable(baseConfig, src));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenLastCalledWith({ endpoint: '/rows', method: 'GET', params: { limit: '10', cursor: '10' } });
    expect(result.current.page).toBe(2);
    expect(result.current.rows[0]).toMatchObject({ id: 11 });
    expect(result.current.canNext).toBe(true);

    act(() => result.current.prevPage());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // back to page 1 -- the stack already knows this page needs no cursor param, so the same
    // shape as the very first fetch is sent (not a fresh cursor negotiation)
    expect(fetch).toHaveBeenLastCalledWith({ endpoint: '/rows', method: 'GET', params: { limit: '10' } });
    expect(result.current.page).toBe(1);
    expect(result.current.rows[0]).toMatchObject({ id: 1 });
    expect(result.current.canNext).toBe(true);
  });

  it('setPage is a no-op for cursor strategy', async () => {
    const fetch = cursorFetch();
    const src = remoteSource(fetch, cursorRequest, cursorResponse);
    const { result } = renderHook(() => useConfigTable(baseConfig, src));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setPage(3));

    expect(result.current.page).toBe(1);
  });

  it('the last page (no cursor in the response) has canNext false', async () => {
    const fetch = cursorFetch();
    const src = remoteSource(fetch, cursorRequest, cursorResponse);
    const { result } = renderHook(() => useConfigTable(baseConfig, src));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 25 rows, pageSize 10 -> pages of 10, 10, 5; the 3rd page's response has no next cursor
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.page).toBe(3));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rows).toHaveLength(5);
    expect(result.current.canNext).toBe(false);

    act(() => result.current.nextPage()); // guarded no-op: canNext is already false
    expect(result.current.page).toBe(3);
  });
});

// --- static in-memory filtering ---------------------------------------------------------------

const FILTER_ROWS = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, price: (i + 1) * 10 }));
const FILTER_CONFIG: TableConfig = {
  columns: [
    { key: 'id', label: 'ID', dataType: 'numeric', filterable: true },
    { key: 'price', label: 'Price', dataType: 'numeric', filterable: true },
  ],
  pagination: { pageSize: 5 },
};

function priceGteTree(v: number) {
  // 一棵 AND group,單一 condition price >= v(用 emptyGroup 起手,填一條 condition)。
  const g = emptyGroup(() => Math.random().toString(36).slice(2));
  return {
    ...g,
    children: [
      { kind: 'condition' as const, id: 'c1', field: 'price', dataType: 'numeric' as const, operator: 'gte', value: v },
    ],
  };
}

describe('useConfigTable static filtering', () => {
  it('exposes filterSchema from filterable columns and filterEnabled for rows source', () => {
    const { result } = renderHook(() => useConfigTable(FILTER_CONFIG, { kind: 'rows', rows: FILTER_ROWS }));
    expect(result.current.filterSchema.map((s) => s.path)).toEqual(['id', 'price']);
    expect(result.current.filterEnabled).toBe(true);
  });

  it('empty filter tree shows all rows', () => {
    const { result } = renderHook(() => useConfigTable(FILTER_CONFIG, { kind: 'rows', rows: FILTER_ROWS }));
    expect(result.current.total).toBe(8);
  });

  it('setFilterTree filters rows, updates total, resets to page 1', () => {
    const { result } = renderHook(() => useConfigTable(FILTER_CONFIG, { kind: 'rows', rows: FILTER_ROWS }));
    act(() => result.current.nextPage()); // go to page 2 first
    expect(result.current.page).toBe(2);
    act(() => result.current.setFilterTree(priceGteTree(50))); // price >= 50 -> ids 5..8 (4 rows)
    expect(result.current.total).toBe(4);
    expect(result.current.page).toBe(1);
    expect(result.current.rows.map((r) => r.id)).toEqual([5, 6, 7, 8]);
  });

  it('remote source disables filtering', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
    // source is hoisted to a stable reference (not an inline literal in the renderHook callback):
    // the remote fetch effect depends on `source` by identity, and a fresh literal on every render
    // would make the effect re-fire every render (setRemote -> re-render -> new literal -> re-fire...).
    const remoteFilterSource: TableSource = {
      kind: 'remote',
      request: { endpoint: '/x', pagination: { strategy: 'offset', limitParam: 'l', offsetParam: 'o' } },
      response: { rowsPath: 'data.items', totalPath: 'data.total' },
      fetch: fetchFn,
    };
    const { result } = renderHook(() => useConfigTable(FILTER_CONFIG, remoteFilterSource));
    expect(result.current.filterEnabled).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});

// --- remote filtering (apply semantics) -------------------------------------------------------

describe('remote filtering (apply semantics)', () => {
  const FILTER_FIELDS = [
    { key: 'price', label: 'Price', dataType: 'numeric' as const, filterable: true, kind: 'column' as const },
  ];
  const FILTER_REQUEST: RequestMeta = {
    endpoint: '/api/items',
    pagination: { strategy: 'page' as const, pageParam: 'page', pageSizeParam: 'pageSize' },
    filter: { style: 'pg' as const, param: 'filter' },
  };
  const RESPONSE: ResponseMeta = { rowsPath: 'data.items', totalPath: 'data.total' };

  function makeSource(fetchImpl: (built: unknown) => Promise<unknown>): TableSource {
    return {
      kind: 'remote' as const,
      request: FILTER_REQUEST,
      response: RESPONSE,
      fields: FILTER_FIELDS,
      fetch: fetchImpl as never,
    };
  }

  function treeWith(field: string, operator: string, value: unknown) {
    const group = emptyGroup(() => 'id-' + Math.random());
    return {
      ...group,
      children: [{ kind: 'condition' as const, id: 'c1', field, dataType: 'numeric' as const, operator, value }],
    };
  }

  it('enables filtering for a remote source that declares filter meta and filterable fields', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
    const source = makeSource(fetchFn);
    const { result } = renderHook(() => useConfigTable(baseConfig, source));
    expect(result.current.filterEnabled).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('keeps filtering disabled when the request declares no filter meta', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
    const source = { ...makeSource(fetchFn), request: { ...FILTER_REQUEST, filter: undefined } };
    const { result } = renderHook(() => useConfigTable(baseConfig, source));
    expect(result.current.filterEnabled).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('applyFilter compiles the tree, resets to page 1, and refetches with built.filter', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [{ id: 1 }], total: 30 } });
    const source = makeSource(fetchFn);
    const { result } = renderHook(() => useConfigTable(baseConfig, source));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFilterTree(treeWith('price', 'gte', 40)));
    act(() => result.current.applyFilter());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.page).toBe(1);
    expect(result.current.filterApplied).toBe(true);
    const lastBuilt = fetchFn.mock.calls.at(-1)![0] as { filter?: unknown; params: Record<string, string> };
    expect(lastBuilt.filter).toEqual({
      logic: 'and',
      filters: [{ target: 'column', column: 'price', operator: 'gte', value: 40 }],
    });
    expect(lastBuilt.params.page).toBe('1');
  });

  it('page navigation after apply keeps sending the applied filter', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [{ id: 1 }], total: 30 } });
    const source = makeSource(fetchFn);
    const { result } = renderHook(() => useConfigTable(baseConfig, source));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFilterTree(treeWith('price', 'gte', 40)));
    act(() => result.current.applyFilter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const lastBuilt = fetchFn.mock.calls.at(-1)![0] as { filter?: unknown };
    expect(lastBuilt.filter).toBeDefined();
  });

  it('applying an empty tree clears the filter (built carries none)', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
    const source = makeSource(fetchFn);
    const { result } = renderHook(() => useConfigTable(baseConfig, source));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFilterTree(treeWith('price', 'gte', 40)));
    act(() => result.current.applyFilter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setFilterTree(emptyGroup(() => 'e1')));
    act(() => result.current.applyFilter());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.filterApplied).toBe(false);
    const lastBuilt = fetchFn.mock.calls.at(-1)![0] as { filter?: unknown };
    expect(lastBuilt.filter).toBeUndefined();
  });

  it('editing the tree in remote mode does not refetch by itself', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
    const source = makeSource(fetchFn);
    const { result } = renderHook(() => useConfigTable(baseConfig, source));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const callsBefore = fetchFn.mock.calls.length;

    act(() => result.current.setFilterTree(treeWith('price', 'gte', 40)));

    expect(fetchFn.mock.calls.length).toBe(callsBefore);
  });
});

describe('controlled filter tree', () => {
  it('uses the external tree and reports edits through onFilterTreeChange', () => {
    const external = emptyGroup(() => 'x1');
    const onChange = vi.fn();
    const source: TableSource = { kind: 'rows' as const, rows: makeRows() };
    const { result } = renderHook(() =>
      useConfigTable(baseConfig, source, { filterTree: external, onFilterTreeChange: onChange }),
    );

    expect(result.current.filterTree).toBe(external);
    const edited = { ...external, logic: 'or' as const };
    act(() => result.current.setFilterTree(edited));
    expect(onChange).toHaveBeenCalledWith(edited);
    // external 未更新前,hook 仍回報外部樹(受控)
    expect(result.current.filterTree).toBe(external);
  });
});
