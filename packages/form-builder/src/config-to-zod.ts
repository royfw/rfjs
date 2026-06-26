import { z } from 'zod';

import type { FieldConfig, FormConfig } from './types';

/** Converts empty string inputs to undefined so optional fields are omitted rather than coerced. */
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

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
    // date: P1 keeps it as a string from the native <input type="date">;
    // ISO-format validation (e.g. z.iso.date()) is deliberately deferred to a future iteration.
    default:
      return z.string();
  }
}

/** Apply FieldValidation constraints to the base schema before required/optional wrap. */
function applyValidation(base: z.ZodTypeAny, field: FieldConfig): z.ZodTypeAny {
  const v = field.validation;
  if (!v) return base;

  // Numeric bounds — only for numeric fields with a numeric base (not options/enum)
  if (field.dataType === 'numeric' && !field.options?.length) {
    let numBase = base as z.ZodNumber;
    if (v.min !== undefined) numBase = numBase.min(v.min, v.message);
    if (v.max !== undefined) numBase = numBase.max(v.max, v.message);
    return numBase;
  }

  // String length + pattern — only for string/date fields without options
  if ((field.dataType === 'string' || field.dataType === 'date') && !field.options?.length) {
    let strBase = base as z.ZodString;
    if (v.minLength !== undefined) strBase = strBase.min(v.minLength, v.message);
    if (v.maxLength !== undefined) strBase = strBase.max(v.maxLength, v.message);
    if (v.pattern !== undefined) strBase = strBase.regex(new RegExp(v.pattern), v.message);
    return strBase;
  }

  return base;
}

function fieldSchema(field: FieldConfig): z.ZodTypeAny {
  const rawBase = baseForField(field);
  const base = applyValidation(rawBase, field);
  if (field.required) {
    // enum already rejects invalid values including ''
    if (field.options?.length) return base;
    if (field.dataType === 'string' || field.dataType === 'date')
      return (base as z.ZodString).min(1);
    // '' -> undefined -> number rejects (required empty fails)
    if (field.dataType === 'numeric') return z.preprocess(emptyToUndefined, base);
    // boolean / object / array
    return base;
  }
  // optional: '' -> undefined so the key is OMITTED, never 0 / ''
  return z.preprocess(emptyToUndefined, base.optional());
}

export function configToZod(config: FormConfig): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of config.fields) {
    shape[field.key] = fieldSchema(field);
  }
  return z.object(shape);
}
