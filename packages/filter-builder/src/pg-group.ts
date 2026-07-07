import type { PgFilterGroup, PgLeaf } from "@rfjs/pg-filter";

import { treeToFilterGroup, type FilterConditionLike, type FilterGroupLike } from "./compile";
import type { CompileField } from "./engines/types";
import type { BuilderGroup, FieldSchema } from "./types";

export function toPgLeaf(c: FilterConditionLike, byPath: Map<string, CompileField>): PgLeaf {
  const f = byPath.get(c.field);
  const kind = f?.kind ?? "jsonb";
  if (kind === "column") {
    return { target: "column", column: c.field, operator: c.operator, value: c.value } as PgLeaf;
  }
  const leaf = {
    target: "jsonb",
    field: c.field,
    dataType: f?.dataType ?? c.dataType,
    operator: c.operator,
    ...(c.value !== undefined ? { value: c.value } : {}),
    ...((f?.elementType ?? c.elementType) ? { elementType: f?.elementType ?? c.elementType } : {}),
    ...(c.filters ? { filters: c.filters } : {}),
  };
  return leaf as unknown as PgLeaf;
}

export function toPgGroup(group: FilterGroupLike, byPath: Map<string, CompileField>): PgFilterGroup {
  return {
    logic: group.logic as PgFilterGroup["logic"],
    filters: group.filters.map((node) =>
      "logic" in node
        ? toPgGroup(node as FilterGroupLike, byPath)
        : toPgLeaf(node as FilterConditionLike, byPath),
    ),
  };
}

/**
 * Build a structured, target-tagged PgFilterGroup from a builder tree + its schema.
 * The schema's per-field `kind` (column|jsonb) drives leaf target tagging. This is the
 * structured counterpart to the pg-filter engine's string-SQL output — consumers send it
 * as the `filter` of a datasets/query API request.
 */
export function treeToPgFilterGroup(tree: BuilderGroup, schema: FieldSchema[]): PgFilterGroup {
  const byPath = new Map<string, CompileField>(
    schema.map((f) => [
      f.path,
      { path: f.path, kind: f.kind, dataType: f.dataType, elementType: f.elementType },
    ]),
  );
  return toPgGroup(treeToFilterGroup(tree), byPath);
}
