import { z } from 'zod';

import type { FormConfig } from './types';

const fieldOptionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
});

const fieldConfigSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  component: z.enum(['Input', 'Textarea', 'Select', 'Checkbox', 'Date']),
  dataType: z.enum(['string', 'numeric', 'date', 'boolean', 'object', 'array']),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(fieldOptionSchema).optional(),
});

export const FormConfigSchema = z.object({
  version: z.number().int(),
  fields: z.array(fieldConfigSchema),
});

export function parseFormConfig(input: unknown): FormConfig {
  return FormConfigSchema.parse(input) as FormConfig;
}
