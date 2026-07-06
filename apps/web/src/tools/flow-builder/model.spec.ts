import { describe, expect, it } from "vitest";

import { toReactFlow, toFlowDoc, newNode, nextNodeId, defaultConfig, findFreePosition } from "./model";
import { emptyFlow, flowDocSchema, type FlowDoc } from "./schema";

describe("nextNodeId", () => {
  it("starts at 1 on an empty canvas", () => {
    expect(nextNodeId("action", [])).toBe("action-1");
  });

  it("continues after the max existing number of the same type", () => {
    expect(nextNodeId("action", ["action-2", "action-7", "form-9"])).toBe("action-8");
  });

  it("ignores other types and non-matching id formats", () => {
    // sample 的 "act-1"、自由命名的 "action-x" 都不符合 ^action-\d+$,不干擾編號
    expect(nextNodeId("action", ["act-1", "action-x", "start", "form-3"])).toBe("action-1");
  });
});

describe("flow model", () => {
  it("toReactFlow maps nodes/edges and carries type+config in data", () => {
    const doc = {
      version: 1 as const,
      nodes: [{ id: "f1", type: "form" as const, position: { x: 3, y: 4 }, config: { version: 1, fields: [] } }],
      edges: [{ id: "e1", source: "start", target: "f1", sourceHandle: "yes", label: "ok" }],
    };
    const { nodes, edges } = toReactFlow(doc);
    expect(nodes[0]).toMatchObject({ id: "f1", type: "form", position: { x: 3, y: 4 } });
    expect((nodes[0]!.data as { type: string; config: unknown }).type).toBe("form");
    expect((nodes[0]!.data as { config: unknown }).config).toEqual({ version: 1, fields: [] });
    expect(edges[0]).toMatchObject({ id: "e1", source: "start", target: "f1", sourceHandle: "yes", label: "ok" });
  });

  it("toFlowDoc is the inverse of toReactFlow (round-trip, schema-valid)", () => {
    const doc = emptyFlow();
    const { nodes, edges } = toReactFlow(doc);
    const back = toFlowDoc(nodes, edges);
    expect(() => flowDocSchema.parse(back)).not.toThrow();
    expect(back).toEqual(doc);
  });

  it("newNode gives a typed node with default config and a unique id", () => {
    const a = newNode("action", { x: 1, y: 1 });
    const b = newNode("action", { x: 2, y: 2 }, [a.id]);
    expect(a.type).toBe("action");
    expect((a.data as { config: unknown }).config).toEqual({ kind: "notify", params: {} });
    expect(a.id).not.toBe(b.id);
  });

  it("defaultConfig: form→empty FormConfig, action→notify, others undefined", () => {
    expect(defaultConfig("form")).toEqual({ version: 1, fields: [] });
    expect(defaultConfig("action")).toEqual({ kind: "notify", params: {} });
    expect(defaultConfig("condition")).toBeUndefined();
    expect(defaultConfig("start")).toBeUndefined();
  });

  it("toFlowDoc(toReactFlow(doc)) round-trips reserved phase-2 fields (inputs/outputCollection/trigger/condition)", () => {
    const doc: FlowDoc = {
      version: 1,
      nodes: [
        {
          id: "f1",
          type: "form",
          position: { x: 0, y: 0 },
          config: { version: 1, fields: [] },
          inputs: ["a", "b"],
          outputCollection: true,
        },
      ],
      edges: [
        {
          id: "e1",
          source: "f1",
          target: "f1",
          trigger: "onSubmit",
          condition: { any: true },
        },
      ],
    };
    const { nodes, edges } = toReactFlow(doc);
    const back = toFlowDoc(nodes, edges);
    expect(back).toEqual(doc);
  });

  it("toReactFlow renders edges with the adaptive display type (not persisted)", () => {
    const doc = emptyFlow();
    doc.nodes.push({ id: "n2", type: "end", position: { x: 100, y: 0 } });
    doc.edges.push({ id: "e1", source: "start", target: "n2" });
    const { edges } = toReactFlow(doc);
    expect(edges[0]!.type).toBe("adaptive");
    // round-trip must not leak the display type into FlowDoc
    const back = toFlowDoc(toReactFlow(doc).nodes, edges);
    expect(back).toEqual(doc);
  });

  it("findFreePosition returns a spot that overlaps no existing node", () => {
    const existing = [
      { x: 60, y: 60 },
      { x: 320, y: 60 },
      { x: 60, y: 220 },
    ];
    const p = findFreePosition(existing);
    for (const q of existing) {
      const clear = Math.abs(q.x - p.x) >= 260 || Math.abs(q.y - p.y) >= 160;
      expect(clear).toBe(true);
    }
  });

  it("findFreePosition on an empty canvas starts at the origin slot", () => {
    expect(findFreePosition([])).toEqual({ x: 60, y: 60 });
  });
});
