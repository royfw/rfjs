// Data-type vocabulary — identical to @rfjs/filter-builder's FieldType.
export type ScalarType = 'string' | 'numeric' | 'date' | 'boolean';
export type FieldType = ScalarType | 'object' | 'array';

// P1 renderable components (Switch deferred — no web-ui Switch yet).
export type FieldComponent = 'Input' | 'Textarea' | 'Select' | 'Checkbox' | 'Date';

export interface FieldOption {
  label: string;
  value: string | number;
}

export interface FieldConfig {
  key: string;
  label: string;
  component: FieldComponent;
  dataType: FieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: FieldOption[];
}

export interface FormConfig {
  version: number;
  fields: FieldConfig[];
}
