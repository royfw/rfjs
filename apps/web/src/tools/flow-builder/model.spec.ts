import { describe, expect, it } from "vitest";

import { toReactFlow, toFlowDoc, newNode, defaultConfig } from "./model";
import { emptyFlow, flowDocSchema } from "./schema";

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
    const b = newNode("action", { x: 2, y: 2 });
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
});
