import {
  matchQueryAsync,
  validateMatchQuery,
  type ConditionIssue,
  type FilterMatchQuery,
  type ObjectData,
} from "@rfjs/data-filter";
import type { FlowDoc, FlowEdge } from "./schema";

/**
 * data-filter 的「這個 condition 引擎跑得動嗎」詞彙表 —— 由 flow-core **自己那份**
 * `@rfjs/data-filter` 轉出。
 *
 * 為什麼要轉出:`resolveCondition` 是用 flow-core 依賴樹裡那份 data-filter 求值的。
 * 消費端若自己 import `@rfjs/data-filter` 來驗證,pnpm 完全可能裝到另一份(版本不同
 * 就是兩份 copy),於是「驗證用的詞彙表」和「求值用的引擎」分家 —— 驗證說 OK、引擎卻
 * 丟例外,正是這組 API 存在的理由。從這裡拿,物理上不可能拿到另一份。
 */
export {
  validateCondition,
  validateMatchQuery,
  supportedOperators,
  LOGICAL_OPERATORS,
  MATCH_QUERY_DATA_TYPES,
  MATCH_QUERY_ELEMENT_TYPES,
  OPERATORS_BY_DATA_TYPE,
  ARRAY_OPERATORS_BY_ELEMENT,
} from "@rfjs/data-filter";
export type {
  ConditionIssue,
  ConditionIssueCode,
  VocabularyResult,
  MatchQueryConditionDataType,
  MatchQueryElementType,
} from "@rfjs/data-filter";

/** 帶上出處 edge 的 condition 詞彙問題。 */
export interface EdgeConditionIssue extends ConditionIssue {
  edgeId: string;
}

export type FlowConditionResult = { ok: true } | { ok: false; issues: EdgeConditionIssue[] };

/**
 * 存檔/發佈前檢查:doc 裡每條邊的 `condition` 是否都用了引擎認得的
 * dataType / operator / logic。回報每一條有問題的邊(不是只回第一條)。
 *
 * 只驗詞彙,不驗形狀(形狀交給 `@rfjs/filter-builder` 的 `parseFilterGroup`),
 * 也不驗 value 與 operator 的搭配(例如 `range` 需要兩個值)。無 `condition` 的邊
 * 恆真,直接略過 —— 與 `resolveCondition` 一致。
 */
export function validateFlowConditions(doc: FlowDoc): FlowConditionResult {
  const issues: EdgeConditionIssue[] = [];
  for (const edge of doc.edges) {
    if (edge.condition == null) continue;
    const result = validateMatchQuery(edge.condition);
    if (!result.ok) issues.push(...result.issues.map((issue) => ({ ...issue, edgeId: edge.id })));
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

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
