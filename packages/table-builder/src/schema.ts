import { z } from 'zod';
import { fieldFormatSchema, fieldOptionSchema, localizedLabelSchema } from '@rfjs/data-schema';
import type { TableColumnConfig, TableConfig, TableDefaultSort, TablePaginationConfig } from './types';

const NUMERIC_FORMATS = ['integer', 'decimal', 'percent', 'currency'] as const;
const DATE_FORMATS = ['date', 'datetime', 'time'] as const;

const tableColumnConfigObjectSchema = z.object({
  key: z.string().min(1),
  label: localizedLabelSchema,
  dataType: z.enum(['string', 'numeric', 'date', 'boolean']),
  format: fieldFormatSchema.optional(),
  options: z.array(fieldOptionSchema).optional(),
  sortable: z.boolean().optional(),
  filterable: z.boolean().optional(),
  visible: z.boolean().optional(),
  pin: z.enum(['left', 'right']).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
});

export const tableColumnConfigSchema = tableColumnConfigObjectSchema.superRefine((column, ctx) => {
  if (column.format === undefined) return;
  const allowed: readonly string[] = column.dataType === 'numeric' ? NUMERIC_FORMATS : column.dataType === 'date' ? DATE_FORMATS : [];
  if (!allowed.includes(column.format)) {
    ctx.addIssue({
      code: 'custom',
      path: ['format'],
      message: `format "${column.format}" is not compatible with dataType "${column.dataType}"`,
    });
  }
}) satisfies z.ZodType<TableColumnConfig>;

export const tablePaginationConfigSchema = z.object({
  pageSize: z.int().positive(),
  pageSizeOptions: z.array(z.int().positive()).optional(),
}) satisfies z.ZodType<TablePaginationConfig>;

export const tableDefaultSortSchema = z.object({
  key: z.string().min(1),
  direction: z.enum(['asc', 'desc']),
}) satisfies z.ZodType<TableDefaultSort>;

export const tableConfigSchema = z.object({
  columns: z.array(tableColumnConfigSchema).min(1),
  pagination: tablePaginationConfigSchema,
  defaultSort: tableDefaultSortSchema.optional(),
  emptyText: localizedLabelSchema.optional(),
}) satisfies z.ZodType<TableConfig>;

export function parseTableConfig(input: unknown): TableConfig {
  return tableConfigSchema.parse(input);
}
