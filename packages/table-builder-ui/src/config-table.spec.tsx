import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TableConfig, TableColumnConfig } from '@rfjs/table-builder';
import type { BuiltRequest, RequestMeta, ResponseMeta } from '@rfjs/data-schema';
import { emptyGroup } from '@rfjs/filter-builder';
import { ConfigTable } from './config-table';
import type { TableSource } from './types';

const ROW_COUNT = 25;

function makeRows(): Record<string, unknown>[] {
  // id ascending 1..25, age descending 25..1 -- easy to assert both natural order and sort order
  return Array.from({ length: ROW_COUNT }, (_, i) => ({
    id: i + 1,
    name: `Row ${i + 1}`,
    age: ROW_COUNT - i,
    secret: 'hidden',
  }));
}

const columns: TableColumnConfig[] = [
  { key: 'id', label: 'ID', dataType: 'numeric', pin: 'left' },
  { key: 'name', label: 'Name', dataType: 'string' },
  { key: 'age', label: 'Age', dataType: 'numeric', sortable: true },
  { key: 'secret', label: 'Secret', dataType: 'string', visible: false },
];

const config: TableConfig = {
  columns,
  pagination: { pageSize: 10 },
};

function rowsSource(): TableSource {
  return { kind: 'rows', rows: makeRows() };
}

describe('ConfigTable (static rows)', () => {
  it('renders one row per pageSize', () => {
    const { container } = render(<ConfigTable config={config} source={rowsSource()} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(10);
  });

  it('does not render a visible:false column', () => {
    const { container } = render(<ConfigTable config={config} source={rowsSource()} />);
    expect(screen.queryByText('Secret')).toBeNull();
    expect(container.querySelectorAll('thead th')).toHaveLength(3);
  });

  it('clicking a sortable header changes the first row and shows a sort arrow icon', () => {
    const { container } = render(<ConfigTable config={config} source={rowsSource()} />);
    const ageHeader = screen.getByText('Age').closest('th')!;
    expect(ageHeader.querySelector('svg')).toBeNull();

    fireEvent.click(screen.getByText('Age'));

    expect(ageHeader.querySelector('svg')).not.toBeNull();
    const firstRow = container.querySelectorAll<HTMLTableRowElement>('tbody tr')[0]!;
    expect(within(firstRow).getByText('1')).toBeDefined(); // age ascending -> age=1 first
  });

  it('renders pagination text and advances to page 2 on next', () => {
    const { container } = render(<ConfigTable config={config} source={rowsSource()} />);

    expect(screen.getByText('Page 1 of 3')).toBeDefined();
    expect(screen.getByText('25 rows')).toBeDefined();

    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText('Page 2 of 3')).toBeDefined();
    const firstRow = container.querySelectorAll<HTMLTableRowElement>('tbody tr')[0]!;
    expect(within(firstRow).getByText('11')).toBeDefined();
  });

  it('pin-left column cells carry a sticky class', () => {
    const { container } = render(<ConfigTable config={config} source={rowsSource()} />);
    const idHeader = screen.getByText('ID').closest('th')!;
    expect(idHeader.className).toContain('sticky');
    const idCell = container.querySelector('tbody tr td')!;
    expect(idCell.className).toContain('sticky');
  });

  it('numeric column cells default to text-right alignment', () => {
    const { container } = render(<ConfigTable config={config} source={rowsSource()} />);
    const ageHeader = screen.getByText('Age').closest('th')!;
    const ageIndex = Array.from(ageHeader.parentElement!.children).indexOf(ageHeader);
    const firstRow = container.querySelectorAll('tbody tr')[0]!;
    const ageCell = firstRow.children[ageIndex]!;
    expect(ageCell.className).toContain('text-right');
  });

  it('shows the default emptyText when there are no rows', () => {
    render(<ConfigTable config={config} source={{ kind: 'rows', rows: [] }} />);
    expect(screen.getByText('No data')).toBeDefined();
  });

  it('applies label overrides', () => {
    render(<ConfigTable config={config} source={{ kind: 'rows', rows: [] }} labels={{ empty: '沒有資料' }} />);
    expect(screen.getByText('沒有資料')).toBeDefined();
    expect(screen.queryByText('No data')).toBeNull();
  });
});

// --- remote mode -----------------------------------------------------------------------------

const allRows = makeRows();

const offsetRequest: RequestMeta = {
  endpoint: '/rows',
  pagination: { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
};
const offsetResponse: ResponseMeta = { rowsPath: 'items', totalPath: 'total' };

describe('ConfigTable (remote mode)', () => {
  it('shows an error state on fetch rejection, and retry() recovers', async () => {
    const fetch = vi.fn();
    fetch.mockRejectedValueOnce(new Error('network down'));
    fetch.mockResolvedValueOnce({ items: allRows.slice(0, 10), total: 25 });
    // memoized source: created once, reused across the component's internal re-renders so the
    // fetch effect doesn't re-trigger on a new `source` identity (see use-config-table.ts note).
    const source: TableSource = { kind: 'remote', request: offsetRequest, response: offsetResponse, fetch };

    render(<ConfigTable config={config} source={source} />);

    await waitFor(() => expect(screen.getByText('Something went wrong.')).toBeDefined());

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => expect(screen.queryByText('Something went wrong.')).toBeNull());
    expect(screen.getByText('Page 1 of 3')).toBeDefined();
  });
});

const cursorRequest: RequestMeta = {
  endpoint: '/rows',
  pagination: { strategy: 'cursor', cursorParam: 'cursor', limitParam: 'limit' },
};
const cursorResponse: ResponseMeta = { rowsPath: 'items', cursorPath: 'nextCursor' };

describe('ConfigTable (cursor mode)', () => {
  it('renders only prev/next controls, no page-of text', async () => {
    const fetch = vi.fn(async (built: BuiltRequest) => {
      const limit = Number(built.params.limit);
      const cursor = built.params.cursor;
      const start = cursor === undefined ? 0 : Number(cursor);
      const slice = allRows.slice(start, start + limit);
      const nextStart = start + limit;
      return { items: slice, nextCursor: nextStart < allRows.length ? String(nextStart) : undefined };
    });
    const source: TableSource = { kind: 'remote', request: cursorRequest, response: cursorResponse, fetch };

    render(<ConfigTable config={config} source={source} />);

    await waitFor(() => expect(screen.getByText('Previous')).toBeDefined());
    expect(screen.getByText('Next')).toBeDefined();
    expect(screen.queryByText(/Page \d+ of/)).toBeNull();
    expect(screen.queryByText(/rows$/)).toBeNull();
  });
});

// --- filter section ---------------------------------------------------------------------------

const FILT_CFG: TableConfig = {
  columns: [
    { key: 'id', label: 'ID', dataType: 'numeric', filterable: true },
    { key: 'name', label: 'Name', dataType: 'string' },
  ] satisfies TableColumnConfig[],
  pagination: { pageSize: 5 },
};
const FILT_ROWS = [
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
];

// Hoisted + stable (module scope): the remote fetch effect keys off `source` identity, so an
// inline object literal passed straight into JSX would be a fresh reference on every render and
// re-trigger the fetch effect in a loop -- see the offsetRequest/offsetResponse pattern above.
const filtRemoteRequest: RequestMeta = {
  endpoint: '/x',
  pagination: { strategy: 'offset', limitParam: 'l', offsetParam: 'o' },
};
const filtRemoteResponse: ResponseMeta = { rowsPath: 'data.items', totalPath: 'data.total' };

describe('ConfigTable (filter section)', () => {
  it('renders a collapsible Filter section for a static source (collapsed by default)', () => {
    render(<ConfigTable config={FILT_CFG} source={{ kind: 'rows', rows: FILT_ROWS }} />);
    // Collapsed row (title) is visible, expander exists; collapsed by default -> the tree
    // editor's "+ condition" button isn't mounted yet.
    expect(screen.getByText('Filter')).toBeTruthy();
    expect(screen.queryByText('+ condition')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    expect(screen.getByText('+ condition')).toBeTruthy();
  });

  it('disables the filter for a remote source with a note', () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
    const source: TableSource = {
      kind: 'remote',
      request: filtRemoteRequest,
      response: filtRemoteResponse,
      fetch: fetchFn,
    };
    render(<ConfigTable config={FILT_CFG} source={source} />);
    expect(screen.getByText(/does not declare a remote filter/i)).toBeTruthy();
    expect(screen.queryByText('+ condition')).toBeNull();
  });
});

describe('remote filter UI', () => {
  const REMOTE_FIELDS = [
    { key: 'price', label: 'Price', dataType: 'numeric' as const, filterable: true, kind: 'column' as const },
  ];
  const REMOTE_FETCH = () => Promise.resolve({ data: { items: [{ id: 'r1', price: 10 }], total: 1 } });
  const REMOTE_SOURCE = {
    kind: 'remote' as const,
    request: {
      endpoint: '/api/items',
      pagination: { strategy: 'page' as const, pageParam: 'page', pageSizeParam: 'pageSize' },
      filter: { style: 'pg' as const, param: 'filter' },
    },
    response: { rowsPath: 'data.items', totalPath: 'data.total' },
    fields: REMOTE_FIELDS,
    fetch: REMOTE_FETCH,
  };
  const REMOTE_SOURCE_NO_FILTER = {
    ...REMOTE_SOURCE,
    request: { ...REMOTE_SOURCE.request, filter: undefined },
  };

  it('shows an enabled filter toggle and an Apply button for a filterable remote source', async () => {
    render(<ConfigTable config={config} source={REMOTE_SOURCE} />);
    const toggle = screen.getByRole('button', { name: /filter/i });
    expect((toggle as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(toggle);
    expect(await screen.findByRole('button', { name: 'Apply' })).toBeTruthy();
  });

  it('keeps the filter disabled for a remote source without filter meta', async () => {
    render(<ConfigTable config={config} source={REMOTE_SOURCE_NO_FILTER} />);
    const toggle = screen.getByRole('button', { name: /filter/i });
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(screen.queryByText(/loading/i)).toBeNull());
  });

  it('rows mode shows no Apply button (live filtering unchanged)', () => {
    render(<ConfigTable config={config} source={{ kind: 'rows', rows: FILT_ROWS }} />);
    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  });
});

describe('controlled filter tree props', () => {
  it('renders the injected tree and reports edits via onFilterTreeChange', () => {
    const external = emptyGroup(() => 'ext-1');
    const onChange = vi.fn();
    render(
      <ConfigTable
        config={config}
        source={{ kind: 'rows', rows: FILT_ROWS }}
        filterTree={external}
        onFilterTreeChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    // FilterTreeEditor 的「+ condition」預設 label(DEFAULT_FILTER_TREE_LABELS)
    fireEvent.click(screen.getByRole('button', { name: /\+ condition/i }));
    expect(onChange).toHaveBeenCalled();
  });
});
