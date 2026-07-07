import { describe, expect, it } from "vitest";

import type { FlowDoc } from "./schema";
import { projectFlow } from "./projection";

/** start → form → cond ─yes→ act1 → end / ─no→ act2 → end(內建範例的拓撲)。 */
const doc: FlowDoc = {
  version: 1,
  nodes: [
    { id: "start", type: "start", position: { x: 0, y: 0 } },
    { id: "form1", type: "form", position: { x: 200, y: 0 } },
    { id: "cond1", type: "condition", position: { x: 400, y: 0 } },
    { id: "act1", type: "action", position: { x: 600, y: -80 } },
    { id: "act2", type: "action", position: { x: 600, y: 80 } },
    { id: "end", type: "end", position: { x: 800, y: 0 } },
  ],
  edges: [
    { id: "e1", source: "start", target: "form1" },
    { id: "e2", source: "form1", target: "cond1", trigger: "onSubmit" },
    { id: "e3", source: "cond1", target: "act1", sourceHandle: "yes", label: "yes" },
    { id: "e4", source: "cond1", target: "act2", sourceHandle: "no", label: "no" },
    { id: "e5", source: "act1", target: "end" },
    { id: "e6", source: "act2", target: "end" },
  ],
};

describe("projectFlow", () => {
  it("keeps start/end regardless of the keep set", () => {
    const out = projectFlow(doc, { keep: [] });
    expect(out.nodes.map((n) => n.id)).toEqual(["start", "end"]);
  });

  it("filters actions and contracts edges, keeping yes/no as parallel labeled edges", () => {
    const out = projectFlow(doc, { keep: ["form", "condition"] });
    expect(out.nodes.map((n) => n.id)).toEqual(["start", "form1", "cond1", "end"]);
    const contracted = out.edges.filter((e) => e.source === "cond1" && e.target === "end");
    expect(contracted).toHaveLength(2); // yes/no 平行邊不被去重
    expect(contracted.map((e) => e.label).sort()).toEqual(["no", "yes"]);
    expect(contracted.map((e) => e.id).sort()).toEqual(["proj-cond1-end-no", "proj-cond1-end-yes"]);
    // 縮線邊沿用鏈上第一條邊的 sourceHandle
    expect(contracted.find((e) => e.label === "yes")?.sourceHandle).toBe("yes");
    // 縮線邊不沿用 trigger/condition
    expect(contracted.every((e) => e.trigger === undefined && e.condition === undefined)).toBe(true);
  });

  it("preserves untouched original edges with all fields", () => {
    const out = projectFlow(doc, { keep: ["form", "condition"] });
    expect(out.edges.find((e) => e.id === "e2")?.trigger).toBe("onSubmit");
  });

  it("contracts through chains of removed nodes", () => {
    const chain: FlowDoc = {
      version: 1,
      nodes: [
        { id: "s", type: "start", position: { x: 0, y: 0 } },
        { id: "a1", type: "action", position: { x: 100, y: 0 } },
        { id: "a2", type: "action", position: { x: 200, y: 0 } },
        { id: "e", type: "end", position: { x: 300, y: 0 } },
      ],
      edges: [
        { id: "c1", source: "s", target: "a1", label: "go" },
        { id: "c2", source: "a1", target: "a2" },
        { id: "c3", source: "a2", target: "e" },
      ],
    };
    const out = projectFlow(chain, { keep: [] });
    expect(out.edges).toHaveLength(1);
    expect(out.edges[0]).toMatchObject({ id: "proj-s-e-go", source: "s", target: "e", label: "go" });
  });

  it("dedupes identical (source, target, label) and drops self-loops; survives cycles among removed nodes", () => {
    const loop: FlowDoc = {
      version: 1,
      nodes: [
        { id: "s", type: "start", position: { x: 0, y: 0 } },
        { id: "a1", type: "action", position: { x: 100, y: 0 } },
        { id: "a2", type: "action", position: { x: 200, y: 0 } },
        { id: "e", type: "end", position: { x: 300, y: 0 } },
      ],
      edges: [
        { id: "l1", source: "s", target: "a1" },
        { id: "l2", source: "a1", target: "a2" },
        { id: "l3", source: "a2", target: "a1" }, // 被移除節點間的環
        { id: "l4", source: "a1", target: "e" },
        { id: "l5", source: "a2", target: "e" },
      ],
    };
    const out = projectFlow(loop, { keep: [] });
    // 兩條路徑 s→…→e 都無 label → 去重成一條;不會無窮迴圈
    expect(out.edges).toHaveLength(1);
    expect(out.edges[0]).toMatchObject({ source: "s", target: "e" });
  });

  it("does not mutate the input doc", () => {
    const snapshot = JSON.stringify(doc);
    projectFlow(doc, { keep: [] });
    expect(JSON.stringify(doc)).toBe(snapshot);
  });
});
