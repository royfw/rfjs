import type { FieldSchema } from "@rfjs/filter-builder";

// Queryable fields of the datasets catalog, aligned to the backend datasetPgConfig
// (columns: name/description/createdAt/updatedAt; jsonb: the `data` column).
// jsonb data.* fields are added at runtime via the builder's creatable field input.
export const DATASET_FIELD_SCHEMA: FieldSchema[] = [
  { path: "name", dataType: "string", include: true, kind: "column" },
  { path: "description", dataType: "string", include: true, kind: "column" },
  { path: "createdAt", dataType: "date", include: true, kind: "column" },
  { path: "updatedAt", dataType: "date", include: true, kind: "column" },
];
