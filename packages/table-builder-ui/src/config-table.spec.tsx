import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TableConfig, TableColumnConfig } from '@rfjs/table-builder';
import type { BuiltRequest, RequestMeta, ResponseMeta } from '@rfjs/data-schema';
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
