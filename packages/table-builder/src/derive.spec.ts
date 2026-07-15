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
      { key: 'name', label: { en: 'Name' }, dataType: 'string', sortable: true, filterable: true },
      { key: 'price', label: 'Price', dataType: 'numeric', format: 'currency', options: [{ value: 1, label: 'One' }] },
    ]); // visible/pin/align are omitted when absent
  });

  it('carries filterable from field metadata (and omits it when unset)', () => {
    const cfg = deriveTableConfig({
      fields: [
        { key: 'a', label: 'A', dataType: 'string', filterable: true },
        { key: 'b', label: 'B', dataType: 'numeric' },
      ],
    });
    expect(cfg.columns[0]).toMatchObject({ key: 'a', filterable: true });
    expect('filterable' in cfg.columns[1]!).toBe(false);
  });

  it('copies label and options to prevent mutation of source metadata', () => {
    const meta = {
      fields: [
        {
          key: 'status',
          label: { en: 'Status', zh: '狀態' },
          dataType: 'string',
          options: [
            { value: 'active', label: { en: 'Active', zh: '活躍' } },
            { value: 'inactive', label: 'Inactive' },
          ],
        },
      ],
    };

    const cfg = deriveTableConfig(meta);

    // Verify label is a copy, not the same reference
    expect(cfg.columns[0].label).not.toBe(meta.fields[0].label);

    // Verify options array is a copy, not the same reference
    expect(cfg.columns[0].options).not.toBe(meta.fields[0].options);

    // Verify first option is a copy, not the same reference
    expect(cfg.columns[0].options?.[0]).not.toBe(meta.fields[0].options?.[0]);

    // Verify first option's label (when it's a record) is a copy
    expect(cfg.columns[0].options?.[0].label).not.toBe(meta.fields[0].options?.[0].label);

    // Mutate derived label and assert source is unchanged
    (cfg.columns[0].label as Record<string, string>).en = 'CHANGED';
    expect((meta.fields[0].label as Record<string, string>).en).toBe('Status');

    // Mutate derived options array and assert source is unchanged
    cfg.columns[0].options!.push({ value: 'pending', label: 'Pending' });
    expect(meta.fields[0].options).toHaveLength(2);

    // Mutate derived option label (record) and assert source is unchanged
    (cfg.columns[0].options![0].label as Record<string, string>).en = 'CHANGED_OPTION';
    expect((meta.fields[0].options[0].label as Record<string, string>).en).toBe('Active');
  });
});
