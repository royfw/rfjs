import { matchQuery } from '@rfjs/data-filter';
import type { FilterMatchQuery, ObjectData } from '@rfjs/data-filter';

/** A filter-match rule that controls field visibility (alias of data-filter's group type). */
export type ConditionalRule = FilterMatchQuery;

/**
 * Evaluates a conditional visibility rule against the current form values.
 *
 * Returns `true` (field shown) when:
 * - `rule` is `undefined` (no condition — always visible), or
 * - the rule's filter group matches `values`.
 *
 * Uses the SYNC `matchQuery` — safe for React render (no await).
 */
export function evaluateConditional(
  rule: ConditionalRule | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!rule) return true;
  return matchQuery(values as ObjectData, rule);
}
