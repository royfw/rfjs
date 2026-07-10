import { z } from 'zod';
import type { DataFieldMeta, DataResourceMeta, FilterRequestMeta, FieldOption, PaginationMeta, RequestMeta, ResponseMeta, SortMeta } from './types';

export const localizedLabelSchema = z.union([z.string(), z.record(z.string(), z.string())]) satisfies z.ZodType<
  string | Record<string, string>
>;

const NUMERIC_FORMATS = ['integer', 'decimal', 'percent', 'currency'] as const;
const DATE_FORMATS = ['date', 'datetime', 'time'] as const;

export const fieldFormatSchema = z.enum([...NUMERIC_FORMATS, ...DATE_FORMATS]);

export const fieldOptionSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  label: localizedLabelSchema,
}) satisfies z.ZodType<FieldOption>;

const dataFieldMetaObjectSchema = z.object({
  key: z.string().min(1),
  label: localizedLabelSchema,
  dataType: z.enum(['string', 'numeric', 'date', 'boolean']),
  format: fieldFormatSchema.optional(),
  options: z.array(fieldOptionSchema).optional(),
  sortable: z.boolean().optional(),
  filterable: z.boolean().optional(),
  kind: z.enum(['column', 'jsonb']).optional(),
});

export const dataFieldMetaSchema = dataFieldMetaObjectSchema.superRefine((field, ctx) => {
  if (field.format === undefined) return;
  const allowed: readonly string[] = field.dataType === 'numeric' ? NUMERIC_FORMATS : field.dataType === 'date' ? DATE_FORMATS : [];
  if (!allowed.includes(field.format)) {
    ctx.addIssue({
      code: 'custom',
      path: ['format'],
      message: `format "${field.format}" is not compatible with dataType "${field.dataType}"`,
    });
  }
}) satisfies z.ZodType<DataFieldMeta>;

export const paginationMetaSchema = z.discriminatedUnion('strategy', [
  z.object({ strategy: z.literal('offset'), limitParam: z.string(), offsetParam: z.string() }),
  z.object({
    strategy: z.literal('page'),
    pageParam: z.string(),
    pageSizeParam: z.string(),
    firstPage: z.union([z.literal(0), z.literal(1)]).optional(),
  }),
  z.object({ strategy: z.literal('cursor'), cursorParam: z.string(), limitParam: z.string() }),
]) satisfies z.ZodType<PaginationMeta>;

export const sortMetaSchema = z.discriminatedUnion('style', [
  z.object({ style: z.literal('single'), param: z.string(), encoding: z.enum(['colon', 'signed']) }),
  z.object({ style: z.literal('split'), fieldParam: z.string(), dirParam: z.string() }),
]) satisfies z.ZodType<SortMeta>;

export const filterRequestMetaSchema = z.object({
  style: z.literal('pg'),
  param: z.string().min(1),
}) satisfies z.ZodType<FilterRequestMeta>;

export const requestMetaSchema = z.object({
  endpoint: z.string().min(1),
  method: z.enum(['GET', 'POST']).optional(),
  pagination: paginationMetaSchema,
  sort: sortMetaSchema.optional(),
  filter: filterRequestMetaSchema.optional(),
}) satisfies z.ZodType<RequestMeta>;

export const responseMetaSchema = z.object({
  rowsPath: z.string(),
  totalPath: z.string().optional(),
  cursorPath: z.string().optional(),
}) satisfies z.ZodType<ResponseMeta>;

export const dataResourceMetaSchema = z.object({
  fields: z.array(dataFieldMetaSchema),
  request: requestMetaSchema.optional(),
  response: responseMetaSchema.optional(),
}) satisfies z.ZodType<DataResourceMeta>;

export function parseDataResourceMeta(input: unknown): DataResourceMeta {
  return dataResourceMetaSchema.parse(input);
}
