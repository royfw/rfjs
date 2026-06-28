import type { ConditionalRule } from './conditional';

// Data-type vocabulary — identical to @rfjs/filter-builder's FieldType.
export type ScalarType = 'string' | 'numeric' | 'date' | 'boolean';

// --- DataSource types ---
export interface DataSourceRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
}
export type DataSourceDialect = 'path' | 'jsonata' | 'jsonpath';
export interface DataSourceExtract { dialect: DataSourceDialect; expr: string }
export interface DataSource {
  request: DataSourceRequest;
  extract: DataSourceExtract;       // → the value (scalar for content/default; list for options)
  fallback?: string;                // shown on empty/error; default '無'
  optionLabel?: string;             // for options: path within each list item → label (default: the item)
  optionValue?: string;             // for options: path within each list item → value (default: the item)
}
export type DataSourceFetcher = (req: DataSourceRequest) => Promise<unknown>;
export type FieldType = ScalarType | 'object' | 'array';

/** A field label that is either a plain string or a locale-keyed record. */
export type LocalizedLabel = string | Record<string, string>;

export type FieldComponent =
  | 'Input'
  | 'Textarea'
  | 'Select'
  | 'Checkbox'
  | 'Date'
  | 'Number'
  | 'Email'
  | 'Switch'
  | 'Radio'
  | 'DatePicker';

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
  conditional?: ConditionalRule;
  dataSource?: DataSource;
}

export type ItemKind = 'field' | 'content' | 'divider' | 'spacer' | 'ai-note';
export type SpacerSize = 'sm' | 'md' | 'lg';

export interface FieldItem extends FieldConfig {
  id: string;            // layout identity (dnd / tree-ops)
  kind: 'field';
  aiNote?: string;       // per-field AI note (not rendered to fillers)
}
export interface ContentItem {
  id: string;
  kind: 'content';
  text: LocalizedLabel;  // markdown-ish display text
  locked?: boolean;      // preset, not editable in builder
  conditional?: ConditionalRule;
  dataSource?: DataSource;
}
export interface DividerItem { id: string; kind: 'divider'; conditional?: ConditionalRule; }
export interface SpacerItem { id: string; kind: 'spacer'; size?: SpacerSize; conditional?: ConditionalRule; }
export interface AiNoteItem { id: string; kind: 'ai-note'; text: string; }
export type FormItem = FieldItem | ContentItem | DividerItem | SpacerItem | AiNoteItem;

export interface FormRow { id: string; items: FormItem[]; }
export interface FormSection { id: string; title?: LocalizedLabel; rows: FormRow[]; columns?: 1 | 2 | 3 | 4; }

export interface FormConfig {
  version: number;
  fields?: FieldConfig[];          // v1 (back-compat)
  sections?: FormSection[];        // v2
  columns?: 1 | 2 | 3 | 4;        // v1 grid (back-compat)
}
