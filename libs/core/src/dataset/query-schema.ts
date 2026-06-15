import { z } from 'zod';
import type { PgFilterGroup } from '@rfjs/pg-filter';

const LOGIC = ['and', 'or', 'nor', 'not'] as const;
const DATA_TYPE = ['string', 'numeric', 'date', 'boolean', 'object', 'array'] as const;
const SCALAR_TYPE = ['string', 'numeric', 'date', 'boolean'] as const;

// Loose leaves: deep grammar (operator/type validity) is enforced by the builders.
const ColumnLeafSchema = z.object({
  target: z.literal('column'),
  column: z.string().min(1),
  operator: z.string().min(1),
  value: z.unknown().optional(),
});
const JsonbLeafSchema = z.object({
  target: z.literal('jsonb'),
  field: z.string().min(1),
  dataType: z.enum(DATA_TYPE),
  operator: z.string().min(1),
  value: z.unknown().optional(),
  elementType: z.enum(['string', 'numeric', 'date', 'boolean', 'object']).optional(),
  filters: z.unknown().optional(), // nested elemmatch group; deep-validated by jsonb-query
});
const LeafSchema = z.discriminatedUnion('target', [ColumnLeafSchema, JsonbLeafSchema]);

const FilterGroupSchema: z.ZodType<PgFilterGroup> = z.lazy(() =>
  z.object({
    logic: z.enum(LOGIC),
    filters: z.array(z.union([LeafSchema, FilterGroupSchema])),
  }),
) as z.ZodType<PgFilterGroup>;

const ColumnSortSchema = z.object({
  target: z.literal('column'),
  column: z.string().min(1),
  direction: z.enum(['asc', 'desc']).optional(),
  nulls: z.enum(['first', 'last']).optional(),
});
const JsonbSortSchema = z.object({
  target: z.literal('jsonb'),
  field: z.string().min(1),
  dataType: z.enum(SCALAR_TYPE),
  direction: z.enum(['asc', 'desc']).optional(),
  nulls: z.enum(['first', 'last']).optional(),
});
const SortSchema = z.discriminatedUnion('target', [ColumnSortSchema, JsonbSortSchema]);

export const QueryDatasetsBodySchema = z.object({
  filter: FilterGroupSchema.optional(),
  sort: z.array(SortSchema).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type QueryDatasetsBody = z.infer<typeof QueryDatasetsBodySchema>;
