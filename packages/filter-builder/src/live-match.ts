import { matchQuery, type FilterMatchQuery, type ObjectData } from "@rfjs/data-filter";

import { treeToFilterGroup, type FilterConditionLike, type FilterGroupLike } from "./compile";
import { DATA_FILTER_OPS } from "./engines/data-filter";
import type { BuilderGroup } from "./types";

export interface LiveMatchResult {
  matched: unknown[];
  count: number;
  /**
   * The tree references an operator data-filter can't evaluate (or a field the
   * engine treats as absent) — the query is *runnable* but some branch can't be
   * covered in-memory. This is "we can't be sure nobody matched", NOT an error.
   */
  uncoverable: boolean;
  /**
   * The tree's shape is itself broken and the engine THREW while evaluating it
   * (e.g. an `array` condition missing `elementType`). Distinct from both
   * `uncoverable` and a genuine zero-match so consumers can tell "the rule is
   * malformed" apart from "nobody matched". See issue #266.
   */
  invalid: boolean;
  /** The thrown message, present only when `invalid` is true. */
  error?: string;
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
  if (uncoverable) return { matched: [], count: 0, uncoverable: true, invalid: false };
  try {
    const matched = rows.filter((row) => matchQuery(row as ObjectData, group as unknown as FilterMatchQuery));
    return { matched, count: matched.length, uncoverable: false, invalid: false };
  } catch (err) {
    // The condition passed the coverage check but the engine still threw — the
    // rule's shape is invalid. Surface it distinctly instead of collapsing it
    // into `uncoverable` (which is indistinguishable from no-match). Issue #266.
    return {
      matched: [],
      count: 0,
      uncoverable: false,
      invalid: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
