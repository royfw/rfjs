import { z } from 'zod';
import type { ZodType } from 'zod';

import type { FormConfig } from './types';

const fieldOptionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
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
});

export const FormConfigSchema: ZodType<FormConfig> = z.object({
  version: z.number().int(),
  fields: z.array(fieldConfigSchema),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
});

export function parseFormConfig(input: unknown): FormConfig {
  return FormConfigSchema.parse(input) as FormConfig;
}
