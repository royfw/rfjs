import { matchQuery, type FilterMatchQuery } from "@rfjs/data-filter";

import { treeToFilterGroup, type FilterConditionLike, type FilterGroupLike } from "./compile";
import { DATA_FILTER_OPS } from "./engines/data-filter";
import type { BuilderGroup } from "./types";

export interface LiveMatchResult {
  matched: unknown[];
  count: number;
  uncoverable: boolean;
}

function hasUncoverableOp(group: FilterGroupLike): boolean {
  return group.filters.some((f) => {
    if ("logic" in f) return hasUncoverableOp(f);
    const c = f as FilterConditionLike;
    if (c.operator === "elemmatch" && c.filters) return hasUncoverableOp(c.filters);
    return !DATA_FILTER_OPS.has(c.operator);
  });
}

export function runLiveMatch(rows: unknown[], tree: BuilderGroup): LiveMatchResult {
  const group = treeToFilterGroup(tree);
  const uncoverable = hasUncoverableOp(group);
  if (uncoverable) return { matched: [], count: 0, uncoverable: true };
  try {
    const matched = rows.filter((row) => matchQuery(row, group as unknown as FilterMatchQuery));
    return { matched, count: matched.length, uncoverable: false };
  } catch {
    return { matched: [], count: 0, uncoverable: true };
  }
}
