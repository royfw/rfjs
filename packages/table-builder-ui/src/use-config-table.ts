import { useCallback, useMemo, useState } from 'react';
import { pageCount as computePageCount, sortRows } from '@rfjs/table-builder';
import type { SortState, TableConfig } from '@rfjs/table-builder';
import type { TableSource } from './types';

export interface UseConfigTableResult {
  rows: Record<string, unknown>[];
  total?: number;
  page: number;
  pageCount?: number;
  sort?: SortState;
  toggleSort(key: string): void;
  setPage(page: number): void;
  nextPage(): void;
  prevPage(): void;
  canPrev: boolean;
  canNext: boolean;
  pageSize: number;
  setPageSize(size: number): void;
  loading: boolean;
  error?: string;
  retry(): void;
  strategy: 'client' | 'offset' | 'page' | 'cursor';
}

// Design spec §5.2: this task only implements the static (client) path -- `sortRows` + slice
// pagination. The remote path (buildRequestParams -> source.fetch -> extract*) is a later task.
export function useConfigTable(config: TableConfig, source: TableSource): UseConfigTableResult {
  if (source.kind === 'remote') {
    throw new Error('remote source: implemented in a later task');
  }

  return useClientConfigTable(config, source.rows);
}

function useClientConfigTable(config: TableConfig, rows: Record<string, unknown>[]): UseConfigTableResult {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(config.pagination.pageSize);
  const [sort, setSort] = useState<SortState | undefined>(config.defaultSort);

  const sortedRows = useMemo(() => (sort ? sortRows(rows, sort, config.columns) : rows), [rows, sort, config.columns]);

  const total = sortedRows.length;
  const totalPageCount = computePageCount(total, pageSize);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  const setPage = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 1), totalPageCount);
      setPageState(clamped);
    },
    [totalPageCount],
  );

  const nextPage = useCallback(() => setPage(page + 1), [page, setPage]);
  const prevPage = useCallback(() => setPage(page - 1), [page, setPage]);

  const toggleSort = useCallback((key: string) => {
    setSort((current) => (current?.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }));
    setPageState(1);
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPageState(1);
  }, []);

  const retry = useCallback(() => {
    // no-op: the client path never enters an error state
  }, []);

  return {
    rows: pageRows,
    total,
    page,
    pageCount: totalPageCount,
    sort,
    toggleSort,
    setPage,
    nextPage,
    prevPage,
    canPrev: page > 1,
    canNext: page < totalPageCount,
    pageSize,
    setPageSize,
    loading: false,
    error: undefined,
    retry,
    strategy: 'client',
  };
}
