import type { FieldSchema } from "./types";

// Append a new field (default jsonb string) when the user types a key not in the schema.
export function addInferredField(schema: FieldSchema[], path: string): FieldSchema[] {
  if (!path || schema.some((f) => f.path === path)) return schema;
  return [...schema, { path, dataType: "string", include: true, kind: "jsonb" }];
}
