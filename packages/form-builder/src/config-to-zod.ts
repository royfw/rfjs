import { z } from 'zod';

import type { FieldConfig, FormConfig } from './types';

function baseForField(field: FieldConfig): z.ZodTypeAny {
  if (field.options && field.options.length > 0) {
    const values = field.options.map((o) => String(o.value));
    return z.enum(values as [string, ...string[]]);
  }
  switch (field.dataType) {
    case 'numeric':
      return z.coerce.number();
    case 'boolean':
      return z.boolean();
    case 'object':
    case 'array':
      return z.unknown();
    case 'string':
    case 'date':
    default:
      return z.string();
  }
}

function applyRequired(field: FieldConfig, base: z.ZodTypeAny): z.ZodTypeAny {
  const isStringish = base instanceof z.ZodString;
  if (field.required) {
    return isStringish ? (base as z.ZodString).min(1) : base;
  }
  return base.optional();
}

export function configToZod(config: FormConfig): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of config.fields) {
    shape[field.key] = applyRequired(field, baseForField(field));
  }
  return z.object(shape);
}
