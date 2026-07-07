import { treeToPgFilterGroup, type BuilderGroup, type FieldSchema } from "@rfjs/filter-builder";

import type { QueryDatasetsBody } from "./datasets";

// Build the POST /datasets/query body from the builder tree + field schema.
export function buildQueryBody(
  tree: BuilderGroup,
  schema: FieldSchema[],
  page: number,
  pageSize: number,
): QueryDatasetsBody {
  return { filter: treeToPgFilterGroup(tree, schema), page, pageSize };
}
