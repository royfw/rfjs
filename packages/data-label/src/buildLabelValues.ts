import { getByPath } from '@rfjs/object-utils';
import { normalizeKey } from './normalizeKey';
import type { LabelSpec } from './types';

/**
 * Resolve each field's path against `source`, translate via `valueMap`, and store the result
 * under four keys: `_${index}` (positional), the raw path, the normalized path, and `aliasKey`
 * (when set). A missing path resolves to `null`. Unmatched values pass through; falsy mapped
 * values are honored (lookup uses `Map.has`).
 */
export function buildLabelValues(
  spec: LabelSpec,
  source: object,
): Record<string, unknown> {
  const translation = new Map<unknown, unknown>(
    (spec.valueMap ?? []).map((entry) => [entry.key, entry.value]),
  );
  const values: Record<string, unknown> = {};
  spec.fields.forEach((field, index) => {
    const raw = getByPath(source, field.path) ?? null;
    const translated = translation.has(raw) ? translation.get(raw) : raw;
    values[`_${index}`] = translated;
    values[field.path] = translated;
    values[normalizeKey(field.path)] = translated;
    if (field.aliasKey) {
      values[field.aliasKey] = translated;
    }
  });
  return values;
}
