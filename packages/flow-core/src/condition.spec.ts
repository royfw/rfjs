import { describe, expect, it } from "vitest";
import type { FlowDoc } from "./schema";
import {
  resolveCondition,
  resolveHandle,
  validateCondition,
  validateFlowConditions,
  MATCH_QUERY_DATA_TYPES,
} from "./condition";

// data-filter 的 FilterMatchQuery 形狀(以 packages/data-filter/src/types/filter.ts 為準):
// { logic, filters:[{ field, dataType, operator, value }] } —— leaf 欄位是 `field`,不是 `path`。
const gt3 = { logic: "and", filters: [{ field: "days", dataType: "numeric", operator: "gt", value: 3 }] };

const doc: FlowDoc = {
  version: 1,
  nodes: [{ id: "cond1", type: "condition", position: { x: 0, y: 0 } }],
  edges: [
    { id: "e2", source: "cond1", target: "a", sourceHandle: "yes", condition: gt3 },
    { id: "e3", source: "cond1", target: "b", sourceHandle: "no" },
  ],
};

describe("resolveCondition", () => {
  it("context 符合 → true", async () => {
    expect(await resolveCondition(doc.edges[0]!, { days: 5 })).toBe(true);
  });
  it("context 不符 → false", async () => {
    expect(await resolveCondition(doc.edges[0]!, { days: 2 })).toBe(false);
  });
  it("無 condition → 恆真", async () => {
    expect(await resolveCondition(doc.edges[1]!, { days: 2 })).toBe(true);
  });
});

describe("resolveHandle", () => {
  it("挑第一個 condition 成立的 sourceHandle", async () => {
    expect(await resolveHandle(doc, "cond1", { days: 5 })).toBe("yes");
  });
  it("都不成立但有無條件邊 → 回無條件邊的 sourceHandle", async () => {
    expect(await resolveHandle(doc, "cond1", { days: 2 })).toBe("no");
  });
  it("查無此節點的出邊 → null", async () => {
    expect(await resolveHandle(doc, "missing", { days: 5 })).toBe(null);
  });
});

describe("validateFlowConditions", () => {
  // 就是這片葉子:形狀合法、詞彙不合法 —— 以前存得進去、發佈得出去,
  // 等到申請人送出表單才在 resolveCondition 丟例外(500 而不是 400)。
  const wat = { logic: "and", filters: [{ field: "x", dataType: "wat", operator: "eq", value: 1 }] };

  const docWith = (condition: unknown): FlowDoc => ({
    version: 1,
    nodes: [{ id: "cond1", type: "condition", position: { x: 0, y: 0 } }],
    edges: [{ id: "bad-edge", source: "cond1", target: "a", sourceHandle: "yes", condition }],
  });

  it("合法的 doc → ok", () => {
    expect(validateFlowConditions(doc)).toEqual({ ok: true });
  });

  it("擋下 dataType 'wat',並指出是哪一條邊", () => {
    const result = validateFlowConditions(docWith(wat));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues).toEqual([
      {
        edgeId: "bad-edge",
        code: "unsupportedDataType",
        message: "[data-filter] unsupported dataType 'wat'",
        path: "filters[0]",
      },
    ]);
  });

  it("擋下的正是 resolveCondition 會丟例外的那一片", async () => {
    const edge = docWith(wat).edges[0]!;
    expect(validateFlowConditions(docWith(wat)).ok).toBe(false);
    await expect(resolveCondition(edge, { x: 1 })).rejects.toThrow(
      "[data-filter] unsupported dataType 'wat'",
    );
  });

  it("無 condition 的邊不算問題", () => {
    expect(validateFlowConditions({ ...doc, edges: [{ id: "e", source: "a", target: "b" }] })).toEqual({
      ok: true,
    });
  });

  it("轉出的詞彙表就是求值那份引擎的(同一個 copy)", () => {
    expect([...MATCH_QUERY_DATA_TYPES].sort()).toEqual([
      "array",
      "boolean",
      "date",
      "numeric",
      "object",
      "string",
    ]);
    expect(validateCondition({ field: "days", dataType: "numeric", operator: "gt", value: 3 })).toEqual({
      ok: true,
    });
  });
});
