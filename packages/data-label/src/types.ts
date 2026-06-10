export interface AliasField {
  /** Dot/bracket path into the source, e.g. `'contract[0]'`. */
  path: string;
  /** Optional friendly name usable in templates, e.g. `'alias1'`. */
  aliasKey?: string;
}

export interface ValueMapEntry {
  /** Raw resolved value to match. */
  key: string | number | boolean;
  /** Replacement value (e.g. an enum code → display label). */
  value: unknown;
}

export interface LabelSpec {
  /** Source paths to resolve, in order. */
  fields: AliasField[];
  /** Optional value-translation entries (enum decode). */
  valueMap?: ValueMapEntry[];
  /** Optional composition template, e.g. `'${_0}_${_1}'`, `'${contract[0]}'`, `'${alias1}'`. */
  template?: string;
}

export interface ComposeOptions {
  /**
   * Custom template renderer. Receives the raw template and the full value table (which
   * contains positional `_N`, raw-path, normalized-path, and `aliasKey` entries). If omitted,
   * a safe `${path}` interpolator is used.
   */
  render?: (template: string, values: Record<string, unknown>) => string;
}
