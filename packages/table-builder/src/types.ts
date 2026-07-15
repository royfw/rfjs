import type { FieldFormat, FieldOption, LocalizedLabel, ScalarType } from '@rfjs/data-schema';

// Names below are frozen (spec §4.1): `form-builder` result items will later embed
// `{ mode: 'table', table: TableConfig }`, so `TableConfig`/`TableColumnConfig` must not be renamed.

export interface TableColumnConfig {
  key: string;
  label: LocalizedLabel;
  dataType: ScalarType;
  format?: FieldFormat;
  options?: FieldOption[];
  sortable?: boolean; // default false
  /** 是否可作為篩選欄位(供 <ConfigTable> 的執行時篩選器)。 */
  filterable?: boolean;
  visible?: boolean; // default true — editor show/hide toggle
  pin?: 'left' | 'right';
  align?: 'left' | 'center' | 'right'; // unspecified -> renderer defaults by dataType (numeric -> right, else left)
}

export interface TablePaginationConfig {
  pageSize: number;
  pageSizeOptions?: number[];
}

export interface TableDefaultSort {
  key: string;
  direction: 'asc' | 'desc';
}

export interface TableConfig {
  columns: TableColumnConfig[]; // array order = column order (drag reorder edits this)
  pagination: TablePaginationConfig;
  defaultSort?: TableDefaultSort;
  emptyText?: LocalizedLabel; // optional, UI has an English default
}
