import { z } from 'zod';
import type { ZodType, ZodTypeAny } from 'zod';

import type { FormConfig } from './types';

// Permissive structural schema for ConditionalRule (FilterMatchQuery).
// We validate shape (logic + filters array) without deep-validating every operator.
const conditionSchema: ZodTypeAny = z.object({
  field: z.string(),
  dataType: z.string(),
  operator: z.string(),
  value: z.unknown().optional(),
});

// Recursive group schema: z.lazy defers the self-reference so the outer `conditionalSchema`
// binding is resolved at evaluation time, not at declaration time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const conditionalSchema: ZodTypeAny = z.object({
  logic: z.enum(['and', 'or', 'nor', 'not']),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: z.array(z.union([conditionSchema, z.lazy(() => conditionalSchema as any)])),
});

const fieldOptionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
});

const fieldValidationSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z
    .string()
    .refine(
      (s) => {
        try {
          new RegExp(s);
          return true;
        } catch {
          return false;
        }
      },
      'Invalid regex pattern'
    )
    .optional(),
  message: z.string().optional(),
});

const fieldConfigSchema = z.object({
  key: z.string().min(1),
  label: z.union([z.string(), z.record(z.string(), z.string())]),
  component: z.enum(['Input', 'Textarea', 'Select', 'Checkbox', 'Date']),
  dataType: z.enum(['string', 'numeric', 'date', 'boolean', 'object', 'array']),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(fieldOptionSchema).optional(),
  width: z.enum(['full', 'half']).optional(),
  validation: fieldValidationSchema.optional(),
  conditional: conditionalSchema.optional(),
});

export const FormConfigSchema: ZodType<FormConfig> = z.object({
  version: z.number().int(),
  fields: z.array(fieldConfigSchema),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
});

export function parseFormConfig(input: unknown): FormConfig {
  return FormConfigSchema.parse(input) as FormConfig;
}
