// Canonical operator keys across all @rfjs filter engines (jsonb / sql-filter /
// data-filter / mongo / pg-filter). UI uses this to build localized label maps.
export const OPERATOR_KEYS: string[] = [
  "eq", "neq", "ieq", "ineq",
  "gt", "gte", "lt", "lte", "range",
  "contains", "icontains", "startswith", "istartswith", "endswith", "iendswith",
  "terms", "nin", "containsall",
  "isnull", "isnotnull", "isempty", "isnotempty",
  "haskey", "hasanykey", "hasallkeys",
  "elemmatch",
];
