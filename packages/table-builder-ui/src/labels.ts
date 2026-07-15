import type { TableLabels } from './types';

export const DEFAULT_LABELS: TableLabels = {
  empty: 'No data',
  loading: 'Loading…',
  error: 'Something went wrong.',
  retry: 'Retry',
  prev: 'Previous',
  next: 'Next',
  pageOf: 'Page {page} of {count}',
  total: '{total} rows',
  pageSize: 'Rows per page',
  filterTitle: 'Filter',
  filterMatched: '{count} matched',
  filterUncoverable: 'This filter uses conditions the in-memory engine cannot evaluate.',
  filterDisabled: 'This data source does not declare a remote filter.',
  filterApply: 'Apply',
};
