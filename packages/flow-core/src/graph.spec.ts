import { describe, expect, it } from "vitest";
import type { FlowDoc, FlowEdge, FlowNode } from "./schema";
import { ancestorNodes, nodeById, outgoingEdges, reachableNodes } from "./graph";

const ids = (nodes: FlowNode[]): string[] => nodes.map((n) => n.id);

// 請假流(含 back edge 與 timeout 邊,以及一條 dangling 邊):
// start → form1 → review(yes → act1;reject → form1[back edge])
//                 form1 --timeout--> esc(auto → end)
// act1 → final(condition) → end;act1 → ghost(不存在的節點,dangling)
const doc: FlowDoc = {
  version: 1,
  nodes: [
    { id: "start", type: "start", position: { x: 0, y: 0 } },
    { id: "form1", type: "form", position: { x: 0, y: 0 } },
    { id: "review", type: "condition", position: { x: 0, y: 0 } },
    { id: "act1", type: "action", position: { x: 0, y: 0 } },
    { id: "final", type: "condition", position: { x: 0, y: 0 } },
    { id: "esc", type: "condition", position: { x: 0, y: 0 } },
    { id: "end", type: "end", position: { x: 0, y: 0 } },
  ],
  edges: [
    { id: "e0", source: "start", target: "form1" },
    { id: "e1", source: "form1", target: "review", trigger: "onSubmit" },
    { id: "et", source: "form1", target: "esc", trigger: "timeout" },
    { id: "e2", source: "review", target: "act1", sourceHandle: "yes" },
    { id: "e3", source: "review", target: "form1", sourceHandle: "reject" }, // back edge → 環
    { id: "e4", source: "act1", target: "final" },
    { id: "e5", source: "final", target: "end", sourceHandle: "done" },
    { id: "e6", source: "esc", target: "end", sourceHandle: "auto" },
    { id: "e7", source: "act1", target: "ghost" }, // dangling:無 ghost 節點
  ],
};

const isCondition = (n: FlowNode): boolean => n.type === "condition";
const notTimeout = (e: FlowEdge): boolean => e.trigger !== "timeout";

describe("nodeById", () => {
  it("建成 id → node 索引,含全部節點", () => {
    const map = nodeById(doc);
    expect(map.size).toBe(doc.nodes.length);
    expect(map.get("review")?.type).toBe("condition");
    expect(map.get("nope")).toBeUndefined();
  });
});

describe("outgoingEdges", () => {
  it("依 source 分組並維持陣列順序", () => {
    const map = outgoingEdges(doc);
    expect(map.get("form1")?.map((e) => e.target)).toEqual(["review", "esc"]);
    expect(map.get("review")?.map((e) => e.sourceHandle)).toEqual(["yes", "reject"]);
    expect(map.get("end")).toBeUndefined(); // 無出邊
  });
});

describe("reachableNodes —— 前向", () => {
  it("BFS 造訪順序(邊依陣列順序展開)", () => {
    expect(ids(reachableNodes(doc, "form1"))).toEqual(["review", "esc", "act1", "end", "final"]);
  });
  it("includeSelf 把起點放在最前", () => {
    expect(ids(reachableNodes(doc, "form1", { includeSelf: true }))).toEqual([
      "form1",
      "review",
      "esc",
      "act1",
      "end",
      "final",
    ]);
  });
  it("filter 只收集 condition(收集語意:被濾掉的節點仍被展開)", () => {
    // act1 被 filter 濾掉,但 final 只透過 act1 才可達 —— 仍出現,證明是收集而非剪枝。
    expect(ids(reachableNodes(doc, "form1", { filter: isCondition }))).toEqual(["review", "esc", "final"]);
  });
  it("follow 排除 trigger:'timeout' 邊 —— esc 不被計入", () => {
    expect(ids(reachableNodes(doc, "form1", { follow: notTimeout }))).toEqual(["review", "act1", "final", "end"]);
  });
  it("back edge 造成的環被 visited 切斷,每個節點僅一次、不無限迴圈", () => {
    const result = ids(reachableNodes(doc, "review"));
    expect(result).toEqual(["act1", "form1", "final", "esc", "end"]);
    expect(new Set(result).size).toBe(result.length); // 無重複
  });
  it("dangling target(ghost)被跳過、不丟例外", () => {
    expect(ids(reachableNodes(doc, "act1"))).toEqual(["final", "end"]);
  });
  it("未知 fromId → []", () => {
    expect(reachableNodes(doc, "nope")).toEqual([]);
  });
});

describe("ancestorNodes —— 反向", () => {
  it("反向 BFS:能到達 end 的節點", () => {
    expect(ids(ancestorNodes(doc, "end"))).toEqual(["final", "esc", "act1", "form1", "review", "start"]);
  });
  it("支援同樣的 options:includeSelf", () => {
    expect(ids(ancestorNodes(doc, "esc", { includeSelf: true }))).toEqual(["esc", "form1", "start", "review"]);
  });
  it("follow 排除 timeout 邊 —— esc 唯一入邊是 timeout,故無祖先(前向 esc-only-via-timeout 的反向對稱)", () => {
    expect(ids(ancestorNodes(doc, "esc", { follow: notTimeout }))).toEqual([]);
  });
  it("filter 只收集 condition", () => {
    expect(ids(ancestorNodes(doc, "end", { filter: isCondition }))).toEqual(["final", "esc", "review"]);
  });
  it("未知 toId → []", () => {
    expect(ancestorNodes(doc, "nope")).toEqual([]);
  });
});
