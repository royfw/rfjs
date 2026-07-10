import { describe, expect, it } from 'vitest';
import { columnsToFilterSchema, fieldsToFilterSchema } from './filter-schema';
import type { TableColumnConfig } from '@rfjs/table-builder';
import type { DataFieldMeta } from '@rfjs/data-schema';

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

describe('fieldsToFilterSchema', () => {
  it('maps filterable fields with a kind, keeping dataType and kind', () => {
    const schema = fieldsToFilterSchema([
      { key: 'price', label: 'Price', dataType: 'numeric', filterable: true, kind: 'column' },
      { key: 'author.name', label: 'Author', dataType: 'string', filterable: true, kind: 'jsonb' },
    ]);
    expect(schema).toEqual([
      { path: 'price', dataType: 'numeric', include: true, kind: 'column' },
      { path: 'author.name', dataType: 'string', include: true, kind: 'jsonb' },
    ]);
  });

  it('drops fields that are not filterable or lack a kind', () => {
    const schema = fieldsToFilterSchema([
      { key: 'a', label: 'A', dataType: 'string', kind: 'column' }, // not filterable
      { key: 'b', label: 'B', dataType: 'string', filterable: true }, // no kind
      { key: 'c', label: 'C', dataType: 'string', filterable: false, kind: 'column' },
    ]);
    expect(schema).toEqual([]);
  });
});
