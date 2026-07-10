import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { ResultView } from './result-view';

describe('ResultView states', () => {
  it('empty: shows default text or custom LocalizedLabel', () => {
    const { rerender } = render(<ResultView mode="card" state="empty" />);
    expect(screen.getByText('No result yet')).toBeTruthy();
    rerender(<ResultView mode="card" state="empty" emptyText={{ en: 'Nothing', 'zh-TW': '沒有資料' }} locale="zh-TW" />);
    expect(screen.getByText('沒有資料')).toBeTruthy();
  });

  it('loading: shows spinner text', () => {
    render(<ResultView mode="card" state="loading" />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it('error: shows failure text', () => {
    render(<ResultView mode="card" state="error" />);
    expect(screen.getByText(/request failed/i)).toBeTruthy();
  });
});

describe('ResultView card mode', () => {
  it('object → one key-value card; non-scalar values stringified', () => {
    render(<ResultView mode="card" state="ready" value={{ name: 'Roy', days: 3, detail: { dept: 'HR' } }} />);
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('Roy')).toBeTruthy();
    expect(screen.getByText('{"dept":"HR"}')).toBeTruthy();
  });

  it('array → stacked cards capped by maxItems with a "+N more" hint', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }));
    render(<ResultView mode="card" state="ready" value={rows} maxItems={3} />);
    expect(screen.getAllByText('id')).toHaveLength(3);
    expect(screen.getByText('+ 2 more')).toBeTruthy();
  });

  it('array within default cap renders all items and no hint', () => {
    render(<ResultView mode="card" state="ready" value={[{ a: 1 }, { a: 2 }]} />);
    expect(screen.getAllByText('a')).toHaveLength(2);
    expect(screen.queryByText(/more$/)).toBeNull();
  });

  it('scalar → single value card', () => {
    render(<ResultView mode="card" state="ready" value={42} />);
    expect(screen.getByText('42')).toBeTruthy();
  });
});

describe('ResultView json / table modes', () => {
  it('json: pretty prints', () => {
    render(<ResultView mode="json" state="ready" value={{ a: 1 }} />);
    expect(screen.getByText(/"a": 1/)).toBeTruthy();
  });

  it('table: empty array falls back to the empty box', () => {
    render(<ResultView mode="table" state="ready" value={[]} />);
    expect(screen.getByText('No result yet')).toBeTruthy();
  });
});

describe('ResultView table mode', () => {
  const rows = [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Alan' },
  ];

  it('derives columns from rows when no table config is given', () => {
    render(<ResultView mode="table" state="ready" value={rows} />);
    expect(screen.getByText('id')).toBeTruthy();
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('honors a carried TableConfig (column label overrides the key)', () => {
    render(
      <ResultView
        mode="table"
        state="ready"
        value={rows}
        table={{
          columns: [{ key: 'name', label: 'Full Name', dataType: 'string' }],
          pagination: { pageSize: 10 },
        }}
      />,
    );
    expect(screen.getByText('Full Name')).toBeTruthy();
    expect(screen.queryByText('id')).toBeNull();
  });

  it('falls back to the empty box when the value is not an object array', () => {
    render(<ResultView mode="table" state="ready" value={{ notAnArray: true }} emptyText={{ en: 'No rows' }} />);
    expect(screen.getByText('No rows')).toBeTruthy();
  });
});
