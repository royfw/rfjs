import { getByPath } from '@rfjs/data-schema';
import type { ScalarType, SortState } from '@rfjs/data-schema';
import type { TableColumnConfig } from './types';

type Comparator = (a: unknown, b: unknown) => number;

const comparators: Record<ScalarType, Comparator> = {
  numeric: (a, b) => Number(a) - Number(b),
  date: (a, b) => new Date(a as string | number | Date).getTime() - new Date(b as string | number | Date).getTime(),
  string: (a, b) => String(a).localeCompare(String(b)),
  boolean: (a, b) => Number(a) - Number(b), // false (0) sorts before true (1) ascending
};

// Client-side sort over static rows. Values are read via `getByPath` (so nested keys like
// 'author.name' work); the comparator is chosen from the matching column's `dataType`.
// null/undefined values always sink to the bottom, regardless of `sort.direction`. The sort is
// stable (ties keep their original relative order) and the input array/rows are never mutated.
export function sortRows(rows: Record<string, unknown>[], sort: SortState, columns: TableColumnConfig[]): Record<string, unknown>[] {
  const column = columns.find((c) => c.key === sort.key);
  const compare = comparators[column?.dataType ?? 'string'];
  const dir = sort.direction === 'desc' ? -1 : 1;

  return rows
    .map((row, index) => ({ row, index, value: getByPath(row, sort.key) }))
    .sort((a, b) => {
      const aNullish = a.value === null || a.value === undefined;
      const bNullish = b.value === null || b.value === undefined;
      if (aNullish && bNullish) return a.index - b.index;
      if (aNullish) return 1;
      if (bNullish) return -1;
      const result = compare(a.value, b.value) * dir;
      return result !== 0 ? result : a.index - b.index;
    })
    .map((entry) => entry.row);
}
