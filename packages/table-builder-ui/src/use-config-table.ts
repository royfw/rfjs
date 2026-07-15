import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hasNextCursor, pageCount as computePageCount, pageToOffset, sortRows } from '@rfjs/table-builder';
import type { SortState, TableConfig } from '@rfjs/table-builder';
import { buildRequestParams, extractCursor, extractRows, extractTotal } from '@rfjs/data-schema';
import type { PageState } from '@rfjs/data-schema';
import { runLiveMatch, emptyGroup, treeToPgFilterGroup, type BuilderGroup, type FieldSchema } from '@rfjs/filter-builder';
import type { PgFilterGroup } from '@rfjs/pg-filter';
import { columnsToFilterSchema, fieldsToFilterSchema } from './filter-schema';
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
  filterTree: BuilderGroup;
  setFilterTree(next: BuilderGroup): void;
  filterSchema: FieldSchema[];
  filterEnabled: boolean;
  filterUncoverable: boolean;
  /** remote 模式:把當前樹編譯成 pg 群組並重抓(重置分頁);rows 模式 no-op。 */
  applyFilter(): void;
  /** remote 模式:目前是否有已套用(非空)的 filter。 */
  filterApplied: boolean;
}

export interface UseConfigTableOptions {
  /** 受控篩選樹:提供時 hook 不持有樹狀態,編輯經 onFilterTreeChange 回報。 */
  filterTree?: BuilderGroup;
  onFilterTreeChange?: (next: BuilderGroup) => void;
}

const EMPTY_ROWS: Record<string, unknown>[] = [];

interface RemoteState {
  rows: Record<string, unknown>[];
  total?: number;
  loading: boolean;
  error?: string;
  nextCursor?: string;
}

// Design spec §5.2: ONE implementation for both source kinds, so the hook call sequence
// (useState x7, useRef, useMemo x4, useEffect, useCallback x8) is identical every render --
// even if a consumer toggles `source.kind` between 'rows' and 'remote'. All source-kind
// branching happens INSIDE this body (plain values/conditionals, effect/callback bodies),
// never as an early return from the hook itself -- see Task 5 review for why that broke
// the rules of hooks.
export function useConfigTable(
  config: TableConfig,
  source: TableSource,
  options: UseConfigTableOptions = {},
): UseConfigTableResult {
  const sourceKind = source.kind;
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(config.pagination.pageSize);
  const [sort, setSort] = useState<SortState | undefined>(config.defaultSort);
  const [remote, setRemote] = useState<RemoteState>(() => ({
    rows: EMPTY_ROWS,
    total: undefined,
    loading: source.kind === 'remote',
    error: undefined,
    nextCursor: undefined,
  }));
  const [retryToken, setRetryToken] = useState(0);
  const [internalTree, setInternalTree] = useState<BuilderGroup>(() => emptyGroup(() => crypto.randomUUID()));
  // appliedFilter must live here (top state block, before the remote fetch effect) -- the
  // effect's deps array reads it, and declaring it after setFilterTree would TDZ every test.
  const [appliedFilter, setAppliedFilter] = useState<PgFilterGroup | undefined>(undefined);
  const externalTree = options.filterTree;
  const filterTree = externalTree ?? internalTree;
  const onFilterTreeChange = options.onFilterTreeChange;

  // Cursor-mode navigation stack (client-side, not React state): cursorsRef.current[uiPage - 1]
  // is the `cursor` request param needed to fetch that UI page -- index 0 (the first page) is
  // always undefined (no cursor param). Kept in a ref so extending it never re-triggers the
  // fetch effect below; only page/pageSize/sort/retryToken/source changes should do that.
  const cursorsRef = useRef<(string | undefined)[]>([undefined]);

  // --- client (static rows) derivation -- always computed, only used when source.kind === 'rows' ---
  const clientRows = source.kind === 'rows' ? source.rows : EMPTY_ROWS;
  const filterSchema = useMemo(
    () => (source.kind === 'remote' ? fieldsToFilterSchema(source.fields ?? []) : columnsToFilterSchema(config.columns)),
    [source, config.columns],
  );
  const remoteFilterEnabled =
    source.kind === 'remote' && source.request.filter !== undefined && filterSchema.length > 0;
  const match = useMemo(() => runLiveMatch(clientRows, filterTree), [clientRows, filterTree]);
  // uncoverable (an operator the in-memory engine can't evaluate): don't misreport 0 rows --
  // show all rows and let the UI surface a warning via filterUncoverable.
  const filteredRows =
    source.kind === 'rows' && !match.uncoverable ? (match.matched as Record<string, unknown>[]) : clientRows;
  const sortedRows = useMemo(
    () => (sort ? sortRows(filteredRows, sort, config.columns) : filteredRows),
    [filteredRows, sort, config.columns],
  );
  const clientPageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  // --- remote fetch effect -- always registered; no-ops for source.kind === 'rows' ---
  useEffect(() => {
    if (source.kind !== 'remote') return;
    const { request, response, fetch: fetchFn } = source;
    const strategy = request.pagination.strategy;

    // Active-flag race guard (same convention as form-builder-ui's use-data-source): a later
    // effect run's cleanup flips this false before the new run starts, so a stale in-flight
    // fetch's resolution/rejection is silently dropped instead of clobbering fresher state.
    let active = true;
    setRemote((prev) => ({ ...prev, loading: true, error: undefined }));

    const pageState: PageState = { pageSize, sort };
    if (strategy === 'offset') {
      pageState.offset = pageToOffset(page, pageSize);
    } else if (strategy === 'page') {
      const firstPage = request.pagination.firstPage ?? 1;
      pageState.page = page - 1 + firstPage; // UI page is always 1-based -> translate via firstPage
    } else {
      pageState.cursor = cursorsRef.current[page - 1];
    }

    const built = buildRequestParams(request, pageState, appliedFilter);

    fetchFn(built)
      .then((payload) => {
        if (!active) return;
        // extractRows only guarantees an array; table rows are always plain objects (dot-path
        // access into anything else would already have thrown upstream in extractRows).
        const rows = extractRows(payload, response) as Record<string, unknown>[];
        const total = extractTotal(payload, response);
        const cursor = extractCursor(payload, response);
        // Only push a new stack entry the first time this page is reached (the "frontier");
        // revisiting a known page (e.g. via prevPage) reuses the previously recorded cursor
        // param instead of re-deriving it from this response.
        if (strategy === 'cursor' && page === cursorsRef.current.length) {
          cursorsRef.current = [...cursorsRef.current, cursor];
        }
        setRemote({ rows, total, loading: false, error: undefined, nextCursor: cursor });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setRemote((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      });

    return () => {
      active = false;
    };
  }, [source, page, pageSize, sort, retryToken, appliedFilter]);

  const clientTotal = sortedRows.length;
  const clientPageCount = computePageCount(clientTotal, pageSize);
  const remotePageCount =
    source.kind === 'remote' && remote.total !== undefined ? computePageCount(remote.total, pageSize) : undefined;
  const isCursorRemote = source.kind === 'remote' && source.request.pagination.strategy === 'cursor';

  const rows = source.kind === 'rows' ? clientPageRows : remote.rows;
  const total = source.kind === 'rows' ? clientTotal : isCursorRemote ? undefined : remote.total;
  const pageCountValue = source.kind === 'rows' ? clientPageCount : isCursorRemote ? undefined : remotePageCount;
  const loading = source.kind === 'rows' ? false : remote.loading;
  const error = source.kind === 'rows' ? undefined : remote.error;

  const canPrev = page > 1;
  const canNext =
    source.kind === 'rows'
      ? page < clientPageCount
      : isCursorRemote
        ? hasNextCursor(remote.nextCursor)
        : pageCountValue !== undefined
          ? page < pageCountValue
          : // no total available: fall back to a "was this a full page" heuristic
            remote.rows.length > 0 && remote.rows.length === pageSize;

  const setPage = useCallback(
    (next: number) => {
      if (isCursorRemote) return; // cursor strategy: no arbitrary jump (design spec §5.2)
      setPageState(pageCountValue !== undefined ? Math.min(Math.max(next, 1), pageCountValue) : Math.max(next, 1));
    },
    [isCursorRemote, pageCountValue],
  );

  const nextPage = useCallback(() => {
    if (!canNext) return;
    if (isCursorRemote) {
      setPageState((p) => p + 1);
    } else {
      setPage(page + 1);
    }
  }, [canNext, isCursorRemote, page, setPage]);

  const prevPage = useCallback(() => {
    if (!canPrev) return;
    if (isCursorRemote) {
      setPageState((p) => p - 1);
    } else {
      setPage(page - 1);
    }
  }, [canPrev, isCursorRemote, page, setPage]);

  const toggleSort = useCallback((key: string) => {
    setSort((current) =>
      current?.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' },
    );
    setPageState(1);
    cursorsRef.current = [undefined]; // sort changes invalidate any previously known cursors
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPageState(1);
    cursorsRef.current = [undefined]; // page-size changes invalidate any previously known cursors
  }, []);

  const retry = useCallback(() => {
    setRetryToken((t) => t + 1);
  }, []);

  const setFilterTree = useCallback(
    (next: BuilderGroup) => {
      onFilterTreeChange?.(next);
      if (externalTree === undefined) setInternalTree(next);
      // rows 模式:編輯即生效,回第 1 頁;remote 模式:編輯不打 API(Apply 才生效),分頁不動
      if (sourceKind === 'rows') setPageState(1);
    },
    [onFilterTreeChange, externalTree, sourceKind],
  );

  const applyFilter = useCallback(() => {
    if (!remoteFilterEnabled) return;
    const group = treeToPgFilterGroup(filterTree, filterSchema);
    setAppliedFilter(hasConditions(group) ? group : undefined);
    setPageState(1);
    cursorsRef.current = [undefined]; // 篩選變了,舊游標無意義(spec §2.2)
  }, [remoteFilterEnabled, filterTree, filterSchema]);

  return {
    rows,
    total,
    page,
    pageCount: pageCountValue,
    sort,
    toggleSort,
    setPage,
    nextPage,
    prevPage,
    canPrev,
    canNext,
    pageSize,
    setPageSize,
    loading,
    error,
    retry,
    strategy: source.kind === 'rows' ? 'client' : source.request.pagination.strategy,
    filterTree,
    setFilterTree,
    filterSchema,
    filterEnabled: source.kind === 'rows' || remoteFilterEnabled,
    filterUncoverable: source.kind === 'rows' && match.uncoverable,
    applyFilter,
    filterApplied: appliedFilter !== undefined,
  };
}

/** 空樹/全不完整條件會編譯成無葉群組 —— 這種 filter 不該上請求(spec §2.2「空樹」)。 */
function hasConditions(group: PgFilterGroup): boolean {
  return group.filters.some((f) => ('logic' in f ? hasConditions(f as PgFilterGroup) : true));
}
