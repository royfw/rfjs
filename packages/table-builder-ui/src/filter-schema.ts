import type { TableColumnConfig } from '@rfjs/table-builder';
import type { DataFieldMeta } from '@rfjs/data-schema';
import type { FieldSchema } from '@rfjs/filter-builder';

/** filterable 欄位 → filter-builder FieldSchema(ScalarType ≡ FieldType,dataType 直接帶)。 */
export function columnsToFilterSchema(columns: TableColumnConfig[]): FieldSchema[] {
  return columns
    .filter((c) => c.filterable)
    .map((c) => ({ path: c.key, dataType: c.dataType, include: true, kind: 'column' as const }));
}

/**
 * remote 篩選的 schema 來源(api-filter spec §2.1):meta fields 中 filterable 且已宣告 kind 的
 * 欄位 —— kind 是 authored 的查詢知識(column vs jsonb),缺省即視為不可遠端篩選。
 */
export function fieldsToFilterSchema(fields: DataFieldMeta[]): FieldSchema[] {
  return fields
    .filter((f) => f.filterable === true && f.kind !== undefined)
    .map((f) => ({ path: f.key, dataType: f.dataType, include: true, kind: f.kind as 'column' | 'jsonb' }));
}
