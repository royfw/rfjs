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

const dataSourceSchema = z.object({
  request: z.object({
    url: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.unknown().optional(),
  }),
  extract: z.object({
    dialect: z.enum(['path', 'jsonata', 'jsonpath']),
    expr: z.string(),
  }),
  fallback: z.string().optional(),
  optionLabel: z.string().optional(),
  optionValue: z.string().optional(),
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
  component: z.enum(['Input', 'Textarea', 'Select', 'Checkbox', 'Date', 'Number', 'Email', 'Switch', 'Radio', 'DatePicker']),
  dataType: z.enum(['string', 'numeric', 'date', 'boolean', 'object', 'array']),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(fieldOptionSchema).optional(),
  width: z.enum(['full', 'half']).optional(),
  validation: fieldValidationSchema.optional(),
  conditional: conditionalSchema.optional(),
  dataSource: dataSourceSchema.optional(),
});

const localizedLabelSchema = z.union([z.string(), z.record(z.string(), z.string())]);

const fieldItemSchema = fieldConfigSchema.extend({
  id: z.string().min(1),
  kind: z.literal('field'),
  aiNote: z.string().optional(),
});
const contentItemSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('content'),
  text: localizedLabelSchema,
  locked: z.boolean().optional(),
  conditional: conditionalSchema.optional(),
  dataSource: dataSourceSchema.optional(),
});
const dividerItemSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('divider'),
  conditional: conditionalSchema.optional(),
});
const spacerItemSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('spacer'),
  size: z.enum(['sm', 'md', 'lg']).optional(),
  conditional: conditionalSchema.optional(),
});
const aiNoteItemSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('ai-note'),
  text: z.string(),
});

const formItemSchema = z.discriminatedUnion('kind', [
  fieldItemSchema,
  contentItemSchema,
  dividerItemSchema,
  spacerItemSchema,
  aiNoteItemSchema,
]);
const formRowSchema = z.object({ id: z.string().min(1), items: z.array(formItemSchema) });
const formSectionSchema = z.object({
  id: z.string().min(1),
  title: localizedLabelSchema.optional(),
  rows: z.array(formRowSchema),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
});

export const FormConfigSchema: ZodType<FormConfig> = z
  .object({
    version: z.number().int(),
    fields: z.array(fieldConfigSchema).optional(),
    sections: z.array(formSectionSchema).optional(),
    columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  })
  .refine(
    (c) => c.fields !== undefined || c.sections !== undefined,
    'config must have fields or sections'
  );

export function parseFormConfig(input: unknown): FormConfig {
  return FormConfigSchema.parse(input) as FormConfig;
}
