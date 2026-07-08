import type { DataResourceMeta } from '@rfjs/data-schema';
import type { TableColumnConfig, TableConfig } from './types';

const DEFAULT_PAGE_SIZE = 10;

// One-way compile: the resulting TableConfig is freely re-editable and does not stay in sync
// with later `meta` changes.
export function deriveTableConfig(meta: DataResourceMeta): TableConfig {
  const columns: TableColumnConfig[] = meta.fields.map((field) => {
    const column: TableColumnConfig = {
      key: field.key,
      label: typeof field.label === 'object' ? { ...field.label } : field.label,
      dataType: field.dataType,
    };
    if (field.format !== undefined) column.format = field.format;
    if (field.options !== undefined) {
      column.options = field.options.map((o) => ({
        ...o,
        ...(typeof o.label === 'object' ? { label: { ...o.label } } : {}),
      }));
    }
    if (field.sortable !== undefined) column.sortable = field.sortable;
    // `filterable` is intentionally not carried over (v1 table has no filter consumer).
    return column;
  });

  return {
    columns,
    pagination: { pageSize: DEFAULT_PAGE_SIZE },
  };
}
