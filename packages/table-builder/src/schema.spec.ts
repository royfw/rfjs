import { describe, expect, it } from 'vitest';
import { parseTableConfig, tableConfigSchema } from './schema';

const column = (over: object = {}) => ({ key: 'name', label: 'Name', dataType: 'string', ...over });

describe('parseTableConfig', () => {
  it('accepts a minimal config (columns + pagination only)', () => {
    expect(() => parseTableConfig({ columns: [column()], pagination: { pageSize: 10 } })).not.toThrow();
  });

  it('accepts a full config with pin/align/visible/defaultSort', () => {
    expect(() =>
      parseTableConfig({
        columns: [
          column({
            dataType: 'numeric',
            format: 'currency',
            options: [{ value: 1, label: 'One' }],
            sortable: true,
            visible: false,
            pin: 'left',
            align: 'right',
          }),
        ],
        pagination: { pageSize: 20, pageSizeOptions: [10, 20, 50] },
        defaultSort: { key: 'name', direction: 'asc' },
        emptyText: { en: 'No rows' },
      }),
    ).not.toThrow();
  });

  it('rejects an empty columns array', () => {
    expect(() => parseTableConfig({ columns: [], pagination: { pageSize: 10 } })).toThrow();
  });

  it('rejects a non-positive pageSize', () => {
    expect(() => parseTableConfig({ columns: [column()], pagination: { pageSize: 0 } })).toThrow();
  });

  it('rejects an invalid pin value', () => {
    expect(() => parseTableConfig({ columns: [column({ pin: 'top' })], pagination: { pageSize: 10 } })).toThrow();
  });

  it('rejects an invalid defaultSort direction', () => {
    expect(() =>
      parseTableConfig({
        columns: [column()],
        pagination: { pageSize: 10 },
        defaultSort: { key: 'name', direction: 'up' },
      }),
    ).toThrow();
  });

  it('retains a column filterable flag', () => {
    const r = tableConfigSchema.safeParse({
      columns: [{ key: 'a', label: 'A', dataType: 'string', filterable: true }],
      pagination: { pageSize: 10 },
    });
    expect(r.success && r.data.columns[0]!.filterable).toBe(true);
  });
});
