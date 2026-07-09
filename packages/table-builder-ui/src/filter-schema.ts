import type { TableColumnConfig } from '@rfjs/table-builder';
import type { FieldSchema } from '@rfjs/filter-builder';

/** filterable 欄位 → filter-builder FieldSchema(ScalarType ≡ FieldType,dataType 直接帶)。 */
export function columnsToFilterSchema(columns: TableColumnConfig[]): FieldSchema[] {
  return columns
    .filter((c) => c.filterable)
    .map((c) => ({ path: c.key, dataType: c.dataType, include: true, kind: 'column' as const }));
}
