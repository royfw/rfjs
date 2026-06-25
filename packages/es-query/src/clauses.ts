import type { EsClause, ValueType } from './types';

export const term = (field: string, value: ValueType): EsClause => ({
  term: { [field]: value },
});

export const terms = (field: string, values: ValueType[]): EsClause => ({
  terms: { [field]: values },
});

export interface RangeBounds {
  gte?: ValueType;
  lte?: ValueType;
  gt?: ValueType;
  lt?: ValueType;
}

export const range = (field: string, bounds: RangeBounds): EsClause => ({
  range: { [field]: { ...bounds } },
});

export const match = (field: string, value: ValueType): EsClause => ({
  match: { [field]: value },
});

export const matchPhrase = (field: string, value: ValueType): EsClause => ({
  match_phrase: { [field]: value },
});

export const multiMatch = (fields: string[], value: ValueType): EsClause => ({
  multi_match: { query: value, fields },
});

export const combinedFields = (fields: string[], value: ValueType): EsClause => ({
  combined_fields: { query: value, fields },
});

export const wildcard = (field: string, pattern: ValueType): EsClause => ({
  wildcard: { [field]: { value: pattern } },
});

export const prefix = (field: string, value: ValueType): EsClause => ({
  prefix: { [field]: value },
});

export const regexp = (field: string, value: ValueType): EsClause => ({
  regexp: { [field]: value },
});

export const fuzzy = (field: string, value: ValueType): EsClause => ({
  fuzzy: { [field]: { value } },
});

export const exists = (field: string): EsClause => ({
  exists: { field },
});

export const negate = (clause: EsClause): EsClause => ({
  bool: { must_not: [clause] },
});
