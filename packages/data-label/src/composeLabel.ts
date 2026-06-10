import { buildLabelValues } from './buildLabelValues';
import { normalizeKey } from './normalizeKey';
import type { ComposeOptions, LabelSpec } from './types';

const TOKEN = /\$\{([^}]+)\}/g;

/**
 * Coerce a resolved value to a string. Mirrors plain `String(value)` (objects/arrays fall back
 * to their `toString`, e.g. `'[object Object]'`) but never throws — used after the caller has
 * already dropped `null`/`undefined`. The `String` constructor is total, so this is safe for any
 * input; the cast only narrows `unknown` for `@typescript-eslint/no-base-to-string`.
 */
function stringify(value: unknown): string {
  return String(value as string);
}

/**
 * Compose a display label from `spec` + `source`. With a `template`, each `${token}` is
 * replaced by the value table entry for `normalizeKey(token)` (unknown/nullish → ''); a custom
 * `options.render` overrides this. Without a template, the field values are space-joined,
 * dropping `null`/`undefined`/`''` (but keeping `0`/`false`). Never throws.
 */
export function composeLabel(
  spec: LabelSpec,
  source: object,
  options: ComposeOptions = {},
): string {
  const values = buildLabelValues(spec, source);

  if (spec.template !== undefined) {
    if (options.render) {
      return options.render(spec.template, values);
    }
    return spec.template.replace(TOKEN, (_match, token: string) => {
      const value = values[normalizeKey(token.trim())];
      return value === null || value === undefined ? '' : stringify(value);
    });
  }

  return spec.fields
    .map((field) => values[field.path])
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => stringify(value))
    .join(' ');
}
