import { z } from 'zod';
import type { JsonbFilterGroup } from '@rfjs/jsonb-query';

const LOGIC = ['and', 'or', 'nor', 'not'] as const;
const DATA_TYPE = ['string', 'numeric', 'date', 'boolean', 'object', 'array'] as const;

// Loose condition shape: deep grammar (operator/dataType validity) is enforced by
// @rfjs/jsonb-query at build time. This gate only rejects gross malformation.
const ConditionSchema = z.object({
  field: z.string().min(1),
  dataType: z.enum(DATA_TYPE),
  operator: z.string().min(1),
  value: z.unknown().optional(),
  elementType: z.enum(['string', 'numeric', 'date', 'boolean', 'object']).optional(),
  filters: z.unknown().optional(), // nested group for elemmatch; validated by jsonb-query
});

export const FilterGroupSchema: z.ZodType<JsonbFilterGroup> = z.lazy(() =>
  z.object({
    logic: z.enum(LOGIC),
    filters: z.array(z.union([ConditionSchema, FilterGroupSchema])),
  }),
) as z.ZodType<JsonbFilterGroup>;

export const SearchBodySchema = z.object({ filter: FilterGroupSchema });
export type SearchBody = z.infer<typeof SearchBodySchema>;
