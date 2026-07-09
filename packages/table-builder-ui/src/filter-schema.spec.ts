import { describe, expect, it } from 'vitest';
import { columnsToFilterSchema } from './filter-schema';
import type { TableColumnConfig } from '@rfjs/table-builder';

const cols: TableColumnConfig[] = [
  { key: 'name', label: 'Name', dataType: 'string', filterable: true },
  { key: 'price', label: 'Price', dataType: 'numeric', filterable: true },
  { key: 'note', label: 'Note', dataType: 'string' },
];

describe('columnsToFilterSchema', () => {
  it('maps only filterable columns to FieldSchema (dataType 1:1, key->path, kind column)', () => {
    expect(columnsToFilterSchema(cols)).toEqual([
      { path: 'name', dataType: 'string', include: true, kind: 'column' },
      { path: 'price', dataType: 'numeric', include: true, kind: 'column' },
    ]);
  });
  it('returns [] when no column is filterable', () => {
    expect(columnsToFilterSchema([cols[2]!])).toEqual([]);
  });
});
