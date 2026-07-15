import { z } from 'zod';
import type { ZodType, ZodTypeAny } from 'zod';
import { tableConfigSchema } from '@rfjs/table-builder';

import type { FormConfig } from './types';

// Permissive structural schema for ConditionalRule (FilterMatchQuery).
// We validate shape (logic + filters array) without deep-validating every operator.
// elementType is preserved explicitly so it survives a parse/serialize round-trip.
const conditionSchema: ZodTypeAny = z.object({
  field: z.string(),
  dataType: z.string(),
  operator: z.string(),
  value: z.unknown().optional(),
  elementType: z.string().optional(),
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
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
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

const localizedLabelSchema = z.union([z.string(), z.record(z.string(), z.string())]);

// Internal raw ZodObject — used by fieldItemSchema.extend() which requires a ZodObject, not ZodEffects.
const fieldConfigObjectSchema = z.object({
  key: z.string().min(1),
  label: localizedLabelSchema,
  component: z.enum([
    'Input', 'Textarea', 'Select', 'Checkbox', 'Date', 'Number', 'Email', 'Switch', 'Radio', 'DatePicker',
    'CheckboxGroup', 'TagList', 'FileUpload', 'Signature',
  ]),
  dataType: z.enum(['string', 'numeric', 'date', 'boolean', 'object', 'array']),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.unknown().optional(),
  options: z.array(fieldOptionSchema).optional(),
  width: z.enum(['full', 'half']).optional(),
  validation: fieldValidationSchema.optional(),
  conditional: conditionalSchema.optional(),
  dataSource: dataSourceSchema.optional(),
  description: localizedLabelSchema.optional(),
  disabled: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  creatable: z.boolean().optional(),
  fileUpload: z.object({
    accept: z.string().optional(),
    multiple: z.boolean().optional(),
    maxSize: z.number().optional(),
  }).optional(),
});

// Shared refinement: TagList must have options unless creatable:true.
// Applied to both fieldConfigSchema and fieldItemSchema so the sections path is also guarded.
function validateTagListOptions(
  val: { component?: string; creatable?: boolean; options?: unknown[] },
  ctx: z.RefinementCtx
) {
  if (val.component === 'TagList' && val.creatable !== true && !(val.options?.length)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'TagList requires options unless creatable' });
  }
}

// Exported schema — includes TagList superRefine: options required unless creatable.
export const fieldConfigSchema = fieldConfigObjectSchema.superRefine(validateTagListOptions);

const fieldItemSchema = fieldConfigObjectSchema.extend({
  id: z.string().min(1),
  kind: z.literal('field'),
  aiNote: z.string().optional(),
}).superRefine(validateTagListOptions);
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

const buttonActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('submit') }),
  z.object({ type: z.literal('reset') }),
  z.object({ type: z.literal('clear'), fields: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal('custom'), name: z.string().min(1) }),
  z.object({
    type: z.literal('api'),
    url: z.string().min(1),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
    fields: z.array(z.string().min(1)).optional(),
    responseMap: z.record(z.string(), z.string()).optional(),
    messages: z.object({ success: localizedLabelSchema.optional(), error: localizedLabelSchema.optional() }).optional(),
  }),
]);

const buttonItemSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('button'),
  label: localizedLabelSchema,
  action: buttonActionSchema,
  variant: z.enum(['primary', 'outline', 'ghost', 'destructive']).optional(),
  validate: z.boolean().optional(),
});

const resultItemSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('result'),
  mode: z.enum(['card', 'json', 'table']),
  sourceId: z.string().min(1).optional(),
  dataPath: z.string().min(1).optional(),
  maxItems: z.number().int().positive().optional(),
  table: tableConfigSchema.optional(),
  emptyText: localizedLabelSchema.optional(),
});

const formItemSchema = z.discriminatedUnion('kind', [
  fieldItemSchema,
  contentItemSchema,
  dividerItemSchema,
  spacerItemSchema,
  aiNoteItemSchema,
  buttonItemSchema,
  resultItemSchema,
]);
const gridPlacementSchema = z.object({
  itemId: z.string().min(1),
  colStart: z.number().int().min(1).max(48),
  colSpan: z.number().int().min(1).max(48),
  row: z.number().int().min(1),
  rowSpan: z.number().int().min(1).optional(),
});
const sectionLayoutSchema = z.object({
  columns: z.number().int().min(1).max(48),
  placements: z.array(gridPlacementSchema),
});
const formRowSchema = z.object({ id: z.string().min(1), items: z.array(formItemSchema) });
const formSectionSchema = z.object({
  id: z.string().min(1),
  title: localizedLabelSchema.optional(),
  rows: z.array(formRowSchema),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  layout: sectionLayoutSchema.optional(),
});

export const FormConfigSchema: ZodType<FormConfig> = z
  .object({
    version: z.number().int(),
    id: z.string().min(1).optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    fields: z.array(fieldConfigSchema).optional(),
    sections: z.array(formSectionSchema).optional(),
    columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
    responsive: z.object({ stackBelow: z.number().positive().optional() }).optional(),
  })
  .refine(
    (c) => c.fields !== undefined || c.sections !== undefined,
    'config must have fields or sections'
  );

/** Alias for FormConfigSchema — provided for ergonomic named imports. */
export const formConfigSchema = FormConfigSchema;

export function parseFormConfig(input: unknown): FormConfig {
  return FormConfigSchema.parse(input) as FormConfig;
}
