import { describe, expect, it } from "vitest";
import type { FlowDoc } from "./schema";
import { resolveCondition, resolveHandle } from "./condition";

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
