import { describe, expect, it } from "vitest";

import { flowDocSchema, parseFlow, flowToJson, emptyFlow } from "./schema";

describe("flow schema", () => {
  it("emptyFlow has version 1 and a single start node", () => {
    const f = emptyFlow();
    expect(f.version).toBe(1);
    expect(f.nodes).toHaveLength(1);
    expect(f.nodes[0]!.type).toBe("start");
    expect(f.edges).toEqual([]);
  });

  it("accepts a valid doc and round-trips through JSON", () => {
    const doc = {
      version: 1 as const,
      nodes: [
        { id: "start", type: "start" as const, position: { x: 0, y: 0 } },
        { id: "f1", type: "form" as const, position: { x: 1, y: 2 }, config: { version: 1, fields: [] } },
      ],
      edges: [{ id: "e1", source: "start", target: "f1", trigger: "onSubmit" }],
    };
    expect(() => flowDocSchema.parse(doc)).not.toThrow();
    expect(parseFlow(flowToJson(doc))).toEqual(doc);
  });

  it("rejects an unknown node type and a bad version", () => {
    expect(() => flowDocSchema.parse({ version: 1, nodes: [{ id: "x", type: "nope", position: { x: 0, y: 0 } }], edges: [] })).toThrow();
    expect(() => flowDocSchema.parse({ version: 2, nodes: [], edges: [] })).toThrow();
  });

  it("preserves the reserved phase-2 fields (trigger/condition/inputs/outputCollection)", () => {
    const doc = {
      version: 1 as const,
      nodes: [{ id: "j", type: "action" as const, position: { x: 0, y: 0 }, inputs: ["a", "b"], outputCollection: true }],
      edges: [{ id: "e", source: "a", target: "j", condition: { any: true } }],
    };
    const parsed = flowDocSchema.parse(doc);
    expect(parsed.nodes[0]!.inputs).toEqual(["a", "b"]);
    expect(parsed.nodes[0]!.outputCollection).toBe(true);
    expect(parsed.edges[0]!.condition).toEqual({ any: true });
  });
});
