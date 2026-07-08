import { describe, expect, it } from 'vitest';
import { deriveTableConfig } from './derive';

describe('deriveTableConfig', () => {
  it('maps fields to columns and defaults pageSize to 10', () => {
    const cfg = deriveTableConfig({
      fields: [
        { key: 'name', label: { en: 'Name' }, dataType: 'string', sortable: true, filterable: true },
        { key: 'price', label: 'Price', dataType: 'numeric', format: 'currency', options: [{ value: 1, label: 'One' }] },
      ],
    });
    expect(cfg.pagination).toEqual({ pageSize: 10 });
    expect(cfg.columns).toEqual([
      { key: 'name', label: { en: 'Name' }, dataType: 'string', sortable: true },
      { key: 'price', label: 'Price', dataType: 'numeric', format: 'currency', options: [{ value: 1, label: 'One' }] },
    ]); // filterable is not carried over; visible/pin/align are omitted when absent
  });
});
