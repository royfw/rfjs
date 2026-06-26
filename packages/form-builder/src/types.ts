// Data-type vocabulary — identical to @rfjs/filter-builder's FieldType.
export type ScalarType = 'string' | 'numeric' | 'date' | 'boolean';
export type FieldType = ScalarType | 'object' | 'array';

/** A field label that is either a plain string or a locale-keyed record. */
export type LocalizedLabel = string | Record<string, string>;

// P1 renderable components (Switch deferred — no web-ui Switch yet).
export type FieldComponent = 'Input' | 'Textarea' | 'Select' | 'Checkbox' | 'Date';

export type FieldWidth = 'full' | 'half';

export interface FieldOption {
  label: string;
  value: string | number;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  /** Regex source string — applied to string fields via `new RegExp(pattern)`. */
  pattern?: string;
  /** Custom error message passed to zod on validation failure. */
  message?: string;
}

export interface FieldConfig {
  key: string;
  label: LocalizedLabel;
  component: FieldComponent;
  dataType: FieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: FieldOption[];
  width?: FieldWidth;
  validation?: FieldValidation;
}

export interface FormConfig {
  version: number;
  fields: FieldConfig[];
  columns?: 1 | 2 | 3 | 4;
}
