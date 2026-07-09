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
};
