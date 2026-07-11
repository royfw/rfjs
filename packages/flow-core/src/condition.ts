import { matchQueryAsync, type FilterMatchQuery, type ObjectData } from "@rfjs/data-filter";
import type { FlowDoc, FlowEdge } from "./schema";

/** 用 @rfjs/data-filter 對 context 評估 edge.condition;無 condition 視為恆真。 */
export async function resolveCondition(edge: FlowEdge, context: Record<string, unknown>): Promise<boolean> {
  if (edge.condition == null) return true;
  return matchQueryAsync(context as ObjectData, edge.condition as FilterMatchQuery);
}

/** 便利:對某 condition 節點的出邊依序評估,回第一個成立的 sourceHandle;都不成立回 null。
 * 無 condition 的邊視為恆真(可當 default/fallback)。 */
export async function resolveHandle(
  doc: FlowDoc,
  nodeId: string,
  context: Record<string, unknown>,
): Promise<string | null> {
  for (const edge of doc.edges.filter((e) => e.source === nodeId)) {
    if (typeof edge.sourceHandle !== "string") continue;
    if (await resolveCondition(edge, context)) return edge.sourceHandle;
  }
  return null;
}
