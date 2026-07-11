// Shared scalar vocabulary, consistent with filter-builder / form-builder / jsonb-query.
export type ScalarType = 'string' | 'numeric' | 'date' | 'boolean';

// Same convention as form-builder: either a plain string or a locale => string map.
export type LocalizedLabel = string | Record<string, string>;

// Closed vocabulary; format is only valid for a subset of dataType (validated via zod superRefine).
export type FieldFormat =
  | 'integer'
  | 'decimal'
  | 'percent'
  | 'currency' // dataType: 'numeric' only
  | 'date'
  | 'datetime'
  | 'time'; // dataType: 'date' only

export interface FieldOption {
  value: string | number | boolean;
  label: LocalizedLabel;
}

export interface DataFieldMeta {
  key: string; // dot path, may point to a nested value, e.g. 'author.name'
  label: LocalizedLabel;
  dataType: ScalarType;
  format?: FieldFormat;
  options?: FieldOption[]; // enum fields (status code -> label)
  sortable?: boolean; // default false
  filterable?: boolean; // authored: whether this field may appear in a filter tree (remote filter consumer since the api-filter round)
  /**
   * How the backend queries this field: a typed SQL column or a JSONB path. Literals align with
   * `@rfjs/filter-builder`'s `FieldKind` (no cross-dependency — same convention as `ScalarType`).
   * Authored only — `inferFieldsFromRows` never produces it; absent = not remotely filterable.
   */
  kind?: 'column' | 'jsonb';
}

export type PaginationMeta =
  | { strategy: 'offset'; limitParam: string; offsetParam: string }
  | { strategy: 'page'; pageParam: string; pageSizeParam: string; firstPage?: 0 | 1 } // default 1
  | { strategy: 'cursor'; cursorParam: string; limitParam: string };

export type SortMeta =
  | { style: 'single'; param: string; encoding: 'colon' | 'signed' } // sort=name:asc / sort=-name
  | { style: 'split'; fieldParam: string; dirParam: string }; // sortBy=name&order=asc

/** How a compiled filter rides the request: currently only the pg-filter tree style. */
export interface FilterRequestMeta {
  style: 'pg'; // room to grow (e.g. other encodings) without breaking the shape
  param: string; // request key: POST body key, or the query param a GET fetcher serializes into
}

export interface RequestMeta {
  endpoint: string;
  method?: 'GET' | 'POST'; // default GET
  pagination: PaginationMeta;
  sort?: SortMeta;
  filter?: FilterRequestMeta;
}

export interface ResponseMeta {
  rowsPath: string; // dot path to the row array; '' means the response itself is the array
  totalPath?: string; // total count, for offset / page strategies
  cursorPath?: string; // next-page cursor location, for cursor strategy; absent value = no next page
}

export interface DataResourceMeta {
  fields: DataFieldMeta[];
  request?: RequestMeta; // purely static data may omit this
  response?: ResponseMeta;
}

// --- Consumer-facing request/response state shapes (not part of the zod contract above) ---

export interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

export interface PageState {
  pageSize: number;
  offset?: number;
  page?: number;
  cursor?: string;
  sort?: SortState;
}

export interface BuiltRequest {
  endpoint: string;
  method: 'GET' | 'POST';
  params: Record<string, string>;
  /** Compiled filter (opaque to data-schema); the fetcher places it per `RequestMeta.filter.param`. */
  filter?: unknown;
}
