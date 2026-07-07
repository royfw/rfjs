import { z } from 'zod';

import type { FieldConfig, FormConfig } from './types';
import { collectFieldItems } from './normalize';

/** Converts empty string inputs to undefined so optional fields are omitted rather than coerced. */
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v);

/** Components that produce an array of values rather than a single value. */
const MULTI_VALUE = new Set(['CheckboxGroup', 'TagList']);

function baseForField(field: FieldConfig): z.ZodTypeAny {
  // FileUpload: multiple → array of unknown, single → unknown object
  if (field.component === 'FileUpload') {
    return field.fileUpload?.multiple ? z.array(z.unknown()) : z.unknown();
  }
  // Signature: always a string (base64/data URL)
  if (field.component === 'Signature') {
    return z.string();
  }

  // Multi-value components must be checked before the options short-circuit,
  // because they produce arrays even when options are provided.
  if (MULTI_VALUE.has(field.component)) {
    if (field.component === 'TagList' && field.creatable) return z.array(z.string());
    const values = (field.options ?? []).map((o) => String(o.value));
    return values.length ? z.array(z.enum(values as [string, ...string[]])) : z.array(z.string());
  }

  if (field.options && field.options.length > 0) {
    const values = field.options.map((o) => String(o.value));
    return z.enum(values as [string, ...string[]]);
  }
  // Component-level override: Number and Switch determine the base type regardless of dataType,
  // so callers who set only the component (without dataType) still get the correct schema.
  if (field.component === 'Number') return z.coerce.number();
  if (field.component === 'Switch') return z.boolean();
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

  const isNumeric =
    (field.dataType === 'numeric' || field.component === 'Number') && !field.options?.length;
  const isString =
    (field.dataType === 'string' || field.dataType === 'date' || field.component === 'Email') &&
    !field.options?.length;

  // Numeric bounds — only for numeric fields with a numeric base (not options/enum)
  if (isNumeric) {
    let numBase = base as z.ZodNumber;
    if (v.min !== undefined) numBase = numBase.min(v.min, v.message);
    if (v.max !== undefined) numBase = numBase.max(v.max, v.message);
    return numBase;
  }

  // String length + pattern — only for string/date/email fields without options
  if (isString) {
    let strBase = base as z.ZodString;
    if (v.minLength !== undefined) strBase = strBase.min(v.minLength, v.message);
    if (v.maxLength !== undefined) strBase = strBase.max(v.maxLength, v.message);
    if (v.pattern !== undefined) {
      try {
        strBase = strBase.regex(new RegExp(v.pattern), v.message);
      } catch {
        // invalid regex source — skip it silently rather than throwing
      }
    }
    return strBase;
  }

  return base;
}

function fieldSchema(field: FieldConfig): z.ZodTypeAny {
  const rawBase = baseForField(field);
  let base = applyValidation(rawBase, field);

  // Email: apply format check after other string validations (minLength/maxLength/pattern)
  if (field.component === 'Email' && !field.options?.length) {
    base = (base as z.ZodString).email(field.validation?.message);
  }

  const isMultiValue = MULTI_VALUE.has(field.component);
  const isStringLike =
    field.dataType === 'string' || field.dataType === 'date' || field.component === 'Email' || field.component === 'Signature';
  const isNumericLike = field.dataType === 'numeric' || field.component === 'Number';

  if (field.required) {
    // FileUpload: multiple → reject empty array; single → reject undefined
    if (field.component === 'FileUpload') {
      return field.fileUpload?.multiple
        ? (base as z.ZodArray<z.ZodTypeAny>).min(1)
        : base.refine((v) => v !== undefined, { message: 'Required' });
    }
    // Multi-value: reject empty array
    if (isMultiValue) return (base as z.ZodArray<z.ZodTypeAny>).min(1, field.validation?.message);
    // Single Checkbox: must be checked (true)
    if (field.component === 'Checkbox') return z.literal(true);
    // enum already rejects invalid values including ''
    if (field.options?.length) return base;
    if (isStringLike) return (base as z.ZodString).min(1, field.validation?.message);
    // '' -> undefined -> number rejects (required empty fails)
    if (isNumericLike) return z.preprocess(emptyToUndefined, base);
    // boolean / object / array
    return base;
  }
  // optional: '' -> undefined so the key is OMITTED, never 0 / ''
  return z.preprocess(emptyToUndefined, base.optional());
}

export function configToZod(config: FormConfig): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of collectFieldItems(config)) {
    shape[field.key] = fieldSchema(field);
  }
  return z.object(shape);
}
